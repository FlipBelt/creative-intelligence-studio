import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import test from 'node:test';
import { createCodexKbAdapter } from '../../plugins/cis-materials/lib/codex-kb-adapter.mjs';

const tools = ['search_flipbelt_kb', 'get_flipbelt_page', 'get_flipbelt_asset'];
const source = (changes = {}) => ({
  name: 'flipbelt-kb', authStatus: 'oAuth', runtimeStatus: 'connected',
  tools: Object.fromEntries(tools.map(tool => [tool, {}])), ...changes,
});
const data = { release_id: 'release-1', data: [{ page_id: 'page-1' }] };
function harness({ answer, inventory = [source()], options = {} } = {}) {
  const requests = [], responses = [], launches = [];
  let processRef;
  const spawnProcess = (command, args, spawnOptions) => {
    launches.push({ command, args, options: spawnOptions });
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.killed = false;
    child.kill = () => { child.killed = true; return true; };
    child.stdin = new Writable({
      write(chunk, encoding, callback) {
        for (const line of chunk.toString().trim().split('\n')) {
          if (!line) continue;
          const request = JSON.parse(line);
          if (!request.method) { responses.push(request); continue; }
          requests.push(request);
          queueMicrotask(() => {
            if (child.killed) return;
            const send = result => child.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
            if (answer?.({ request, child, send }) === true) return;
            if (request.method === 'initialize') send({});
            else if (request.method === 'thread/start') send({ thread: { id: 'test-thread' } });
            else if (request.method === 'mcpServerStatus/list') send({ data: inventory, nextCursor: null });
            else if (request.method === 'mcpServer/tool/call') send({ structuredContent: data, content: [{ type: 'text', text: JSON.stringify(data) }] });
          });
        }
        callback();
      },
    });
    processRef = child;
    return child;
  };
  const adapter = createCodexKbAdapter({ cwd: process.cwd(), command: 'trusted-codex', spawnProcess, timeoutMs: 500, ...options });
  return { adapter, requests, responses, launches, get child() { return processRef; } };
}
const search = adapter => adapter.invoke('search_flipbelt_kb', { query: '产品', limit: 1 });
const safeError = code => error => {
  assert.equal(error.code, code);
  assert.doesNotMatch(error.message, /secret|https:|signed|nas|401|403/i);
  return true;
};

test('uses the existing fixed source with ephemeral read-only RPC and no model turn', async () => {
  const h = harness();
  try {
    assert.deepEqual(await search(h.adapter), data);
    const status = await h.adapter.status();
    assert.deepEqual(status, { source: 'flipbelt-kb', authStatus: 'oAuth', runtimeStatus: 'connected', tools });
    status.tools.push('write');
    assert.deepEqual((await h.adapter.status()).tools, tools);
    assert.equal(h.launches.length, 1);
    assert.equal(h.launches[0].options.shell, false);
    assert.equal(h.launches[0].options.windowsHide, true);
    assert.deepEqual(h.launches[0].options.stdio, ['pipe', 'pipe', 'ignore']);
    assert.equal(h.launches[0].options.env.CIS_MATERIALS_PROXY_CHILD, '1');
    assert.ok(h.launches[0].args.includes('plugins."cis-materials@cis-local".enabled=false'));
    assert.deepEqual(h.requests.find(r => r.method === 'thread/start').params, {
      cwd: process.cwd(), ephemeral: true, sandbox: 'read-only', approvalPolicy: 'on-request', approvalsReviewer: 'user',
    });
    assert.deepEqual(h.requests.filter(r => r.method === 'mcpServer/tool/call').map(r => r.params), [{
      threadId: 'test-thread', server: 'flipbelt-kb', tool: 'search_flipbelt_kb', arguments: { query: '产品', limit: 1 },
    }]);
    assert.equal(h.requests.some(r => r.method === 'turn/start' || /login|install|config.*write/.test(r.method)), false);
  } finally { h.adapter.close(); }
  assert.equal(h.child.killed, true);
});

