import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inputDigest, PILOT_LIMITS, PilotInputSchema } from '../../contracts/pilot-input.mjs';

const NOT_EVALUATED = Object.freeze([
  'license_authenticity', 'server_acl', 'human_approval', 'backup_recovery', 'production_readiness',
]);
class GateFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
function deny(code) { throw new GateFailure(code); }
function assertLocalPath(value) {
  if (typeof value !== 'string' || !value || /[\u0000-\u001f]/.test(value)
      || /^[\\/]{2}/.test(value)
      || /^[\\/](?:\?\?|device|global\?\?)[\\/]/i.test(value)
      || (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) && !/^[A-Za-z]:[\\/]/.test(value))) {
    deny('UNSAFE_PATH');
  }
}

// Pure lexical validation runs before any filesystem call. Standard path APIs cannot
// establish whether a drive letter is mapped to a remote volume; use a trusted local tree.
export function resolveLocalPackagePaths({ manifestPath, rootDir }) {
  assertLocalPath(manifestPath);
  if (rootDir !== undefined) assertLocalPath(rootDir);
  const manifestAbsolute = path.resolve(manifestPath);
  const rootAbsolute = path.resolve(rootDir ?? path.dirname(manifestAbsolute));
  assertLocalPath(manifestAbsolute);
  assertLocalPath(rootAbsolute);
  return { manifestAbsolute, rootAbsolute };
}
function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
function portablePath(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(value)) {
    deny('UNSAFE_PATH');
  }
  for (const part of value.split('/')) {
    if (part.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) {
      deny('UNSAFE_PATH');
    }
  }
  return value;
}
async function directoryWithoutLinks(root) {
  const absolute = path.resolve(root);
  const parsed = path.parse(absolute);
  let cursor = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    const stat = await lstat(cursor);
    if (stat.isSymbolicLink()) deny('LINK_NOT_ALLOWED');
    if (!stat.isDirectory()) deny('NOT_DIRECTORY');
  }
  const resolved = await realpath(absolute);
  assertLocalPath(resolved);
  return resolved;
}
async function fileWithoutLinks(root, candidate) {
  if (!inside(root, candidate)) deny('OUTSIDE_ROOT');
  const relative = path.relative(root, candidate);
  if (!relative) deny('NOT_REGULAR_FILE');
  let cursor = root;
  const parts = relative.split(path.sep);
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    const stat = await lstat(cursor);
    if (stat.isSymbolicLink()) deny('LINK_NOT_ALLOWED');
    if (i < parts.length - 1 && !stat.isDirectory()) deny('NOT_DIRECTORY');
    if (i === parts.length - 1 && !stat.isFile()) deny('NOT_REGULAR_FILE');
  }
  const resolved = await realpath(candidate);
  assertLocalPath(resolved);
  if (!inside(root, resolved)) deny('OUTSIDE_ROOT');
  return resolved;
}
async function readBounded(root, candidate, maxBytes, budget, collect = false) {
  const resolved = await fileWithoutLinks(root, candidate);
  const before = await lstat(resolved);
  // O_NOFOLLOW is a second guard where supported. The package tree must remain trusted
  // and unchanged while validating; this is not an OS sandbox against concurrent writers.
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
    | (process.platform === 'win32' ? 0 : (constants.O_NONBLOCK ?? 0));
  const handle = await open(resolved, flags);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || before.dev !== stat.dev || before.ino !== stat.ino) deny('FILE_CHANGED');
    const current = await lstat(resolved);
    if (current.isSymbolicLink() || current.dev !== stat.dev || current.ino !== stat.ino) {
      deny('FILE_CHANGED');
    }
    if (stat.size > maxBytes) deny('FILE_TOO_LARGE');
    if (stat.size > budget.remaining) deny('PACKAGE_TOO_LARGE');
    const hash = createHash('sha256');
    const chunks = [];
    const buffer = Buffer.alloc(64 * 1024);
    let size = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      size += bytesRead;
      if (size > maxBytes) deny('FILE_TOO_LARGE');
      if (size > budget.remaining) deny('PACKAGE_TOO_LARGE');
      hash.update(buffer.subarray(0, bytesRead));
      if (collect) chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    const after = await handle.stat();
    if (size !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs
        || after.ctimeMs !== stat.ctimeMs) deny('FILE_CHANGED');
    budget.remaining -= size;
    return { sha256: hash.digest('hex'), size, bytes: collect ? Buffer.concat(chunks) : undefined };
  } finally {
    await handle.close();
  }
}
function report(errors, input_digest) {
  return {
    ok: errors.length === 0, scope: 'offline_synthetic_input_consistency',
    data_classification: 'synthetic_only',
    ...(input_digest ? { input_digest } : {}),
    errors, not_evaluated: NOT_EVALUATED,
  };
}
function error(code, field = 'package') { return { code, field }; }

