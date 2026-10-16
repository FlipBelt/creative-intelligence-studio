import { CONTRACT_VERSION, ErrorSchema, TOOL_CONTRACTS } from '../../contracts/mock-mcp.mjs';
import { FIXTURE_NOW, MOCK_ASSETS, MOCK_FACTS, MOCK_PRINCIPALS, MOCK_REVIEW_TICKETS, digestOf } from './fixtures.mjs';

const envelope = { synthetic: true, contract_version: CONTRACT_VERSION };
class MockFailure extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}
const fail = (code, message, retryable = false) => { throw new MockFailure(code, message, retryable); };

export function createMockService({ principal = 'mock_designer', now = FIXTURE_NOW } = {}) {
  const actor = Object.hasOwn(MOCK_PRINCIPALS, principal) ? MOCK_PRINCIPALS[principal] : undefined;
  const clock = typeof now === 'function' ? now : () => now;
  if (!actor || !Number.isFinite(Date.parse(clock()))) throw new Error('Invalid mock launch fixture');
  const wireframes = new Map();
  const operations = new Map();
  const projects = new Map([
    ['mock_project_alpha', 'mock_tenant_alpha'], ['mock_project_beta', 'mock_tenant_beta'],
  ]);
  function authorize(projectId, writing = false) {
    if (projects.get(projectId) !== actor.tenant_id || (writing && actor.role !== 'designer')) {
      fail('MOCK_FORBIDDEN', 'Mock principal cannot perform this project action.');
    }
  }
  function assetForUse(assetId, usage) {
    const asset = MOCK_ASSETS.find((candidate) => candidate.id === assetId);
    if (!asset) fail('MOCK_NOT_FOUND', 'Mock asset was not found.');
    if (Date.parse(asset.expires_at) <= Date.parse(clock())) {
      fail('MOCK_LICENSE_EXPIRED', 'Synthetic asset permission has expired.');
    }
    if (!asset.allowed_use.includes(usage)) fail('MOCK_LICENSE_SCOPE', 'Synthetic asset permission does not cover this use.');
    return asset;
  }
  const handlers = {
    mock_knowledge_read(input) {
      authorize(input.project_id);
      if (input.project_id !== 'mock_project_alpha' || input.product_id !== 'mock_product_pouch') {
        fail('MOCK_NOT_FOUND', 'Mock product was not found in this project.');
      }
      return { ...envelope, product_id: input.product_id, version: 'mock_v1', facts: structuredClone(MOCK_FACTS) };
    },
    mock_asset_search(input) {
      authorize(input.project_id);
      const assets = input.project_id === 'mock_project_alpha' ? MOCK_ASSETS : [];
      return { ...envelope, assets: assets.filter((asset) => asset.id.includes(input.query))
        .map((asset) => ({ ...structuredClone(asset),
          rights_status: Date.parse(asset.expires_at) <= Date.parse(clock()) ? 'expired' : 'usable' })) };
    },
    mock_wireframe_create(input) {
      authorize(input.project_id, true);
      handlers.mock_knowledge_read(input);
      assetForUse(input.asset_id, input.usage);
      const inputDigest = digestOf(input);
      const id = `mock_wireframe_${inputDigest.slice(0, 24)}`;
      const wireframe = {
        id, version: 'mock_v1', input_digest: inputDigest, instruction: structuredClone(input),
        format: 'mock_editable_nodes_v1', editable: true,
        nodes: [
          { id: 'mock_node_frame', type: 'rect', x: 0, y: 0, width: 800, height: 600, text: '', source_level: 'D' },
          { id: 'mock_node_image', type: 'image_placeholder', x: 24, y: 24, width: 360, height: 520,
            text: 'SYNTHETIC image placeholder; no image file is loaded', source_level: 'C' },
          { id: 'mock_node_title', type: 'text', x: 408, y: 24, width: 360, height: 64,
            text: MOCK_FACTS[0].value, source_level: 'A' },
          { id: 'mock_node_brief', type: 'text', x: 408, y: 112, width: 360, height: 160,
            text: input.brief, source_level: 'B' },
          { id: 'mock_node_unknown', type: 'text', x: 408, y: 296, width: 360, height: 64,
            text: 'Performance: unknown; do not invent a claim', source_level: 'U' },
        ],
        facts: structuredClone(MOCK_FACTS), parent_asset_ids: [input.asset_id],
        review_state: 'waiting_for_fixture_review',
      };
      wireframes.set(id, wireframe);
      return { ...envelope, wireframe: structuredClone(wireframe) };
    },
    mock_dam_register(input) {
      authorize(input.project_id, true);
      const operationKey = `${input.project_id}:${input.idempotency_key}`;
      const operationDigest = digestOf(input);
      const previous = operations.get(operationKey);
      if (previous && previous.inputDigest !== operationDigest) {
        fail('MOCK_IDEMPOTENCY_CONFLICT', 'This mock idempotency key is already bound to different input.');
      }
      const wireframe = wireframes.get(input.wireframe_id);
      if (!wireframe || wireframe.instruction.project_id !== input.project_id) {
        fail('MOCK_NOT_FOUND', 'Mock wireframe was not found in this project.');
      }
      assetForUse(wireframe.instruction.asset_id, wireframe.instruction.usage);
      const ticket = MOCK_REVIEW_TICKETS.find((candidate) => candidate.id === input.review_ticket_id);
      if (!ticket || ticket.decision !== 'approved') {
        fail('MOCK_REVIEW_REQUIRED', 'An approved, explicitly authored mock review fixture is required.');
      }
      if (ticket.input_digest !== wireframe.input_digest || ticket.input_version !== wireframe.instruction.input_version) {
        fail('MOCK_REVIEW_STALE', 'The mock review fixture does not approve this input version.');
      }
      if (previous?.receipt) return { ...envelope, receipt: { ...previous.receipt, replayed: true } };
      const operation = previous ?? { inputDigest: operationDigest, attempts: 0 };
      operation.attempts += 1;
      operations.set(operationKey, operation);
      if (input.failure_fixture === 'mock_transient_once' && operation.attempts === 1) {
        fail('MOCK_TRANSIENT_UNAVAILABLE', 'Synthetic transient failure before mock registration; retry the same command.', true);
      }
      const id = `mock_receipt_${digestOf(operationKey).slice(0, 24)}`;
      operation.receipt = { id, wireframe_id: wireframe.id, input_digest: wireframe.input_digest,
        review_ticket_id: ticket.id, uri: `mock-dam://${id}`, status: 'mock_registered',
        replayed: false, attempt: operation.attempts };
      return { ...envelope, receipt: structuredClone(operation.receipt) };
    },
  };
  return {
    invoke(name, rawInput) {
      const contract = Object.hasOwn(TOOL_CONTRACTS, name) ? TOOL_CONTRACTS[name] : undefined;
      if (!contract) throw new Error('Unknown mock tool');
      // The same strict validator serves direct contract tests and SDK transport calls.
      const input = contract.input.parse(rawInput);
      try {
        const output = contract.output.parse(handlers[name](input));
        return { content: [{ type: 'text', text: JSON.stringify(output) }], structuredContent: output };
      } catch (error) {
        if (!(error instanceof MockFailure)) throw error;
        const output = ErrorSchema.parse({ ...envelope, code: error.code, message: error.message, retryable: error.retryable });
        // MCP outputSchema describes success. Errors remain typed JSON text so clients do not
        // validate an error envelope as a successful product or registration receipt.
        return { isError: true, content: [{ type: 'text', text: JSON.stringify(output) }] };
      }
    },
  };
}
