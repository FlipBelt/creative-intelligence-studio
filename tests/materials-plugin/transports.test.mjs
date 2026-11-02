import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { TOOL_DEFINITIONS, serveMaterialMcp } from "../../plugins/cis-materials/lib/mcp-stdio.mjs";

const libraryUrl = new URL("../../plugins/cis-materials/lib/mcp-stdio.mjs", import.meta.url).href;
const SECRET = "TRANSPORT_TEST_SECRET_DO_NOT_ECHO";
const argsFor = {
  search_materials: { query: "fixture" },
  read_material: { page_id: "page-a", asset_id: "asset-a", expected_release: "rel-1" },
  list_collections: { query: "fixture", limit: 5 },
  get_collection: { page_id: "page-a", expected_release: "rel-1" },
};
const success = (name, input) => ({ ok: true, data: { source: "synthetic_transport_fixture", tool: name, input,
  download_enabled: false, rights_status: "unknown" } });
const init = version => ({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
  protocolVersion: version, capabilities: {}, clientInfo: { name: "transport-test", version: "1" } } });

function harness(t, invoke = async (name, args) => success(name, args)) {
  const input = new PassThrough(), output = new PassThrough(), messages = [], waiters = [], calls = [];
  let text = "", closedCount = 0;
  output.on("data", chunk => {
    text += chunk.toString();
    let end;
    while ((end = text.indexOf("\n")) !== -1) {
      const value = JSON.parse(text.slice(0, end));
      text = text.slice(end + 1);
      if (waiters.length) waiters.shift()(value); else messages.push(value);
    }
  });
  const closed = serveMaterialMcp({ service: { async invoke(name, args) { calls.push([name, args]); return invoke(name, args); } },
    input, output, onClose() { closedCount++; } });
  const next = async () => {
    if (messages.length) return messages.shift();
    let timer;
    try { return await Promise.race([new Promise(resolve => waiters.push(resolve)),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("No JSON-RPC response")), 1500); })]); }
    finally { clearTimeout(timer); }
  };
  t.after(async () => { input.end(); await closed; output.destroy(); });
  const send = value => input.write(JSON.stringify(value) + "\n");
  const ready = async () => {
    send(init("2025-11-25")); assert.equal((await next()).result.protocolVersion, "2025-11-25");
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "ping" }); assert.deepEqual((await next()).result, {});
  };
  return { input, output, calls, next, send, ready, closed, closedCount: () => closedCount };
}

test("stdio: real SDK initialize/list/call uses synthetic service, not Core or provider proof", async t => {
  const fixture = `import { serveMaterialMcp } from ${JSON.stringify(libraryUrl)};
    const service = { async invoke(name,args) {
      if(args.query==="deny") return {ok:false,error:{code:"ACCESS_DENIED",message:"Synthetic denial."}};
      if(args.query==="throw") throw new Error(${JSON.stringify(SECRET)});
      return {ok:true,data:{source:"synthetic_transport_fixture",tool:name,input:args,download_enabled:false,rights_status:"unknown"}};
    }};
    await serveMaterialMcp({service});`;
  const transport = new StdioClientTransport({ command: process.execPath, args: ["--input-type=module", "-e", fixture], stderr: "pipe" });
  let stderr = "";
  transport.stderr.on("data", chunk => { stderr += chunk.toString(); });
  const client = new Client({ name: "cis-transport-test", version: "1" });
  t.after(async () => { await client.close(); assert.equal(stderr, ""); });
  await client.connect(transport);
  assert.equal(client.getServerVersion().name, "cis-materials-readonly");
  assert.match(client.getInstructions(), /download_enabled=false/);
  const list = await client.listTools();
  assert.deepEqual(list.tools, TOOL_DEFINITIONS);
  for (const tool of list.tools) {
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.deepEqual(tool.annotations, { readOnlyHint: true, destructiveHint: false, openWorldHint: true });
    const expected = success(tool.name, argsFor[tool.name]);
    const result = await client.callTool({ name: tool.name, arguments: argsFor[tool.name] });
    assert.deepEqual(result.structuredContent, expected);
    assert.deepEqual(JSON.parse(result.content[0].text), expected);
    assert.notEqual(result.isError, true);
  }
  const denied = await client.callTool({ name: "search_materials", arguments: { query: "deny" } });
  assert.equal(denied.isError, true);
  assert.deepEqual(denied.structuredContent, { ok: false, error: { code: "ACCESS_DENIED", message: "Synthetic denial." } });
  const thrown = await client.callTool({ name: "search_materials", arguments: { query: "throw" } });
  assert.equal(thrown.isError, true);
  assert.equal(thrown.structuredContent.error.code, "UPSTREAM_UNAVAILABLE");
  assert.ok(!JSON.stringify(thrown).includes(SECRET));
  await assert.rejects(client.callTool({ name: "search_materials", arguments: { query: "fixture", role: SECRET } }), /Invalid parameters/);
});

