import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { request } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { DEFAULT_INHERITED_ENV_VARS, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startMockServer } from '../../tools/mock-mcp/http.mjs';
import { runBehavior, runReadOnlyBehavior } from './behavior.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
async function connect(kind, principal = 'mock_designer') {
  const client = new Client({ name: 'cis-mock-contract-test', version: '0.1.0' });
  let server;
  let transport;
  if (kind === 'stdio') {
    // Override the SDK's ambient defaults. No cloud/provider variables or user config directories are inherited.
    const env = Object.fromEntries(DEFAULT_INHERITED_ENV_VARS.map((name) => [name, '']));
    if (process.platform === 'win32') env.SYSTEMROOT = process.env.SYSTEMROOT ?? 'C:\\Windows';
    transport = new StdioClientTransport({ command: process.execPath,
      args: ['tools/mock-mcp/stdio.mjs', `--principal=${principal}`], cwd: root, env, stderr: 'pipe' });
  } else {
    server = await startMockServer({ principal });
    assert.equal(server.address.address, '127.0.0.1');
    assert.ok(server.address.port > 0);
    transport = new StreamableHTTPClientTransport(server.url);
  }
  try {
    await client.connect(transport);
  } catch (error) {
    await transport.close();
    await server?.close();
    throw error;
  }
  return { client, server, async close() { await client.close(); await server?.close(); } };
}

for (const kind of ['stdio', 'http']) {
  test(`${kind}: SDK initialize/tools/list/tools/call behavior contract`, { timeout: 20_000 }, async (t) => {
    const connection = await connect(kind);
    try { await runBehavior(t, connection.client); } finally { await connection.close(); }
  });
  test(`${kind}: configured viewer cannot write or self-promote`, { timeout: 10_000 }, async () => {
    const connection = await connect(kind, 'mock_viewer');
    try { await runReadOnlyBehavior(connection.client); } finally { await connection.close(); }
  });
}

test('HTTP is loopback-only and refuses foreign Host/Origin and unrelated routes', async () => {
  const server = await startMockServer();
  const status = (headers) => new Promise((resolve, reject) => {
    const req = request(server.url, { headers }, (response) => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject);
    req.end();
  });
  try {
    assert.equal(await status({ Host: 'example.invalid' }), 403);
    assert.equal(await status({ Origin: 'https://example.invalid' }), 403);
    assert.equal((await fetch(new URL('/private', server.url))).status, 404);
  } finally { await server.close(); }
});