// Reads only the explicitly selected manifest and its declared package files.
export async function validatePilotPackage({ manifestPath, rootDir, now = new Date() } = {}) {
  const errors = [];
  let digest;
  try {
    if (typeof manifestPath !== 'string' || !manifestPath) deny('MANIFEST_REQUIRED');
    const clock = now instanceof Date ? now.getTime() : NaN;
    if (!Number.isFinite(clock)) deny('INVALID_CLOCK');
    const { manifestAbsolute, rootAbsolute } = resolveLocalPackagePaths({ manifestPath, rootDir });
    const root = await directoryWithoutLinks(rootAbsolute);
    const budget = { remaining: PILOT_LIMITS.totalBytes };
    const source = await readBounded(root, manifestAbsolute, PILOT_LIMITS.manifestBytes, budget, true);
    let input;
    try { input = JSON.parse(source.bytes.toString('utf8')); }
    catch { deny('INVALID_JSON'); }
    const parsed = PilotInputSchema.safeParse(input);
    if (!parsed.success) {
      return report(parsed.error.issues.slice(0, 40).map((issue) =>
        error('INVALID_MANIFEST', issue.path.join('.') || 'manifest')));
    }
    const manifest = parsed.data;
    digest = inputDigest(manifest);
    if (digest !== manifest.confirmation.input_digest) errors.push(error('STALE_CONFIRMATION', 'confirmation'));
    if (new Set(manifest.knowledge.map((item) => item.release_id)).size !== 1) {
      errors.push(error('KNOWLEDGE_RELEASE_MISMATCH', 'knowledge'));
    }
    const ids = new Set();
    const paths = new Set();
    const entries = [
      ['brief', manifest.brief],
      ...manifest.knowledge.map((item, i) => ['knowledge.' + i, item]),
      ...manifest.assets.map((item, i) => ['assets.' + i, item]),
    ];
    for (const [field, entry] of entries) {
      const id = field.startsWith('assets.') ? entry.asset_id : entry.id;
      const identity = (field.startsWith('assets.') ? 'asset:' : 'input:') + id;
      if (ids.has(identity)) errors.push(error('DUPLICATE_ID', field));
      ids.add(identity);
      if (paths.has(entry.path)) errors.push(error('DUPLICATE_PATH', field));
      paths.add(entry.path);
      try {
        portablePath(entry.path);
        const actual = await readBounded(root, path.resolve(root, entry.path),
          PILOT_LIMITS.fileBytes, budget);
        if (actual.sha256 !== entry.sha256) errors.push(error('HASH_MISMATCH', field));
        if ('byte_size' in entry && actual.size !== entry.byte_size) {
          errors.push(error('SIZE_MISMATCH', field));
        }
      } catch (failure) {
        errors.push(error(failure instanceof GateFailure ? failure.code : 'FILE_UNREADABLE', field));
      }
      if (field.startsWith('assets.')) {
        const license = entry.license;
        if (license.status !== 'granted') errors.push(error('LICENSE_NOT_GRANTED', field + '.license'));
        if (license.revoked_at !== null) errors.push(error('LICENSE_REVOKED', field + '.license'));
        if (Date.parse(license.expires_at) <= clock) errors.push(error('LICENSE_EXPIRED', field + '.license'));
        if (!license.allowed_purposes.includes(manifest.purpose)) errors.push(error('PURPOSE_NOT_ALLOWED', field + '.license'));
        if (!license.allowed_processors.includes(manifest.processor)) errors.push(error('PROCESSOR_NOT_ALLOWED', field + '.license'));
      }
    }
    return report(errors, digest);
  } catch (failure) {
    return report([error(failure instanceof GateFailure ? failure.code : 'PACKAGE_UNREADABLE')], digest);
  }
}
function cliArgs(args) {
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!['--manifest', '--root'].includes(flag) || values[flag]
        || !args[i + 1] || args[i + 1].startsWith('--')) return null;
    values[flag] = args[i + 1];
  }
  return values['--manifest'] ? {
    manifestPath: values['--manifest'], ...(values['--root'] ? { rootDir: values['--root'] } : {}),
  } : null;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = cliArgs(process.argv.slice(2));
  const result = options ? await validatePilotPackage(options) : report([error('USAGE')]);
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = options ? (result.ok ? 0 : 1) : 2;
}
