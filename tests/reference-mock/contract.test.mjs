import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { getReferenceJsonSchemas, REFERENCE_TOOL_CONTRACTS } from '../../contracts/reference-collection.mjs';
import { createReferenceMockFixture, createReferenceMockService } from '../../tools/mock-mcp/reference-service.mjs';

const createTool = 'mock_create_reference_collection_job';
const statusTool = 'mock_get_reference_collection_job';
const listTool = 'mock_list_external_references';
const getTool = 'mock_get_external_reference';
const selectTool = 'mock_select_references';
const deleteTool = 'mock_delete_reference_collection_job';
const project = 'mock_project_alpha';
const input = (overrides = {}) => ({ project_id: project, source_type: 'mock_keyword',
  query_or_url: 'synthetic running layout', max_results: 5, budget_cap_usd: 0.05,
  idempotency_key: 'mock_create_one', failure_fixture: 'mock_none', ...overrides });
function success(result) {
  assert.notEqual(result.isError, true);
  assert.equal(result.structuredContent.synthetic, true);
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  return result.structuredContent;
}
function failure(result, code, status) {
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  const data = JSON.parse(result.content[0].text);
  assert.equal(data.code, code);
  assert.equal(data.message, code);
  if (status) assert.equal(data.status_code, status);
  assert.equal(data.synthetic, true);
  assert.equal(data.capabilities.real_provider_configured, false);
  return data;
}
function collect(service, overrides = {}) {
  const job = success(service.invoke(createTool, input(overrides))).job;
  const refs = success(service.invoke(listTool, { project_id: project, job_id: job.id, limit: 20 })).references;
  return { job, refs };
}
const select = (refs, overrides = {}) => ({ project_id: project, reference_ids: refs.map((ref) => ref.id),
  expected_revision: 0, idempotency_key: 'mock_select_one', ...overrides });

test('reference: generated strict JSON schemas validate the same runtime shapes', () => {
  const validator = new AjvJsonSchemaValidator();
  const schemas = getReferenceJsonSchemas();
  assert.equal(Object.keys(schemas).length, 6);
  for (const schema of Object.values(schemas)) {
    assert.equal(schema.input.additionalProperties, false);
    assert.equal(schema.output.additionalProperties, false);
  }
  const validate = validator.getValidator(schemas[createTool].input);
  assert.equal(validate(input()).valid, true);
  assert.equal(validate(input({ role: 'owner' })).valid, false);
  const service = createReferenceMockService();
  const output = success(service.invoke(createTool, input()));
  assert.equal(validator.getValidator(schemas[createTool].output)(output).valid, true);
  assert.equal(validator.getValidator(schemas[createTool].output)({ ...output, synthetic: false }).valid, false);
  assert.equal(REFERENCE_TOOL_CONTRACTS[createTool].output.safeParse({ ...output, unexpected: true }).success, false);
});

