import { createHash } from 'node:crypto';
import { z } from 'zod';

// CIS-local synthetic preparation only. No remote API or authorization claim.
export const PILOT_LIMITS = Object.freeze({
  manifestBytes: 256 * 1024, fileBytes: 4 * 1024 * 1024,
  totalBytes: 16 * 1024 * 1024, assets: 20, knowledge: 10,
});
const token = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).max(160)
  .refine((value) => !['unknown', 'pending', 'tbd'].includes(value.toLowerCase()));
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const file = { id: token, version: token, sha256: digest, path: z.string().min(1).max(240) };
export const PilotInputSchema = z.strictObject({
  schema_version: z.literal('pilot-input-v1'),
  data_classification: z.literal('synthetic'),
  project_id: token, purpose: token, processor: token,
  brief: z.strictObject(file),
  knowledge: z.array(z.strictObject({ ...file, release_id: token }))
    .min(1).max(PILOT_LIMITS.knowledge),
  assets: z.array(z.strictObject({
    asset_id: token, version: token, sha256: digest, path: file.path,
    mime_type: z.enum(['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'text/plain']),
    byte_size: z.number().int().positive().max(PILOT_LIMITS.fileBytes),
    source_ref: token, parent_version: token.nullable(),
    license: z.strictObject({
      status: z.enum(['granted', 'unknown', 'expired', 'revoked']),
      evidence_ref: token,
      allowed_purposes: z.array(token).min(1).max(20),
      allowed_processors: z.array(token).min(1).max(20),
      expires_at: z.iso.datetime(), revoked_at: z.iso.datetime().nullable(),
    }),
  })).min(1).max(PILOT_LIMITS.assets),
  confirmation: z.strictObject({
    kind: z.literal('synthetic_fixture'), input_digest: digest,
  }),
});

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean'
      || (typeof value === 'number' && Number.isFinite(value))) return JSON.stringify(value);
  throw new TypeError('Unsupported digest value');
}

// Confirmation cannot approve itself; every other input, including rights, is bound.
export function inputDigest(manifest) {
  const { confirmation: _confirmation, ...input } = manifest;
  return createHash('sha256').update(canonical(input)).digest('hex');
}