for (const version of ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07", "unsupported"]) {
  test("stdio: protocol negotiation " + version, async t => {
    const h = harness(t);
    h.send(init(version));
    const response = await h.next();
    assert.equal(response.result.protocolVersion, version === "unsupported" ? "2025-11-25" : version);
    assert.deepEqual(response.result.capabilities, { tools: { listChanged: false } });
    assert.match(response.result.instructions, /not human-curated/);
    assert.deepEqual(h.calls, []);
  });
}

test("stdio: malformed JSON/envelopes and unsupported methods never invoke or echo payload", async t => {
  const h = harness(t);
  h.input.write("not json " + SECRET + "\n");
  assert.deepEqual((await h.next()).error, { code: -32700, message: "Invalid JSON." });
  for (const invalid of [[], { jsonrpc: "2.0", id: null, method: SECRET }, { jsonrpc: "1.0", id: 5, method: SECRET },
    { jsonrpc: "2.0", id: 5, method: "ping", result: SECRET }]) {
    h.send(invalid);
    const error = await h.next(); assert.equal(error.error.code, -32600); assert.ok(!JSON.stringify(error).includes(SECRET));
  }
  await h.ready();
  for (const method of ["write_material", "resources/list", "prompts/list", SECRET]) {
    h.send({ jsonrpc: "2.0", id: 9, method, params: { secret: SECRET } });
    const error = await h.next();
    assert.deepEqual(error.error, { code: -32601, message: "Method not found." });
    assert.ok(!JSON.stringify(error).includes(SECRET));
  }
  h.send({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: SECRET, arguments: {} } });
  const unknown = await h.next(); assert.equal(unknown.error.code, -32602); assert.ok(!JSON.stringify(unknown).includes(SECRET));
  assert.deepEqual(h.calls, []);
});

test("stdio: tool schema validates only generic shape and rejects unknown/oversized arguments", async t => {
  const h = harness(t); await h.ready();
  for (const args of [{}, { query: "" }, { query: "a".repeat(121) }, { query: 4 }, { query: "ok", limit: 0 },
    { query: "ok", limit: 6 }, { query: "ok", limit: 1.2 }, { query: "ok", role: SECRET }]) {
    h.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search_materials", arguments: args } });
    const error = await h.next(); assert.equal(error.error.code, -32602); assert.ok(!JSON.stringify(error).includes(SECRET));
  }
  h.send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "read_material",
    arguments: { page_id: "page-a", asset_id: "../secret", expected_release: "rel-1" } } });
  assert.equal((await h.next()).error.code, -32602);
  assert.deepEqual(h.calls, []);
  // A URL-like keyword is not decided here; the real Core must reject it.
  h.send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "search_materials", arguments: { query: "https://example.invalid" } } });
  assert.equal((await h.next()).result.structuredContent.ok, true);
  assert.equal(h.calls.length, 1);
});

