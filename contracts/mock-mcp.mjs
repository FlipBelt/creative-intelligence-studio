import { z } from 'zod';

// CIS-local synthetic contract, not a claim about any existing remote API.
export const CONTRACT_VERSION = 'mock-contract-v1';
const id = z.string().regex(/^mock_[a-z0-9_]+$/).max(100);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const version = z.string().regex(/^mock_v[1-9][0-9]*$/);
const base = { synthetic: z.literal(true), contract_version: z.literal(CONTRACT_VERSION) };
export const FactSchema = z.strictObject({
  field: z.string(), value: z.string().nullable(), level: z.enum(['A', 'B', 'C', 'D', 'U']),
  source_id: id, source_version: version,
});
export const AssetSchema = z.strictObject({
  id, version, uri: z.string().regex(/^mock-asset:\/\/mock_[a-z0-9_]+$/),
  synthetic: z.literal(true), allowed_use: z.array(z.enum(['internal_wireframe'])),
  expires_at: z.iso.datetime(), rights_status: z.enum(['usable', 'expired']),
});
export const InstructionSchema = z.strictObject({
  project_id: id, product_id: id, input_version: version, asset_id: id,
  brief: z.string().min(1).max(500), usage: z.enum(['internal_wireframe', 'campaign_public']),
});
export const NodeSchema = z.strictObject({
  id, type: z.enum(['rect', 'text', 'image_placeholder']),
  x: z.number().int().nonnegative(), y: z.number().int().nonnegative(),
  width: z.number().int().positive(), height: z.number().int().positive(),
  text: z.string(), source_level: z.enum(['A', 'B', 'C', 'D', 'U']),
});
export const WireframeSchema = z.strictObject({
  id, version, input_digest: digest, instruction: InstructionSchema,
  format: z.literal('mock_editable_nodes_v1'), editable: z.literal(true),
  nodes: z.array(NodeSchema).min(1), facts: z.array(FactSchema),
  parent_asset_ids: z.array(id), review_state: z.literal('waiting_for_fixture_review'),
});
export const ErrorSchema = z.strictObject({
  ...base, code: z.enum(['MOCK_FORBIDDEN', 'MOCK_NOT_FOUND', 'MOCK_LICENSE_EXPIRED',
    'MOCK_LICENSE_SCOPE', 'MOCK_REVIEW_REQUIRED', 'MOCK_REVIEW_STALE',
    'MOCK_IDEMPOTENCY_CONFLICT', 'MOCK_TRANSIENT_UNAVAILABLE']),
  message: z.string(), retryable: z.boolean(),
});
export const ReceiptSchema = z.strictObject({
  id, wireframe_id: id, input_digest: digest, review_ticket_id: id,
  uri: z.string().regex(/^mock-dam:\/\/mock_[a-z0-9_]+$/),
  status: z.literal('mock_registered'), replayed: z.boolean(), attempt: z.number().int().positive(),
});

export const TOOL_CONTRACTS = {
  mock_knowledge_read: {
    description: 'Synthetic versioned knowledge fixture; A is a mock label, never real product truth.',
    input: z.strictObject({ project_id: id, product_id: id }),
    output: z.strictObject({ ...base, product_id: id, version, facts: z.array(FactSchema) }),
    readOnly: true,
  },
  mock_asset_search: {
    description: 'Synthetic asset metadata only; never fetches a URI or reads a file.',
    input: z.strictObject({ project_id: id, query: z.string().max(100) }),
    output: z.strictObject({ ...base, assets: z.array(AssetSchema) }),
    readOnly: true,
  },
  mock_wireframe_create: {
    description: 'Creates in-memory synthetic editable JSON nodes, not a real design-tool document.',
    input: InstructionSchema,
    output: z.strictObject({ ...base, wireframe: WireframeSchema }),
    readOnly: false,
  },
  mock_dam_register: {
    description: 'In-memory mock DAM receipt; requires an explicit pre-authored mock human-review fixture.',
    input: z.strictObject({ project_id: id, wireframe_id: id, review_ticket_id: id,
      idempotency_key: id, failure_fixture: z.enum(['mock_none', 'mock_transient_once']) }),
    output: z.strictObject({ ...base, receipt: ReceiptSchema }),
    readOnly: false,
  },
};

// Exported JSON Schema is generated from the same runtime validators.
export function getMockJsonSchemas() {
  return Object.fromEntries(Object.entries(TOOL_CONTRACTS).map(([name, contract]) => [name, {
    input: z.toJSONSchema(contract.input), output: z.toJSONSchema(contract.output),
  }]));
}