test('reference: canonical candidate URL is never fetched, stored or echoed as source data', () => {
  const service = createReferenceMockService();
  const candidate = 'https://www.pinterest.com/pin/123456789/';
  const { job, refs } = collect(service, { source_type: 'mock_pin_url', query_or_url: candidate });
  assert.equal(job.execution, 'synchronous_fixture');
  assert.equal(job.simulated_cost_usd, 0.05);
  assert.equal(job.real_billing, false);
  for (const ref of refs) {
    assert.match(ref.source_url, /^https:\/\/example\.invalid\//);
    assert.equal(ref.rights_status, 'unknown');
    assert.equal(ref.usage_granted, false);
    assert.equal(ref.third_party_processing, false);
    assert.equal(JSON.stringify(ref).includes(candidate), false);
    assert.deepEqual(success(service.invoke(getTool, { project_id: project, reference_id: ref.id })).reference, ref);
  }
  assert.equal(JSON.stringify(success(service.invoke(statusTool, { project_id: project, job_id: job.id }))).includes(candidate), false);
});

test('reference: all success envelopes keep provider, permission and billing gates closed', () => {
  const service = createReferenceMockService();
  const { job, refs } = collect(service);
  const selection = success(service.invoke(selectTool, select(refs)));
  assert.equal(selection.capabilities.provider_mode, 'synthetic_only');
  assert.equal(selection.capabilities.provider_eligibility, 'eligibility_unknown');
  assert.equal(selection.capabilities.real_data_persistence, 'persistence_not_authorized');
  assert.equal(selection.capabilities.authorization_scope, 'launch_fixture_only');
  assert.equal(selection.selection.human_review, false);
  assert.equal(selection.selection.usage_granted, false);
  assert.equal(success(service.invoke(statusTool, { project_id: project, job_id: job.id })).job.id, job.id);
});

test('reference: deterministic creation and same-key replay cannot duplicate fixtures', () => {
  const service = createReferenceMockService();
  const first = success(service.invoke(createTool, input()));
  const replay = success(service.invoke(createTool, input()));
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual(first.job, replay.job);
  assert.deepEqual(success(createReferenceMockService().invoke(createTool, input())).job, first.job);
  failure(service.invoke(createTool, input({ query_or_url: 'changed candidate' })), 'MOCK_IDEMPOTENCY_CONFLICT', 409);
  failure(service.invoke(createTool, input({ max_results: 4 })), 'MOCK_IDEMPOTENCY_CONFLICT', 409);
});

test('reference: unknown fields and role/tenant spoofing are rejected without payload echo', () => {
  const service = createReferenceMockService();
  const secret = 'fixture-sensitive-token-do-not-echo';
  for (const field of ['role', 'tenant', 'tenant_id', 'principal', 'access_token', 'unexpected']) {
    const result = service.invoke(createTool, input({ [field]: secret }));
    failure(result, 'MOCK_INVALID_INPUT', 400);
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(JSON.stringify(result).includes('synthetic running layout'), false);
  }
  failure(service.invoke('real_pinterest_search', input()), 'MOCK_INVALID_INPUT', 400);
  assert.throws(() => createReferenceMockService({ principal: secret }), /MOCK_INVALID_LAUNCH_FIXTURE/);
});

test('reference: launch-only authentication distinguishes 401 and 403', () => {
  failure(createReferenceMockService({ principal: 'mock_anonymous' }).invoke(createTool, input()), 'MOCK_UNAUTHENTICATED', 401);
  for (const principal of ['mock_viewer', 'mock_outsider']) {
    failure(createReferenceMockService({ principal }).invoke(createTool, input()), 'MOCK_FORBIDDEN', 403);
  }
  failure(createReferenceMockService().invoke(createTool, input({ project_id: 'mock_project_unknown' })), 'MOCK_FORBIDDEN', 403);
});

test('reference: resource checks are bound to both project and owner without existence leaks', () => {
  const fixture = createReferenceMockFixture();
  const designer = fixture.createService();
  const colleague = fixture.createService({ principal: 'mock_colleague' });
  const outsider = fixture.createService({ principal: 'mock_outsider' });
  const { job, refs } = collect(designer);
  const cases = [
    [statusTool, { project_id: project, job_id: job.id }, { project_id: project, job_id: 'mock_nonexistent' }],
    [listTool, { project_id: project, job_id: job.id, limit: 5 }, { project_id: project, job_id: 'mock_nonexistent', limit: 5 }],
    [getTool, { project_id: project, reference_id: refs[0].id }, { project_id: project, reference_id: 'mock_nonexistent' }],
    [selectTool, select(refs), select([{ id: 'mock_nonexistent' }])],
    [deleteTool, { project_id: project, job_id: job.id }, { project_id: project, job_id: 'mock_nonexistent' }],
  ];
  for (const [tool, existing, absent] of cases) {
    assert.deepEqual(failure(colleague.invoke(tool, existing), 'MOCK_NOT_FOUND', 404),
      failure(colleague.invoke(tool, absent), 'MOCK_NOT_FOUND', 404));
    assert.deepEqual(failure(outsider.invoke(tool, existing), 'MOCK_FORBIDDEN', 403),
      failure(outsider.invoke(tool, absent), 'MOCK_FORBIDDEN', 403));
  }
  failure(designer.invoke(statusTool, { project_id: 'mock_project_beta', job_id: job.id }), 'MOCK_FORBIDDEN', 403);
  const other = collect(colleague, { idempotency_key: 'mock_colleague_job' });
  failure(designer.invoke(getTool, { project_id: project, reference_id: other.refs[0].id }), 'MOCK_NOT_FOUND', 404);
});

test('reference: anonymous principals cannot query or mutate any resource', () => {
  const service = createReferenceMockService({ principal: 'mock_anonymous' });
  for (const [tool, args] of [
    [statusTool, { project_id: project, job_id: 'mock_unknown' }],
    [listTool, { project_id: project, job_id: 'mock_unknown', limit: 1 }],
    [getTool, { project_id: project, reference_id: 'mock_unknown' }],
    [selectTool, select([])], [deleteTool, { project_id: project, job_id: 'mock_unknown' }],
  ]) failure(service.invoke(tool, args), 'MOCK_UNAUTHENTICATED', 401);
});

test('reference: issued pagination cursors are bounded and tied to owner/project/job', () => {
  const service = createReferenceMockService();
  const { job } = collect(service, { max_results: 7, budget_cap_usd: 0.07 });
  const seen = [];
  let cursor = null;
  do {
    const page = success(service.invoke(listTool, { project_id: project, job_id: job.id, limit: 2, cursor }));
    assert.ok(page.references.length <= 2);
    assert.equal(page.has_more, page.next_cursor !== null);
    seen.push(...page.references.map((ref) => ref.id));
    cursor = page.next_cursor;
  } while (cursor);
  assert.equal(seen.length, 7);
  assert.equal(new Set(seen).size, 7);
  const first = success(service.invoke(listTool, { project_id: project, job_id: job.id, limit: 1 }));
  const other = collect(service, { idempotency_key: 'mock_other_job' });
  failure(service.invoke(listTool, { project_id: project, job_id: other.job.id, limit: 1, cursor: first.next_cursor }), 'MOCK_INVALID_CURSOR', 400);
  for (const invalid of ['mock_cursor_forged', first.next_cursor + 'x']) {
    failure(service.invoke(listTool, { project_id: project, job_id: job.id, limit: 1, cursor: invalid }), 'MOCK_INVALID_CURSOR', 400);
  }
  for (const limit of [0, 21, 1.5, -1]) {
    failure(service.invoke(listTool, { project_id: project, job_id: job.id, limit }), 'MOCK_INVALID_INPUT', 400);
  }
});

test('reference: 403/429/timeout fixtures are deterministic errors, never successful job receipts', () => {
  for (const [fixture, code, status] of [
    ['mock_forbidden', 'MOCK_FORBIDDEN', 403],
    ['mock_rate_limited', 'MOCK_RATE_LIMITED', 429],
    ['mock_timeout', 'MOCK_TIMEOUT', 504],
  ]) {
    const service = createReferenceMockService();
    const args = input({ failure_fixture: fixture, query_or_url: 'fixture-secret-query' });
    const failed = service.invoke(createTool, args);
    const data = failure(failed, code, status);
    assert.equal(data.retryable, status !== 403);
    assert.equal(JSON.stringify(failed).includes('fixture-secret-query'), false);
    assert.deepEqual(service.invoke(createTool, args), failed);
    failure(service.invoke(createTool, { ...args, failure_fixture: 'mock_none' }), 'MOCK_IDEMPOTENCY_CONFLICT', 409);
    const digest = createHash('sha256').update(JSON.stringify(['mock_designer', project, args.idempotency_key])).digest('hex');
    failure(service.invoke(statusTool, { project_id: project, job_id: 'mock_refjob_' + digest.slice(0, 24) }), 'MOCK_NOT_FOUND', 404);
  }
});

test('reference: synthetic budget circuit breaker uses request limits without a real bill', () => {
  for (const budget_cap_usd of [0, 0.049999, 0.049999999]) {
    failure(createReferenceMockService().invoke(createTool, input({ budget_cap_usd })), 'MOCK_BUDGET_EXCEEDED', 402);
  }
  assert.equal(success(createReferenceMockService().invoke(createTool, input())).job.simulated_cost_usd, 0.05);
  for (const max_results of [0, 51, 1.5]) {
    failure(createReferenceMockService().invoke(createTool, input({ max_results })), 'MOCK_INVALID_INPUT', 400);
  }
  for (const budget_cap_usd of [-1, 11, Infinity, NaN]) {
    failure(createReferenceMockService().invoke(createTool, input({ budget_cap_usd })), 'MOCK_INVALID_INPUT', 400);
  }
});

test('reference: lexical URL allowlist rejects SSRF and encoded/credential/query variants without echo', () => {
  const urls = [
    'http://www.pinterest.com/pin/123/', 'https://pinterest.com/pin/123/',
    'https://www.pinterest.com:443/pin/123/', 'https://user:fixture-token@www.pinterest.com/pin/123/',
    'https://www.pinterest.com/pin/123/?token=fixture-token', 'https://www.pinterest.com/pin/123/#fragment',
    'https://www.pinterest.com/other/123/', 'https://www.pinterest.com.evil.invalid/pin/123/',
    'https://127.0.0.1/pin/123/', 'https://10.0.0.1/pin/123/', 'https://[::1]/pin/123/',
    'https://localhost/pin/123/', 'file://nas/private', '//nas/private', 'https://nas/pin/123/',
    'https://www.pinterest.com/pin/%31%32%33/', 'https://www.pinterest.com/pin/123/../private',
    'https://www.pinterest.com\\@127.0.0.1/pin/123/', 'https://www.pinterest.com/pin/123/\n',
  ];
  for (const query_or_url of urls) {
    const result = createReferenceMockService().invoke(createTool, input({ source_type: 'mock_pin_url', query_or_url }));
    failure(result, 'MOCK_INVALID_INPUT', 400);
    assert.equal(JSON.stringify(result).includes(query_or_url), false);
    assert.equal(JSON.stringify(result).includes('fixture-token'), false);
  }
  for (const query_or_url of [' ', 'fixture\u0000token']) {
    failure(createReferenceMockService().invoke(createTool, input({ query_or_url })), 'MOCK_INVALID_INPUT', 400);
  }
});

test('reference: selection dedupes, advances only changed revisions and replays the original snapshot', () => {
  const service = createReferenceMockService();
  const { refs } = collect(service);
  const args = select([refs[1], refs[0], refs[1]]);
  const first = success(service.invoke(selectTool, args));
  assert.equal(first.selection.reference_ids.length, 2);
  assert.equal(first.selection.revision, 1);
  assert.equal(success(service.invoke(selectTool, { ...args, reference_ids: [refs[0].id, refs[1].id] })).replayed, true);
  const unchanged = success(service.invoke(selectTool, { ...args, expected_revision: 1, idempotency_key: 'mock_unchanged' }));
  assert.equal(unchanged.selection.revision, 1);
  failure(service.invoke(selectTool, { ...args, reference_ids: [refs[2].id] }), 'MOCK_IDEMPOTENCY_CONFLICT', 409);
  failure(service.invoke(selectTool, { ...args, idempotency_key: 'mock_stale' }), 'MOCK_REVISION_CONFLICT', 409);
  const changed = success(service.invoke(selectTool, select([refs[2]], { expected_revision: 1, idempotency_key: 'mock_changed' })));
  assert.equal(changed.selection.revision, 2);
  assert.equal(success(service.invoke(selectTool, args)).selection.revision, 1);
});

test('reference: cleanup removes only owned job links; repeat deletion and post-delete reads are safe', () => {
  const fixture = createReferenceMockFixture();
  const service = fixture.createService();
  const { job, refs } = collect(service);
  const other = collect(service, { idempotency_key: 'mock_surviving_job' });
  const args = select([refs[0], other.refs[0]]);
  success(service.invoke(selectTool, args));
  const deleted = success(service.invoke(deleteTool, { project_id: project, job_id: job.id }));
  assert.equal(deleted.removed_reference_count, 5);
  assert.equal(deleted.removed_selection_count, 1);
  assert.equal(deleted.selection_revision, 2);
  assert.equal(deleted.already_deleted, false);
  const again = success(service.invoke(deleteTool, { project_id: project, job_id: job.id }));
  assert.equal(again.already_deleted, true);
  assert.equal(again.removed_reference_count, 0);
  assert.equal(again.selection_revision, 2);
  failure(service.invoke(statusTool, { project_id: project, job_id: job.id }), 'MOCK_NOT_FOUND', 404);
  failure(service.invoke(listTool, { project_id: project, job_id: job.id, limit: 1 }), 'MOCK_NOT_FOUND', 404);
  failure(service.invoke(getTool, { project_id: project, reference_id: refs[0].id }), 'MOCK_NOT_FOUND', 404);
  failure(service.invoke(createTool, input()), 'MOCK_NOT_FOUND', 404);
  failure(service.invoke(selectTool, args), 'MOCK_NOT_FOUND', 404);
  const preserved = success(service.invoke(selectTool, select([other.refs[0]], { expected_revision: 2, idempotency_key: 'mock_preserved' })));
  assert.equal(preserved.selection.revision, 2);
  success(service.invoke(getTool, { project_id: project, reference_id: other.refs[0].id }));
  failure(fixture.createService({ principal: 'mock_colleague' }).invoke(deleteTool,
    { project_id: project, job_id: job.id }), 'MOCK_NOT_FOUND', 404);
});

test('reference: returned objects cannot mutate stored job, selection or reference fixtures', () => {
  const service = createReferenceMockService();
  const { job, refs } = collect(service);
  const selected = success(service.invoke(selectTool, select([refs[0]])));
  job.result_count = 1;
  refs[0].rights_status = 'licensed';
  selected.selection.reference_ids.length = 0;
  assert.equal(success(service.invoke(statusTool, { project_id: project, job_id: job.id })).job.result_count, 5);
  assert.equal(success(service.invoke(getTool, { project_id: project, reference_id: refs[0].id })).reference.rights_status, 'unknown');
  assert.equal(success(service.invoke(selectTool, select([refs[0]]))).selection.reference_ids.length, 1);
});
