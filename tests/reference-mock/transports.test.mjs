import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { DEFAULT_INHERITED_ENV_VARS, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { REFERENCE_TOOL_CONTRACTS } from '../../contracts/reference-collection.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
async function connect(principal = 'mock_designer') {
  const client = new Client({ name: 'cis-reference-contract-test', version: '0.1.0' });
  const env = Object.fromEntries(DEFAULT_INHERITED_ENV_VARS.map((name) => [name, '']));
  if (process.platform === 'win32') env.SYSTEMROOT = process.env.SYSTEMROOT ?? 'C:\\Windows';
  const transport = new StdioClientTransport({ command: process.execPath,
    args: ['tools/mock-mcp/reference-stdio.mjs', `--principal=${principal}`], cwd: root, env, stderr: 'pipe' });
  try { await client.connect(transport); } catch (error) { await transport.close(); throw error; }
  return client;
}
const createInput = { project_id: 'mock_project_alpha', source_type: 'mock_keyword',
  query_or_url: 'fixture-private-query', max_results: 3, budget_cap_usd: 0.03,
  idempotency_key: 'mock_stdio_create', failure_fixture: 'mock_none' };

test('reference stdio: SDK initialize/tools/list/tools/call synthetic lifecycle', { timeout: 15_000 }, async () => {
  const client = await connect();
  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), Object.keys(REFERENCE_TOOL_CONTRACTS).sort());
    assert.equal(listed.tools.find((tool) => tool.name === 'mock_delete_reference_collection_job').annotations.destructiveHint, true);
    const created = await client.callTool({ name: 'mock_create_reference_collection_job', arguments: createInput });
    assert.notEqual(created.isError, true);
    const job = created.structuredContent.job;
    assert.equal(created.structuredContent.synthetic, true);
    assert.equal(JSON.stringify(created).includes(createInput.query_or_url), false);
    const listedRefs = await client.callTool({ name: 'mock_list_external_references',
      arguments: { project_id: createInput.project_id, job_id: job.id, limit: 2 } });
    assert.equal(listedRefs.structuredContent.references.length, 2);
    assert.equal(listedRefs.structuredContent.has_more, true);
    const ref = listedRefs.structuredContent.references[0];
    const read = await client.callTool({ name: 'mock_get_external_reference',
      arguments: { project_id: createInput.project_id, reference_id: ref.id } });
    assert.deepEqual(read.structuredContent.reference, ref);
    const selected = await client.callTool({ name: 'mock_select_references',
      arguments: { project_id: createInput.project_id, reference_ids: [ref.id, ref.id],
        expected_revision: 0, idempotency_key: 'mock_stdio_selection' } });
    assert.equal(selected.structuredContent.selection.reference_ids.length, 1);
    const deleted = await client.callTool({ name: 'mock_delete_reference_collection_job',
      arguments: { project_id: createInput.project_id, job_id: job.id } });
    assert.equal(deleted.structuredContent.removed_selection_count, 1);
    const missing = await client.callTool({ name: 'mock_get_reference_collection_job',
      arguments: { project_id: createInput.project_id, job_id: job.id } });
    assert.equal(missing.isError, true);
    assert.equal(missing.structuredContent, undefined);
    assert.equal(JSON.parse(missing.content[0].text).code, 'MOCK_NOT_FOUND');
    const rejected = await client.callTool({ name: 'mock_create_reference_collection_job',
      arguments: { ...createInput, role: 'fixture-secret-role' } });
    assert.equal(rejected.isError, true);
    assert.equal(JSON.stringify(rejected).includes('fixture-secret-role'), false);
  } finally { await client.close(); }
});
test('reference stdio: launch anonymous and viewer fixtures enforce auth boundaries', { timeout: 15_000 }, async () => {
  for (const [principal, code] of [['mock_anonymous', 'MOCK_UNAUTHENTICATED'], ['mock_viewer', 'MOCK_FORBIDDEN']]) {
    const client = await connect(principal);
    try {
      const result = await client.callTool({ name: 'mock_create_reference_collection_job', arguments: createInput });
      assert.equal(result.isError, true);
      assert.equal(JSON.parse(result.content[0].text).code, code);
      assert.equal(JSON.stringify(result).includes(createInput.query_or_url), false);
    } finally { await client.close(); }
  }
});
