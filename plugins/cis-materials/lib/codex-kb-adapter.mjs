import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';

const SOURCE = 'flipbelt-kb';
const TOOLS = Object.freeze(['search_flipbelt_kb', 'get_flipbelt_page', 'get_flipbelt_asset']);
const SELF_DISABLE = 'plugins."cis-materials@cis-local".enabled=false';
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
const MESSAGES = Object.freeze({
  INVALID_INPUT: '请求参数无效。',
  AUTH_REQUIRED: '需要本人完成知识库授权或处理权限提示。',
  ACCESS_DENIED: '当前身份无权读取该知识元数据。',
  UPSTREAM_UNAVAILABLE: '知识服务暂不可用。',
  UPSTREAM_INVALID: '知识服务返回了不符合约定的数据。',
});
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function failure(code) {
  return Object.assign(new Error(MESSAGES[code]), { code });
}
function classify(error) {
  // Inspect upstream errors only in memory. Their text may contain access URLs.
  let value = '';
  try { value = JSON.stringify(error).slice(0, 32_768); } catch { /* Use a safe generic error. */ }
  if (/\b403\b|access.?denied|forbidden/i.test(value)) return 'ACCESS_DENIED';
  if (/\b401\b|notLoggedIn|authenticationRequired|unauthorized|reauthentication|oauth|approval|authorization.required/i.test(value)) return 'AUTH_REQUIRED';
  return 'UPSTREAM_UNAVAILABLE';
}
function checkedArgs(tool, input) {
  if (!TOOLS.includes(tool) || !record(input)) throw failure('INVALID_INPUT');
  const keys = tool === 'search_flipbelt_kb' ? ['query', 'limit']
    : tool === 'get_flipbelt_page' ? ['page_id'] : ['asset_id'];
  if (Object.keys(input).some(key => !keys.includes(key))) throw failure('INVALID_INPUT');
  if (tool === 'search_flipbelt_kb') {
    const { query, limit } = input;
    if (typeof query !== 'string' || !query.trim() || query.length > 120
      || /[\u0000-\u001f\u007f]|[a-z][a-z0-9+.-]*:\/\/|(?:^|\s)(?:data:|file:|javascript:)|^[\/\\]|(?:^|\s)[a-z]:[\/\\]|\\\\/i.test(query)
      || !Number.isInteger(limit) || limit < 1 || limit > 5) throw failure('INVALID_INPUT');
    return { query: query.trim(), limit };
  }
  const key = keys[0];
  if (typeof input[key] !== 'string' || !IDENTIFIER.test(input[key])) throw failure('INVALID_INPUT');
  return { [key]: input[key] };
}
function parseEnvelope(result) {
  if (!record(result)) throw failure('UPSTREAM_INVALID');
  if (result.isError) throw failure(classify(result));
  if (record(result.structuredContent)) return result.structuredContent;
  const content = result.content;
  if (!Array.isArray(content) || content.length !== 1 || content[0]?.type !== 'text'
    || typeof content[0].text !== 'string') throw failure('UPSTREAM_INVALID');
  let parsed;
  try { parsed = JSON.parse(content[0].text); } catch { throw failure('UPSTREAM_INVALID'); }
  if (!record(parsed)) throw failure('UPSTREAM_INVALID');
  return parsed;
}
function defaultCommand() {
  if (process.platform !== 'win32') return 'codex';
  // Use the installed CLI's native executable, avoiding a shell and orphaned npm launchers.
  if (process.env.APPDATA) {
    const root = join(process.env.APPDATA, 'npm', 'node_modules', '@openai', 'codex');
    const platformPackage = process.arch === 'arm64' ? '@openai/codex-win32-arm64' : '@openai/codex-win32-x64';
    const triple = process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
    try {
      const resolve = createRequire(join(root, 'package.json'));
      const binary = join(dirname(resolve.resolve(`${platformPackage}/package.json`)), 'vendor', triple, 'bin', 'codex.exe');
      if (existsSync(binary)) return binary;
    } catch { /* A trusted host can provide a CLI command when it uses another installation. */ }
  }
  return 'codex.exe';
}

