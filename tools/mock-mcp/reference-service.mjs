import { createHash } from 'node:crypto';
import { REFERENCE_CONTRACT_VERSION, REFERENCE_TOOL_CONTRACTS,
  ReferenceErrorSchema } from '../../contracts/reference-collection.mjs';

export const REFERENCE_CAPABILITIES = Object.freeze({
  provider_mode: 'synthetic_only', real_provider_configured: false,
  provider_eligibility: 'eligibility_unknown', real_data_persistence: 'persistence_not_authorized',
  external_network: false, third_party_processing: false, real_billing: false,
  authorization_scope: 'launch_fixture_only',
});
const envelope = { synthetic: true, contract_version: REFERENCE_CONTRACT_VERSION,
  capabilities: REFERENCE_CAPABILITIES };
const principals = {
  mock_designer: { tenant: 'mock_tenant_alpha', canWrite: true },
  mock_colleague: { tenant: 'mock_tenant_alpha', canWrite: true },
  mock_viewer: { tenant: 'mock_tenant_alpha', canWrite: false },
  mock_outsider: { tenant: 'mock_tenant_beta', canWrite: true },
  mock_anonymous: null,
};
const projects = { mock_project_alpha: 'mock_tenant_alpha', mock_project_beta: 'mock_tenant_beta' };
const statusCodes = { MOCK_INVALID_INPUT: 400, MOCK_UNAUTHENTICATED: 401, MOCK_FORBIDDEN: 403,
  MOCK_NOT_FOUND: 404, MOCK_IDEMPOTENCY_CONFLICT: 409, MOCK_REVISION_CONFLICT: 409,
  MOCK_INVALID_CURSOR: 400, MOCK_RATE_LIMITED: 429, MOCK_TIMEOUT: 504, MOCK_BUDGET_EXCEEDED: 402 };
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
class FixtureFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = (code) => { throw new FixtureFailure(code); };
const textResult = (output) => ({ content: [{ type: 'text', text: JSON.stringify(output) }],
  structuredContent: structuredClone(output) });

// Only exact canonical pin paths are accepted; no URL resolution, DNS or fetch is performed.
function validateSource(input) {
  if (input.source_type === 'mock_pin_url') {
    if (!/^https:\/\/www\.pinterest\.com\/pin\/[0-9]{1,30}\/?$/.test(input.query_or_url)) {
      fail('MOCK_INVALID_INPUT');
    }
  } else if (input.query_or_url.trim().length === 0 || /[\u0000-\u001f\u007f]/.test(input.query_or_url)) {
    fail('MOCK_INVALID_INPUT');
  }
}

