import assert from 'node:assert/strict';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { CONTRACT_VERSION, ErrorSchema } from '../../contracts/mock-mcp.mjs';
import { MOCK_INSTRUCTION } from '../../tools/mock-mcp/fixtures.mjs';

export async function call(client, name, args) {
  return client.callTool({ name, arguments: args });
}
export function errorCode(result, expected) {
  assert.equal(result.isError, true);
  const error = ErrorSchema.parse(JSON.parse(result.content[0].text));
  assert.equal(error.code, expected);
  return error;
}
export function success(result) {
  assert.notEqual(result.isError, true, JSON.stringify(result.content));
  assert.equal(result.structuredContent.synthetic, true);
  assert.equal(result.structuredContent.contract_version, CONTRACT_VERSION);
  return result.structuredContent;
}

// Every case runs unchanged over SDK stdio and SDK Streamable HTTP clients.
export async function runBehavior(t, client) {
  let wireframe;
  const registration = (overrides = {}) => ({
    project_id: MOCK_INSTRUCTION.project_id, wireframe_id: wireframe.id,
    review_ticket_id: 'mock_review_approved_v1', idempotency_key: 'mock_operation_first',
    failure_fixture: 'mock_none', ...overrides,
  });
  await t.test('initialize and tools/list expose strict versioned contracts', async () => {
    assert.equal(client.getServerVersion().name, 'cis-synthetic-mock');
    assert.ok(client.getServerCapabilities().tools);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), [
      'mock_asset_search', 'mock_dam_register', 'mock_knowledge_read', 'mock_wireframe_create',
    ]);
    const validator = new AjvJsonSchemaValidator();
    for (const tool of tools) {
      assert.equal(tool.inputSchema.additionalProperties, false);
      assert.ok(tool.outputSchema);
      assert.equal(validator.getValidator(tool.inputSchema)({ uri: 'http://127.0.0.1/private' }).valid, false);
    }
  });
  await t.test('knowledge retains synthetic A/B/C/D/U provenance and unknown values', async () => {
    const data = success(await call(client, 'mock_knowledge_read', {
      project_id: MOCK_INSTRUCTION.project_id, product_id: MOCK_INSTRUCTION.product_id,
    }));
    assert.equal(data.version, 'mock_v1');
    assert.deepEqual(data.facts.map((fact) => fact.level), ['A', 'B', 'C', 'D', 'U']);
    assert.equal(data.facts.find((fact) => fact.level === 'U').value, null);
    assert.ok(data.facts.every((fact) => fact.source_id.startsWith('mock_') && fact.source_version === 'mock_v1'));
  });
  await t.test('assets expose scoped permission and deterministic expiry', async () => {
    const data = success(await call(client, 'mock_asset_search', { project_id: MOCK_INSTRUCTION.project_id, query: '' }));
    assert.deepEqual(data.assets.map((asset) => asset.rights_status), ['usable', 'expired']);
    assert.ok(data.assets.every((asset) => asset.uri.startsWith('mock-asset://')));
    assert.deepEqual(data.assets[0].allowed_use, ['internal_wireframe']);
    assert.deepEqual(success(await call(client, 'mock_asset_search', {
      project_id: MOCK_INSTRUCTION.project_id, query: 'no_match',
    })).assets, []);
  });
  await t.test('wireframe has editable nodes, fixed input and retained lineage', async () => {
    wireframe = success(await call(client, 'mock_wireframe_create', MOCK_INSTRUCTION)).wireframe;
    assert.equal(wireframe.editable, true);
    assert.equal(wireframe.format, 'mock_editable_nodes_v1');
    assert.equal(wireframe.review_state, 'waiting_for_fixture_review');
    assert.deepEqual(wireframe.instruction, MOCK_INSTRUCTION);
    assert.deepEqual(wireframe.parent_asset_ids, [MOCK_INSTRUCTION.asset_id]);
    assert.ok(wireframe.nodes.some((node) => node.type === 'text' && node.source_level === 'U'));
  });
  await t.test('URI injection, missing fields and role spoofing fail input validation', async () => {
    for (const args of [
      { ...MOCK_INSTRUCTION, uri: 'http://127.0.0.1/private' },
      { ...MOCK_INSTRUCTION, role: 'reviewer' },
      { ...MOCK_INSTRUCTION, asset_id: '../../nas/private' },
      {},
    ]) {
      const result = await call(client, 'mock_wireframe_create', args);
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /Input validation error/);
    }
  });
  await t.test('cross-tenant access and out-of-scope or expired assets are refused', async () => {
    errorCode(await call(client, 'mock_knowledge_read', {
      project_id: 'mock_project_beta', product_id: MOCK_INSTRUCTION.product_id,
    }), 'MOCK_FORBIDDEN');
    errorCode(await call(client, 'mock_wireframe_create', {
      ...MOCK_INSTRUCTION, asset_id: 'mock_asset_expired',
    }), 'MOCK_LICENSE_EXPIRED');
    errorCode(await call(client, 'mock_wireframe_create', {
      ...MOCK_INSTRUCTION, usage: 'campaign_public',
    }), 'MOCK_LICENSE_SCOPE');
  });
  await t.test('mock registration requires explicit approval for the exact input', async () => {
    for (const review_ticket_id of ['mock_review_missing', 'mock_review_rejected_v1']) {
      errorCode(await call(client, 'mock_dam_register', registration({ review_ticket_id })), 'MOCK_REVIEW_REQUIRED');
    }
    const changed = success(await call(client, 'mock_wireframe_create', {
      ...MOCK_INSTRUCTION, input_version: 'mock_v2', brief: 'Changed synthetic brief',
    })).wireframe;
    errorCode(await call(client, 'mock_dam_register', registration({ wireframe_id: changed.id })), 'MOCK_REVIEW_STALE');
  });
  await t.test('same-key replay yields one receipt and changed input conflicts', async () => {
    const first = success(await call(client, 'mock_dam_register', registration())).receipt;
    const replay = success(await call(client, 'mock_dam_register', registration())).receipt;
    assert.equal(first.status, 'mock_registered');
    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(replay.id, first.id);
    assert.equal(replay.attempt, 1);
    errorCode(await call(client, 'mock_dam_register', registration({ review_ticket_id: 'mock_review_rejected_v1' })),
      'MOCK_IDEMPOTENCY_CONFLICT');
  });
  await t.test('synthetic transient failure retries the same intent without duplication', async () => {
    const command = registration({ idempotency_key: 'mock_operation_retry', failure_fixture: 'mock_transient_once' });
    const error = errorCode(await call(client, 'mock_dam_register', command), 'MOCK_TRANSIENT_UNAVAILABLE');
    assert.equal(error.retryable, true);
    errorCode(await call(client, 'mock_dam_register', { ...command, failure_fixture: 'mock_none' }), 'MOCK_IDEMPOTENCY_CONFLICT');
    const retried = success(await call(client, 'mock_dam_register', command)).receipt;
    assert.equal(retried.attempt, 2);
    assert.equal(retried.replayed, false);
    assert.equal(success(await call(client, 'mock_dam_register', command)).receipt.id, retried.id);
  });
}

export async function runReadOnlyBehavior(client) {
  success(await call(client, 'mock_knowledge_read', {
    project_id: MOCK_INSTRUCTION.project_id, product_id: MOCK_INSTRUCTION.product_id,
  }));
  errorCode(await call(client, 'mock_wireframe_create', MOCK_INSTRUCTION), 'MOCK_FORBIDDEN');
  errorCode(await call(client, 'mock_dam_register', {
    project_id: MOCK_INSTRUCTION.project_id, wireframe_id: 'mock_wireframe_unknown',
    review_ticket_id: 'mock_review_approved_v1', idempotency_key: 'mock_operation_viewer', failure_fixture: 'mock_none',
  }), 'MOCK_FORBIDDEN');
}
