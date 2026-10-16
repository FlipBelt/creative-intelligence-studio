import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { getMockJsonSchemas, TOOL_CONTRACTS } from '../../contracts/mock-mcp.mjs';
import { FIXTURE_NOW, MOCK_INSTRUCTION } from '../../tools/mock-mcp/fixtures.mjs';
import { createMockService } from '../../tools/mock-mcp/service.mjs';
import { errorCode, success } from './behavior.mjs';

test('generated JSON Schema performs real validation rather than documenting unchecked shapes', () => {
  const schemas = getMockJsonSchemas();
  const validator = new AjvJsonSchemaValidator();
  const input = validator.getValidator(schemas.mock_wireframe_create.input);
  assert.equal(input(MOCK_INSTRUCTION).valid, true);
  assert.equal(input({ ...MOCK_INSTRUCTION, raw_uri: '//nas/private' }).valid, false);
  const output = createMockService().invoke('mock_wireframe_create', MOCK_INSTRUCTION).structuredContent;
  const validateOutput = validator.getValidator(schemas.mock_wireframe_create.output);
  assert.equal(validateOutput(output).valid, true);
  assert.equal(validateOutput({ ...output, synthetic: false }).valid, false);
  const changed = structuredClone(output);
  changed.wireframe.facts[0].level = 'verified_by_ai';
  assert.equal(validateOutput(changed).valid, false);
  assert.equal(TOOL_CONTRACTS.mock_wireframe_create.output.safeParse(changed).success, false);
});

test('expiry is checked again at mock registration and source data cannot mutate stored lineage', () => {
  const service = createMockService();
  const wireframe = success(service.invoke('mock_wireframe_create', MOCK_INSTRUCTION)).wireframe;
  const originalDigest = wireframe.input_digest;
  wireframe.instruction.brief = 'Caller attempted to alter the reviewed instruction';
  wireframe.input_digest = '0'.repeat(64);
  const receipt = success(service.invoke('mock_dam_register', {
    project_id: MOCK_INSTRUCTION.project_id, wireframe_id: wireframe.id,
    review_ticket_id: 'mock_review_approved_v1', idempotency_key: 'mock_mutation_check', failure_fixture: 'mock_none',
  })).receipt;
  assert.equal(receipt.input_digest, originalDigest);
  let now = FIXTURE_NOW;
  const expired = createMockService({ now: () => now });
  const pending = success(expired.invoke('mock_wireframe_create', MOCK_INSTRUCTION)).wireframe;
  now = '2026-10-17T00:00:00.000Z';
  errorCode(expired.invoke('mock_dam_register', {
    project_id: MOCK_INSTRUCTION.project_id, wireframe_id: pending.id,
    review_ticket_id: 'mock_review_approved_v1', idempotency_key: 'mock_expiry_check', failure_fixture: 'mock_none',
  }), 'MOCK_LICENSE_EXPIRED');
});
