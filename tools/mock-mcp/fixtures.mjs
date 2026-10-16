import { createHash } from 'node:crypto';

export const FIXTURE_NOW = '2026-10-16T00:00:00.000Z';
export function digestOf(value) {
  const canonical = (item) => Array.isArray(item) ? item.map(canonical)
    : item && typeof item === 'object'
      ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, canonical(item[key])])) : item;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export const MOCK_INSTRUCTION = Object.freeze({
  project_id: 'mock_project_alpha', product_id: 'mock_product_pouch', input_version: 'mock_v1',
  asset_id: 'mock_asset_current', brief: 'Mock layout: product image and source-labelled text',
  usage: 'internal_wireframe',
});
export const MOCK_FACTS = Object.freeze([
  { field: 'name', value: 'Mock pouch shorts — synthetic', level: 'A', source_id: 'mock_knowledge', source_version: 'mock_v1' },
  { field: 'audience', value: 'Synthetic internal layout exercise', level: 'B', source_id: 'mock_brief', source_version: 'mock_v1' },
  { field: 'observation', value: 'Synthetic image placeholder has a rectangular silhouette', level: 'C', source_id: 'mock_observation', source_version: 'mock_v1' },
  { field: 'suggestion', value: 'Try a two-column layout; not a product fact', level: 'D', source_id: 'mock_inference', source_version: 'mock_v1' },
  { field: 'performance', value: null, level: 'U', source_id: 'mock_unknown', source_version: 'mock_v1' },
].map(Object.freeze));
export const MOCK_ASSETS = Object.freeze([
  { id: 'mock_asset_current', version: 'mock_v1', uri: 'mock-asset://mock_asset_current',
    synthetic: true, allowed_use: ['internal_wireframe'], expires_at: '2026-10-17T00:00:00.000Z' },
  { id: 'mock_asset_expired', version: 'mock_v1', uri: 'mock-asset://mock_asset_expired',
    synthetic: true, allowed_use: ['internal_wireframe'], expires_at: '2026-10-15T00:00:00.000Z' },
].map(Object.freeze));
// Test data authored explicitly for review-gate testing. No tool can issue or approve a ticket.
export const MOCK_REVIEW_TICKETS = Object.freeze([
  { id: 'mock_review_approved_v1', decision: 'approved', reviewer_id: 'mock_reviewer',
    input_digest: digestOf(MOCK_INSTRUCTION), input_version: 'mock_v1' },
  { id: 'mock_review_rejected_v1', decision: 'rejected', reviewer_id: 'mock_reviewer',
    input_digest: digestOf(MOCK_INSTRUCTION), input_version: 'mock_v1' },
].map(Object.freeze));
export const MOCK_PRINCIPALS = Object.freeze({
  mock_designer: { tenant_id: 'mock_tenant_alpha', role: 'designer' },
  mock_viewer: { tenant_id: 'mock_tenant_alpha', role: 'viewer' },
  mock_outsider: { tenant_id: 'mock_tenant_beta', role: 'designer' },
});