/** Options are trusted host configuration, never MCP tool arguments. No auth files are read. */
export function createCodexKbAdapter({
  cwd = process.cwd(), command = defaultCommand(), args = [], timeoutMs = 45_000,
  maxRpcBytes = 8 * 1024 * 1024, maxStdoutBytes = 16 * 1024 * 1024,
  spawnProcess = spawn,
} = {}) {
  if (typeof cwd !== 'string' || typeof command !== 'string' || !command
    || !Array.isArray(args) || args.some(arg => typeof arg !== 'string')
    || ![timeoutMs, maxRpcBytes, maxStdoutBytes].every(n => Number.isSafeInteger(n) && n > 0)
    || typeof spawnProcess !== 'function') throw new TypeError('Invalid trusted adapter configuration.');
  let child, ready, closed = false, stopped = false, terminalError, threadId, inventory;
  let nextId = 1, bytes = 0, buffer = '';
  const decoder = new StringDecoder('utf8');
  const pending = new Map();
  function stop(error = failure('UPSTREAM_UNAVAILABLE')) {
    if (!terminalError) terminalError = error;
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(terminalError); }
    pending.clear();
    if (child && !stopped) {
      stopped = true;
      try { child.stdin.end(); } catch { /* Already closed. */ }
      try { child.kill(); } catch { /* Already exited. */ }
    }
  }
  function send(message) {
    if (closed || terminalError || !child?.stdin?.writable) throw terminalError ?? failure('UPSTREAM_UNAVAILABLE');
    try { child.stdin.write(`${JSON.stringify(message)}\n`); }
    catch { stop(); throw terminalError; }
  }
  function rpc(method, params) {
    if (closed || terminalError) return Promise.reject(terminalError ?? failure('UPSTREAM_UNAVAILABLE'));
    return new Promise((resolve, reject) => {
      // Budget each pending RPC batch, retaining bytes from an unfinished frame.
      if (pending.size === 0) bytes = Buffer.byteLength(buffer);
      const id = nextId++;
      const timer = setTimeout(() => stop(failure('UPSTREAM_UNAVAILABLE')), timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try { send({ id, method, params }); } catch (error) {
        clearTimeout(timer); pending.delete(id); reject(error);
      }
    });
  }
  function receive(chunk) {
    bytes += chunk.length;
    if (bytes > maxStdoutBytes) return stop(failure('UPSTREAM_INVALID'));
    buffer += decoder.write(chunk);
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      if (Buffer.byteLength(line) > maxRpcBytes) return stop(failure('UPSTREAM_INVALID'));
      let message;
      try { message = JSON.parse(line); } catch { return stop(failure('UPSTREAM_INVALID')); }
      if (!record(message)) return stop(failure('UPSTREAM_INVALID'));
      if (typeof message.method === 'string') {
        if (Object.hasOwn(message, 'id')) {
          // A plugin cannot approve an upstream prompt on the user's behalf.
          try { send({ id: message.id, error: { code: -32601, message: 'User approval must be handled in Codex.' } }); } catch { /* Fail closed below. */ }
          return stop(failure('AUTH_REQUIRED'));
        }
        continue;
      }
      const entry = pending.get(message.id);
      if (!entry) continue;
      clearTimeout(entry.timer); pending.delete(message.id);
      if (Object.hasOwn(message, 'error')) entry.reject(failure(classify(message.error)));
      else if (Object.hasOwn(message, 'result')) entry.resolve(message.result);
      else { entry.reject(failure('UPSTREAM_INVALID')); return stop(failure('UPSTREAM_INVALID')); }
    }
    if (Buffer.byteLength(buffer) > maxRpcBytes) stop(failure('UPSTREAM_INVALID'));
  }
  async function ensureReady() {
    if (closed || terminalError) throw terminalError ?? failure('UPSTREAM_UNAVAILABLE');
    if (!ready) ready = (async () => {
      try {
        child = spawnProcess(command, [...args, 'app-server', '--stdio', '-c', SELF_DISABLE], {
          cwd, env: { ...process.env, CIS_MATERIALS_PROXY_CHILD: '1' },
          stdio: ['pipe', 'pipe', 'ignore'], shell: false, windowsHide: true,
        });
        child.stdout.on('data', receive);
        child.stdin.on('error', () => stop());
        child.on('error', () => stop());
        child.on('close', () => stop());
        await rpc('initialize', {
          clientInfo: { name: 'cis_materials_readonly', title: 'CIS materials readonly adapter', version: '0.1.0' },
          capabilities: { experimentalApi: false, requestAttestation: false },
        });
        send({ method: 'initialized' });
        const started = await rpc('thread/start', {
          cwd, ephemeral: true, sandbox: 'read-only', approvalPolicy: 'on-request', approvalsReviewer: 'user',
        });
        threadId = started?.thread?.id;
        if (typeof threadId !== 'string' || !threadId || threadId.length > 200) throw failure('UPSTREAM_INVALID');
        let cursor;
        for (let page = 0; page < 8; page++) {
          const result = await rpc('mcpServerStatus/list', {
            threadId, detail: 'toolsAndAuthOnly', limit: 100, ...(cursor ? { cursor } : {}),
          });
          if (!record(result) || !Array.isArray(result.data)) throw failure('UPSTREAM_INVALID');
          const source = result.data.find(item => record(item) && item.name === SOURCE);
          if (source) {
            if (source.authStatus === 'notLoggedIn' || source.runtimeStatus === 'authenticationRequired') throw failure('AUTH_REQUIRED');
            if (!record(source.tools) || !TOOLS.every(tool => Object.hasOwn(source.tools, tool))
              || source.runtimeStatus !== 'connected') throw failure('UPSTREAM_UNAVAILABLE');
            inventory = Object.freeze({ source: SOURCE, authStatus: source.authStatus, runtimeStatus: 'connected', tools: [...TOOLS] });
            return;
          }
          if (!result.nextCursor) break;
          if (typeof result.nextCursor !== 'string' || result.nextCursor.length > 10_000) throw failure('UPSTREAM_INVALID');
          cursor = result.nextCursor;
        }
        throw failure('UPSTREAM_UNAVAILABLE');
      } catch (error) {
        const safe = error && Object.hasOwn(MESSAGES, error.code) ? error : failure('UPSTREAM_UNAVAILABLE');
        stop(safe); throw safe;
      }
    })();
    return ready;
  }
  return {
    async invoke(tool, input) {
      const checked = checkedArgs(tool, input);
      await ensureReady();
      try {
        return parseEnvelope(await rpc('mcpServer/tool/call', { threadId, server: SOURCE, tool, arguments: checked }));
      } catch (error) {
        const safe = error && Object.hasOwn(MESSAGES, error.code) ? error : failure('UPSTREAM_UNAVAILABLE');
        stop(safe); throw safe;
      }
    },
    async status() { await ensureReady(); return { ...inventory, tools: [...inventory.tools] }; },
    close() { if (!closed) { closed = true; stop(); } },
  };
}
