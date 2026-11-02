import { z } from 'zod';

// A CIS-local fixture protocol; these names do not describe a real Pinterest API.
export const REFERENCE_CONTRACT_VERSION = 'reference-mock-contract-v1';
const id = z.string().regex(/^mock_[a-z0-9_]+$/).max(100);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const base = { synthetic: z.literal(true), contract_version: z.literal(REFERENCE_CONTRACT_VERSION) };
export const ProviderCapabilitiesSchema = z.strictObject({
  provider_mode: z.literal('synthetic_only'),
  real_provider_configured: z.literal(false),
  provider_eligibility: z.literal('eligibility_unknown'),
  real_data_persistence: z.literal('persistence_not_authorized'),
  external_network: z.literal(false),
  third_party_processing: z.literal(false),
  real_billing: z.literal(false),
  authorization_scope: z.literal('launch_fixture_only'),
});
const envelope = { ...base, capabilities: ProviderCapabilitiesSchema };
export const ReferenceSchema = z.strictObject({
  ...base, id, project_id: id, job_id: id,
  source_type: z.literal('synthetic_generated'),
  source_url: z.string().regex(/^https:\/\/example\.invalid\/mock\/pins\/mock_[a-z0-9_]+$/),
  title: z.string().regex(/^Synthetic reference [1-9][0-9]*$/),
  rights_status: z.literal('unknown'), third_party_processing: z.literal(false),
  usage_granted: z.literal(false),
});
export const ReferenceJobSchema = z.strictObject({
  ...base, id, project_id: id, input_digest: digest,
  status: z.literal('mock_succeeded'), execution: z.literal('synchronous_fixture'),
  requested_source_type: z.enum(['mock_keyword', 'mock_pin_url']),
  result_count: z.number().int().min(1).max(50),
  simulated_cost_usd: z.number().min(0).max(0.5),
  real_billing: z.literal(false),
});
export const ReferenceSelectionSchema = z.strictObject({
  ...base, id, project_id: id, revision: z.number().int().nonnegative(),
  reference_ids: z.array(id).max(50),
  selection_kind: z.literal('mock_fixture_selection'),
  rights_status: z.literal('unknown'), usage_granted: z.literal(false),
  human_review: z.literal(false),
});
export const ReferenceErrorSchema = z.strictObject({
  ...envelope,
  code: z.enum(['MOCK_INVALID_INPUT', 'MOCK_UNAUTHENTICATED', 'MOCK_FORBIDDEN', 'MOCK_NOT_FOUND',
    'MOCK_IDEMPOTENCY_CONFLICT', 'MOCK_REVISION_CONFLICT', 'MOCK_INVALID_CURSOR',
    'MOCK_RATE_LIMITED', 'MOCK_TIMEOUT', 'MOCK_BUDGET_EXCEEDED']),
  status_code: z.union([z.literal(400), z.literal(401), z.literal(402), z.literal(403),
    z.literal(404), z.literal(409), z.literal(429), z.literal(504)]),
  message: z.string().regex(/^MOCK_[A-Z_]+$/), retryable: z.boolean(),
});
const scopedJob = { project_id: id, job_id: id };
export const REFERENCE_TOOL_CONTRACTS = {
  mock_create_reference_collection_job: {
    description: 'Creates synchronous synthetic fixtures only. Candidate URLs are lexical data, never fetched; no real Pinterest eligibility, storage permission or billing.',
    input: z.strictObject({
      project_id: id, source_type: z.enum(['mock_keyword', 'mock_pin_url']),
      query_or_url: z.string().min(1).max(500),
      max_results: z.number().int().min(1).max(50),
      budget_cap_usd: z.number().min(0).max(10),
      idempotency_key: id,
      failure_fixture: z.enum(['mock_none', 'mock_forbidden', 'mock_rate_limited', 'mock_timeout']),
    }),
    output: z.strictObject({ ...envelope, job: ReferenceJobSchema, replayed: z.boolean() }),
    readOnly: false,
  },
  mock_get_reference_collection_job: {
    description: 'Reads an owner/project scoped synthetic job; never polls a real worker.',
    input: z.strictObject(scopedJob),
    output: z.strictObject({ ...envelope, job: ReferenceJobSchema }),
    readOnly: true,
  },
  mock_list_external_references: {
    description: 'Lists synthetic references with an issued cursor bound to owner, project and job.',
    input: z.strictObject({ ...scopedJob, cursor: z.string().min(1).max(200).nullable().optional(),
      limit: z.number().int().min(1).max(20) }),
    output: z.strictObject({ ...envelope, project_id: id, job_id: id,
      references: z.array(ReferenceSchema).max(20), next_cursor: z.string().nullable(), has_more: z.boolean() }),
    readOnly: true,
  },
  mock_get_external_reference: {
    description: 'Reads synthetic metadata only; unknown rights never become a use permission.',
    input: z.strictObject({ project_id: id, reference_id: id }),
    output: z.strictObject({ ...envelope, reference: ReferenceSchema }),
    readOnly: true,
  },
  mock_select_references: {
    description: 'Replaces a fixture selection, deduping IDs. expected_revision prevents lost updates; replay returns the original revision while referenced fixtures exist. Selection grants no rights or human approval.',
    input: z.strictObject({ project_id: id, reference_ids: z.array(id).max(50),
      expected_revision: z.number().int().nonnegative(), idempotency_key: id }),
    output: z.strictObject({ ...envelope, selection: ReferenceSelectionSchema, replayed: z.boolean() }),
    readOnly: false,
  },
  mock_delete_reference_collection_job: {
    description: 'Deletes owned in-memory fixtures and removes their selection links. Repeated owned deletion is idempotent; this is cleanup, never backup or restore.',
    input: z.strictObject(scopedJob),
    output: z.strictObject({ ...envelope, job_id: id, deleted: z.literal(true), already_deleted: z.boolean(),
      removed_reference_count: z.number().int().nonnegative(), removed_selection_count: z.number().int().nonnegative(),
      selection_revision: z.number().int().nonnegative() }),
    readOnly: false, destructive: true,
  },
};
export function getReferenceJsonSchemas() {
  return Object.fromEntries(Object.entries(REFERENCE_TOOL_CONTRACTS).map(([name, contract]) => [name, {
    input: z.toJSONSchema(contract.input), output: z.toJSONSchema(contract.output),
  }]));
}