test("stdio: tools require initialization and notifications never trigger service calls", async t => {
  const h = harness(t);
  h.send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.equal((await h.next()).error.code, -32000);
  await h.ready();
  h.send({ jsonrpc: "2.0", method: "tools/call", params: { name: "search_materials", arguments: { query: SECRET } } });
  h.send({ jsonrpc: "2.0", id: 6, method: "ping" });
  assert.deepEqual((await h.next()).result, {});
  assert.deepEqual(h.calls, []);
});

test("stdio: malformed service results produce fixed errors without raw exception or extra fields", async t => {
  const h = harness(t, async () => ({ ok: true, data: {}, debug: SECRET })); await h.ready();
  h.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search_materials", arguments: { query: "ok" } } });
  const response = await h.next();
  assert.equal(response.result.isError, true);
  assert.equal(response.result.structuredContent.error.code, "UPSTREAM_INVALID");
  assert.ok(!JSON.stringify(response).includes(SECRET));
});

test("stdio: line byte limit discards until newline and then accepts a valid request", async t => {
  const h = harness(t); await h.ready();
  h.input.write(Buffer.alloc(1024 * 1024 + 1, 120));
  const overflow = await h.next();
  assert.deepEqual(overflow.error, { code: -32600, message: "Request too large." });
  h.input.write("\n");
  h.send({ jsonrpc: "2.0", id: 3, method: "ping" });
  assert.deepEqual((await h.next()).result, {});
  assert.deepEqual(h.calls, []);
});

test("stdio: invalid UTF-8 is a fixed parse error", async t => {
  const h = harness(t);
  h.input.write(Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125, 10]));
  assert.deepEqual((await h.next()).error, { code: -32700, message: "Invalid JSON." });
  assert.deepEqual(h.calls, []);
});

test("stdio: at most eight active/queued requests and overload does not invoke service", async t => {
  let release;
  const h = harness(t, async (name, args) => {
    if (!release) await new Promise(resolve => { release = resolve; });
    return success(name, args);
  });
  await h.ready();
  for (let id = 10; id < 19; id++) h.send({ jsonrpc: "2.0", id, method: "tools/call",
    params: { name: "search_materials", arguments: { query: "fixture" } } });
  const busy = await h.next();
  assert.equal(busy.id, 18); assert.deepEqual(busy.error, { code: -32000, message: "Server busy." });
  assert.equal(h.calls.length, 1);
  release();
  for (let i = 0; i < 8; i++) assert.equal((await h.next()).result.structuredContent.ok, true);
  assert.equal(h.calls.length, 8);
});

test("stdio: EOF/close calls adapter cleanup once without awaiting a stalled service", async t => {
  let started;
  const calling = new Promise(resolve => { started = resolve; });
  const h = harness(t, async () => { started(); return new Promise(() => {}); });
  await h.ready();
  h.send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search_materials", arguments: { query: "fixture" } } });
  await calling;
  h.input.end();
  let timer;
  try { await Promise.race([h.closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("EOF hung")), 250); })]); }
  finally { clearTimeout(timer); }
  h.input.destroy();
  assert.equal(h.closedCount(), 1);
});

test("stdio: a delayed output failure after input EOF is handled without raw errors", async t => {
  const input = new PassThrough();
  let cleanup = 0;
  const output = new Writable({ write(_chunk, _encoding, callback) {
    setImmediate(() => { input.end(); setImmediate(() => callback(new Error(SECRET))); });
  } });
  let timer;
  const outputClosed = new Promise(resolve => output.once("close", resolve));
  const closed = serveMaterialMcp({ service: { invoke: async (name, args) => success(name, args) },
    input, output, onClose() { cleanup++; } });
  t.after(() => { input.destroy(); output.destroy(); clearTimeout(timer); });
  input.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }) + "\n");
  await closed;
  try {
    await Promise.race([outputClosed, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Output did not close")), 500);
    })]);
  } finally { clearTimeout(timer); }
  assert.equal(cleanup, 1);
});