test('accepts one JSON text envelope without exposing or fetching URL fields', async () => {
  const raw = { release_id: 'r1', data: { asset_id: 'asset-1', signed_url: 'https://example.test/secret?sig=secret' } };
  const h = harness({ answer({ request, send }) {
    if (request.method !== 'mcpServer/tool/call') return false;
    send({ content: [{ type: 'text', text: JSON.stringify(raw) }] }); return true;
  } });
  try { assert.deepEqual(await h.adapter.invoke('get_flipbelt_asset', { asset_id: 'asset-1' }), raw); }
  finally { h.adapter.close(); }
  assert.equal(h.requests.filter(r => r.method === 'mcpServer/tool/call').length, 1);
});

test('rejects unknown tools, injected arguments, and unsafe inputs before spawning', async () => {
  const h = harness();
  for (const [tool, args] of [
    ['delete_asset', { asset_id: 'asset-1' }],
    ['get_flipbelt_page', { page_id: 'page-1', url: 'https://example.test/secret' }],
    ['get_flipbelt_asset', { asset_id: '../../secret' }],
    ['search_flipbelt_kb', { query: 'https://example.test/secret', limit: 1 }],
    ['search_flipbelt_kb', { query: '产品', limit: 6 }],
    ['search_flipbelt_kb', { query: '产品\nsecret', limit: 1 }],
  ]) await assert.rejects(h.adapter.invoke(tool, args), safeError('INVALID_INPUT'));
  assert.equal(h.launches.length, 0);
  h.adapter.close();
});

test('requires the direct source and all three allowed tools', async () => {
  for (const inventory of [[], [source({ name: 'codex_apps' })], [source({ tools: { search_flipbelt_kb: {} } })]]) {
    const h = harness({ inventory });
    await assert.rejects(search(h.adapter), safeError('UPSTREAM_UNAVAILABLE'));
    assert.equal(h.requests.some(r => r.method === 'mcpServer/tool/call'), false);
    assert.equal(h.child.killed, true);
  }
});

test('fails closed for missing OAuth without starting login or calling tools', async () => {
  const h = harness({ inventory: [source({ authStatus: 'notLoggedIn', runtimeStatus: 'authenticationRequired' })] });
  await assert.rejects(search(h.adapter), safeError('AUTH_REQUIRED'));
  assert.equal(h.requests.some(r => /tool\/call|oauth\/login/.test(r.method)), false);
  assert.equal(h.child.killed, true);
});

test('sanitizes both MCP errors and RPC 401/403 errors', async () => {
  for (const [status, code] of [[401, 'AUTH_REQUIRED'], [403, 'ACCESS_DENIED']]) for (const kind of ['mcp', 'rpc']) {
    const h = harness({ answer({ request, child, send }) {
      if (request.method !== 'mcpServer/tool/call') return false;
      const error = { code: status, message: 'https://example.test/secret?sig=secret nas secret' };
      if (kind === 'mcp') send({ isError: true, content: [{ type: 'text', text: JSON.stringify(error) }] });
      else child.stdout.write(`${JSON.stringify({ id: request.id, error })}\n`);
      return true;
    } });
    try { await assert.rejects(search(h.adapter), safeError(code)); }
    finally { h.adapter.close(); }
  }
});

test('declines upstream prompts instead of automatically accepting approvals', async () => {
  const h = harness({ answer({ request, child }) {
    if (request.method !== 'mcpServer/tool/call') return false;
    child.stdout.write(`${JSON.stringify({ id: 900, method: 'mcpServer/elicitation/request', params: { url: 'https://example.test/secret' } })}\n`);
    return true;
  } });
  await assert.rejects(search(h.adapter), safeError('AUTH_REQUIRED'));
  assert.deepEqual(h.responses, [{ id: 900, error: { code: -32601, message: 'User approval must be handled in Codex.' } }]);
  assert.equal(h.child.killed, true);
});

test('times out a pending source request and cleans up the process', async () => {
  const h = harness({ options: { timeoutMs: 25 }, answer: ({ request }) => request.method === 'mcpServer/tool/call' });
  await assert.rejects(search(h.adapter), safeError('UPSTREAM_UNAVAILABLE'));
  assert.equal(h.child.killed, true);
});