// This shared in-memory fixture exists only to exercise principals in tests. It is not a real identity store.
export function createReferenceMockFixture() {
  const jobs = new Map();
  const references = new Map();
  const createOperations = new Map();
  const selectOperations = new Map();
  const selections = new Map();
  const tombstones = new Map();
  const cursors = new Map();
  function createService({ principal = 'mock_designer' } = {}) {
    if (!Object.hasOwn(principals, principal)) throw new Error('MOCK_INVALID_LAUNCH_FIXTURE');
    const actor = principals[principal];
    const scopedKey = (projectId) => `${principal}:${projectId}`;
    function authorize(projectId, writing = false) {
      if (!actor) fail('MOCK_UNAUTHENTICATED');
      if (!Object.hasOwn(projects, projectId) || projects[projectId] !== actor.tenant
        || (writing && !actor.canWrite)) fail('MOCK_FORBIDDEN');
    }
    function owned(map, id, projectId) {
      const value = map.get(id);
      if (!value || value.owner !== principal || value.project_id !== projectId) fail('MOCK_NOT_FOUND');
      return value;
    }
    function getSelection(projectId) {
      return selections.get(scopedKey(projectId)) ?? {
        synthetic: true, contract_version: REFERENCE_CONTRACT_VERSION,
        id: `mock_refset_${hash(scopedKey(projectId)).slice(0, 24)}`, project_id: projectId,
        revision: 0, reference_ids: [], selection_kind: 'mock_fixture_selection',
        rights_status: 'unknown', usage_granted: false, human_review: false,
      };
    }
    const handlers = {
      mock_create_reference_collection_job(input) {
        authorize(input.project_id, true);
        validateSource(input);
        const key = `${scopedKey(input.project_id)}:${input.idempotency_key}`;
        const inputDigest = hash(input);
        const previous = createOperations.get(key);
        if (previous && previous.inputDigest !== inputDigest) fail('MOCK_IDEMPOTENCY_CONFLICT');
        if (previous?.errorCode) fail(previous.errorCode);
        if (previous?.jobId) {
          const stored = owned(jobs, previous.jobId, input.project_id);
          return { ...envelope, job: stored.job, replayed: true };
        }
        const fixtureError = { mock_forbidden: 'MOCK_FORBIDDEN', mock_rate_limited: 'MOCK_RATE_LIMITED',
          mock_timeout: 'MOCK_TIMEOUT' }[input.failure_fixture];
        // 1 synthetic cent per fixture. Integer microdollars avoid a floating point budget bypass.
        const requiredMicroUsd = input.max_results * 10_000;
        const errorCode = fixtureError ?? (Math.floor(input.budget_cap_usd * 1_000_000 + 1e-8) < requiredMicroUsd
          ? 'MOCK_BUDGET_EXCEEDED' : undefined);
        if (errorCode) {
          createOperations.set(key, { inputDigest, errorCode });
          fail(errorCode);
        }
        const jobId = `mock_refjob_${hash([principal, input.project_id, input.idempotency_key]).slice(0, 24)}`;
        const job = { synthetic: true, contract_version: REFERENCE_CONTRACT_VERSION,
          id: jobId, project_id: input.project_id, input_digest: inputDigest,
          status: 'mock_succeeded', execution: 'synchronous_fixture',
          requested_source_type: input.source_type, result_count: input.max_results,
          simulated_cost_usd: input.max_results / 100, real_billing: false };
        const referenceIds = [];
        for (let index = 1; index <= input.max_results; index += 1) {
          const id = `mock_ref_${hash([jobId, index]).slice(0, 24)}`;
          referenceIds.push(id);
          const reference = { synthetic: true, contract_version: REFERENCE_CONTRACT_VERSION,
            id, project_id: input.project_id, job_id: jobId,
            source_type: 'synthetic_generated', source_url: `https://example.invalid/mock/pins/${id}`,
            title: `Synthetic reference ${index}`, rights_status: 'unknown',
            third_party_processing: false, usage_granted: false };
          references.set(id, { owner: principal, project_id: input.project_id, reference });
        }
        jobs.set(jobId, { owner: principal, project_id: input.project_id, job, referenceIds });
        createOperations.set(key, { inputDigest, jobId });
        return { ...envelope, job, replayed: false };
      },
      mock_get_reference_collection_job(input) {
        authorize(input.project_id);
        return { ...envelope, job: owned(jobs, input.job_id, input.project_id).job };
      },
      mock_list_external_references(input) {
        authorize(input.project_id);
        const stored = owned(jobs, input.job_id, input.project_id);
        let offset = 0;
        if (input.cursor != null) {
          const cursor = cursors.get(input.cursor);
          if (!cursor || cursor.jobId !== input.job_id || cursor.projectId !== input.project_id
            || cursor.owner !== principal) fail('MOCK_INVALID_CURSOR');
          offset = cursor.offset;
        }
        const ids = stored.referenceIds.slice(offset, offset + input.limit);
        const nextOffset = offset + ids.length;
        const hasMore = nextOffset < stored.referenceIds.length;
        const nextCursor = hasMore ? `mock_cursor_${hash([principal, input.project_id, input.job_id, nextOffset])}` : null;
        if (nextCursor) cursors.set(nextCursor, { owner: principal, projectId: input.project_id,
          jobId: input.job_id, offset: nextOffset });
        return { ...envelope, project_id: input.project_id, job_id: input.job_id,
          references: ids.map((id) => owned(references, id, input.project_id).reference),
          next_cursor: nextCursor, has_more: hasMore };
      },
      mock_get_external_reference(input) {
        authorize(input.project_id);
        return { ...envelope, reference: owned(references, input.reference_id, input.project_id).reference };
      },
      mock_select_references(input) {
        authorize(input.project_id, true);
        const ids = [...new Set(input.reference_ids)].sort();
        for (const id of ids) owned(references, id, input.project_id);
        const key = `${scopedKey(input.project_id)}:${input.idempotency_key}`;
        const inputDigest = hash({ ...input, reference_ids: ids });
        const previous = selectOperations.get(key);
        if (previous && previous.inputDigest !== inputDigest) fail('MOCK_IDEMPOTENCY_CONFLICT');
        if (previous) return { ...envelope, selection: previous.selection, replayed: true };
        const current = getSelection(input.project_id);
        if (input.expected_revision !== current.revision) fail('MOCK_REVISION_CONFLICT');
        const changed = JSON.stringify(current.reference_ids) !== JSON.stringify(ids);
        const selection = { ...current, reference_ids: ids, revision: current.revision + (changed ? 1 : 0) };
        selections.set(scopedKey(input.project_id), selection);
        selectOperations.set(key, { inputDigest, selection: structuredClone(selection) });
        return { ...envelope, selection, replayed: false };
      },
      mock_delete_reference_collection_job(input) {
        authorize(input.project_id, true);
        const currentSelection = getSelection(input.project_id);
        if (!jobs.has(input.job_id)) {
          owned(tombstones, input.job_id, input.project_id);
          return { ...envelope, job_id: input.job_id, deleted: true, already_deleted: true,
            removed_reference_count: 0, removed_selection_count: 0, selection_revision: currentSelection.revision };
        }
        const stored = owned(jobs, input.job_id, input.project_id);
        const removedIds = new Set(stored.referenceIds);
        const remaining = currentSelection.reference_ids.filter((id) => !removedIds.has(id));
        const removedSelectionCount = currentSelection.reference_ids.length - remaining.length;
        const selection = { ...currentSelection, reference_ids: remaining,
          revision: currentSelection.revision + (removedSelectionCount > 0 ? 1 : 0) };
        selections.set(scopedKey(input.project_id), selection);
        for (const id of removedIds) references.delete(id);
        for (const [cursor, binding] of cursors) if (binding.jobId === input.job_id) cursors.delete(cursor);
        jobs.delete(input.job_id);
        tombstones.set(input.job_id, { owner: principal, project_id: input.project_id });
        return { ...envelope, job_id: input.job_id, deleted: true, already_deleted: false,
          removed_reference_count: removedIds.size, removed_selection_count: removedSelectionCount,
          selection_revision: selection.revision };
      },
    };
    return {
      invoke(name, rawInput) {
        try {
          const contract = Object.hasOwn(REFERENCE_TOOL_CONTRACTS, name) ? REFERENCE_TOOL_CONTRACTS[name] : undefined;
          if (!contract) fail('MOCK_INVALID_INPUT');
          const parsed = contract.input.safeParse(rawInput);
          if (!parsed.success) fail('MOCK_INVALID_INPUT');
          const output = contract.output.parse(handlers[name](parsed.data));
          return textResult(output);
        } catch (error) {
          if (!(error instanceof FixtureFailure)) throw error;
          const output = ReferenceErrorSchema.parse({ ...envelope, code: error.code,
            status_code: statusCodes[error.code], message: error.code,
            retryable: ['MOCK_RATE_LIMITED', 'MOCK_TIMEOUT'].includes(error.code) });
          // Successful output schemas deliberately do not describe failures.
          return { isError: true, content: [{ type: 'text', text: JSON.stringify(output) }] };
        }
      },
    };
  }
  return { createService };
}
export function createReferenceMockService(options = {}) {
  return createReferenceMockFixture().createService(options);
}