test('rejects pending RPC immediately when the child closes', async () => {
  const h = harness({ answer({ request, child }) {
    if (request.method !== 'mcpServer/tool/call') return false;
    child.emit('close', 1); return true;
  } });
  await assert.rejects(search(h.adapter), safeError('UPSTREAM_UNAVAILABLE'));
  assert.equal(h.child.killed, true);
});

test('rejects invalid JSON, oversized RPC messages and total stdout overflow', async () => {
  for (const mode of ['invalid', 'message', 'total']) {
    const h = harness({ options: mode === 'message' ? { maxRpcBytes: 900 } : mode === 'total' ? { maxStdoutBytes: 900 } : {}, answer({ request, child }) {
      if (request.method !== 'mcpServer/tool/call') return false;
      const raw = mode === 'invalid' ? 'not-json\n' : `${JSON.stringify({ id: request.id, result: { structuredContent: { data: 'x'.repeat(1500) } } })}\n`;
      child.stdout.write(raw); return true;
    } });
    await assert.rejects(search(h.adapter), safeError('UPSTREAM_INVALID'));
    assert.equal(h.child.killed, true);
  }
});

test('does not accept malformed or ambiguous text envelopes', async () => {
  for (const content of [[], [{ type: 'text', text: 'secret invalid json' }], [{ type: 'text', text: '{}' }, { type: 'text', text: '{}' }], [{ type: 'image', data: 'secret' }]]) {
    const h = harness({ answer({ request, send }) {
      if (request.method !== 'mcpServer/tool/call') return false;
      send({ content }); return true;
    } });
    try { await assert.rejects(search(h.adapter), safeError('UPSTREAM_INVALID')); }
    finally { h.adapter.close(); }
  }
});

test('handles paginated inventory while keeping unrelated tool metadata private', async () => {
  let page = 0;
  const h = harness({ answer({ request, send }) {
    if (request.method !== 'mcpServerStatus/list') return false;
    page++;
    if (page === 1) send({ data: [{ name: 'other', tools: { private_tool: {} } }], nextCursor: 'next' });
    else { assert.equal(request.params.cursor, 'next'); send({ data: [source()], nextCursor: null }); }
    return true;
  } });
  try { assert.deepEqual(await search(h.adapter), data); assert.equal(page, 2); }
  finally { h.adapter.close(); }
});

test('close is idempotent and prevents later spawning or calls', async () => {
  const h = harness(); h.adapter.close(); h.adapter.close();
  await assert.rejects(search(h.adapter), safeError('UPSTREAM_UNAVAILABLE'));
  assert.equal(h.launches.length, 0);
});

test('keeps one process healthy across 45 valid replies totaling more than 16 MiB', async () => {
  const payload = 'x'.repeat(512 * 1024);
  let replies = 0, replyBytes = 0;
  const h = harness({ answer({ request, send }) {
    if (request.method !== 'mcpServer/tool/call') return false;
    const result = { structuredContent: { release_id: 'release-1', data: { payload } } };
    replyBytes += Buffer.byteLength(JSON.stringify({ id: request.id, result }));
    replies++;
    send(result);
    return true;
  } });
  try {
    for (let call = 0; call < 45; call++) {
      const result = await search(h.adapter);
      assert.equal(result.data.payload.length, payload.length);
    }
    assert.equal(replies, 45);
    assert.ok(replyBytes > 16 * 1024 * 1024);
    assert.equal(h.launches.length, 1);
    assert.equal(h.child.killed, false);
  } finally { h.adapter.close(); }
});

test('still rejects notification spray exceeding one pending RPC stdout budget', async () => {
  const h = harness({ options: { maxRpcBytes: 1024, maxStdoutBytes: 1500 }, answer({ request, child }) {
    if (request.method !== 'mcpServer/tool/call') return false;
    const notification = `${JSON.stringify({ method: 'source/status', params: { padding: 'x'.repeat(600) } })}\n`;
    for (let chunk = 0; chunk < 4; chunk++) child.stdout.write(notification);
    return true;
  } });
  await assert.rejects(search(h.adapter), safeError('UPSTREAM_INVALID'));
  assert.equal(h.child.killed, true);
});
