import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, mkdir, rm, symlink, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inputDigest, PILOT_LIMITS } from '../../contracts/pilot-input.mjs';
import { resolveLocalPackagePaths, validatePilotPackage } from '../../tools/pilot-input/validate.mjs';

const fixtures = fileURLToPath(new URL('./fixtures/valid/', import.meta.url));
const cli = fileURLToPath(new URL('../../tools/pilot-input/validate.mjs', import.meta.url));
const now = new Date('2026-10-22T00:00:00Z');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function sample(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'cis-pilot-input-'));
  assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
  assert.ok(path.basename(root).startsWith('cis-pilot-input-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(fixtures, root, { recursive: true });
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  return { root, manifestPath, manifest };
}
async function save(sample, confirm = true) {
  if (confirm) sample.manifest.confirmation.input_digest = inputDigest(sample.manifest);
  await writeFile(sample.manifestPath, JSON.stringify(sample.manifest));
}
const check = (sample) => validatePilotPackage({ manifestPath: sample.manifestPath, now });
const codes = (result) => result.errors.map((item) => item.code);
const has = (result, code) => assert.ok(codes(result).includes(code), JSON.stringify(result));
function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8', env: process.platform === 'win32' ? { SYSTEMROOT: process.env.SYSTEMROOT } : {},
  });
}

test('checked-in synthetic sample passes and explicitly leaves real gates unevaluated', async () => {
  const result = await validatePilotPackage({ manifestPath: path.join(fixtures, 'manifest.json'), now });
  assert.equal(result.ok, true);
  assert.equal(result.scope, 'offline_synthetic_input_consistency');
  assert.equal(result.data_classification, 'synthetic_only');
  assert.deepEqual(result.not_evaluated,
    ['license_authenticity', 'server_acl', 'human_approval', 'backup_recovery', 'production_readiness']);
});
test('canonical input digest ignores object key order and excludes confirmation', async (t) => {
  const s = await sample(t);
  const reordered = Object.fromEntries(Object.entries(s.manifest).reverse());
  reordered.confirmation = { kind: 'changed', input_digest: '0'.repeat(64) };
  assert.equal(inputDigest(reordered), inputDigest(s.manifest));
});
for (const [name, mutate] of [
  ['project', (m) => { m.project_id = 'synthetic_other'; }],
  ['purpose', (m) => { m.purpose = 'other_purpose'; }],
  ['processor', (m) => { m.processor = 'other_processor'; }],
  ['version', (m) => { m.knowledge[0].version = 'synthetic_v2'; }],
  ['license', (m) => { m.assets[0].license.expires_at = '2098-01-01T00:00:00Z'; }],
]) {
  test('old fixture confirmation fails after ' + name + ' changes', async (t) => {
    const s = await sample(t);
    mutate(s.manifest);
    await save(s, false);
    has(await check(s), 'STALE_CONFIRMATION');
  });
}
for (const name of ['brief.md', 'knowledge.md', 'asset.svg']) {
  test('actual byte tampering is rejected for ' + name, async (t) => {
    const s = await sample(t);
    const original = await readFile(path.join(s.root, name));
    original[0] ^= 1;
    await writeFile(path.join(s.root, name), original);
    has(await check(s), 'HASH_MISMATCH');
  });
}
for (const status of ['unknown', 'expired', 'revoked']) {
  test('license status ' + status + ' is rejected even with a matching fixture digest', async (t) => {
    const s = await sample(t);
    s.manifest.assets[0].license.status = status;
    await save(s);
    has(await check(s), 'LICENSE_NOT_GRANTED');
  });
}
test('grant expiry at the exact clock boundary is denied', async (t) => {
  const s = await sample(t);
  s.manifest.assets[0].license.expires_at = now.toISOString();
  await save(s);
  has(await check(s), 'LICENSE_EXPIRED');
});
test('revocation record is denied despite a granted status', async (t) => {
  const s = await sample(t);
  s.manifest.assets[0].license.revoked_at = '2026-10-21T00:00:00Z';
  await save(s);
  has(await check(s), 'LICENSE_REVOKED');
});
for (const [property, expected] of [
  ['allowed_purposes', 'PURPOSE_NOT_ALLOWED'], ['allowed_processors', 'PROCESSOR_NOT_ALLOWED'],
]) {
  test('scope mismatch: ' + property, async (t) => {
    const s = await sample(t);
    s.manifest.assets[0].license[property] = ['synthetic_other'];
    await save(s);
    has(await check(s), expected);
  });
}
for (const field of ['source_ref', 'version', 'sha256']) {
  test('missing asset ' + field + ' fails closed', async (t) => {
    const s = await sample(t);
    delete s.manifest.assets[0][field];
    await save(s);
    has(await check(s), 'INVALID_MANIFEST');
  });
}
test('unknown fields and real data classification are rejected', async (t) => {
  const s = await sample(t);
  s.manifest.secret = 'do-not-echo-this-private-value';
  s.manifest.data_classification = 'real';
  await save(s);
  const result = await check(s);
  has(result, 'INVALID_MANIFEST');
  assert.ok(!JSON.stringify(result).includes('do-not-echo'));
});
test('fixture confirmation cannot impersonate human approval', async (t) => {
  const s = await sample(t);
  s.manifest.confirmation.kind = 'human_approved';
  await save(s);
  has(await check(s), 'INVALID_MANIFEST');
});
test('knowledge entries must use the same exact release', async (t) => {
  const s = await sample(t);
  s.manifest.knowledge.push({ ...s.manifest.knowledge[0], id: 'synthetic_second',
    release_id: 'synthetic_release_v2', path: 'other.md' });
  await writeFile(path.join(s.root, 'other.md'), await readFile(path.join(s.root, 'knowledge.md')));
  await save(s);
  has(await check(s), 'KNOWLEDGE_RELEASE_MISMATCH');
});
test('declared asset byte size must match its actual file', async (t) => {
  const s = await sample(t);
  s.manifest.assets[0].byte_size++;
  await save(s);
  has(await check(s), 'SIZE_MISMATCH');
});
test('duplicate identities and declared paths are rejected', async (t) => {
  const s = await sample(t);
  s.manifest.assets.push(structuredClone(s.manifest.assets[0]));
  await save(s);
  const result = await check(s);
  has(result, 'DUPLICATE_ID');
  has(result, 'DUPLICATE_PATH');
});
test('path traversal, absolute, UNC, URL, ADS, backslash and reserved paths are rejected', async (t) => {
  const s = await sample(t);
  for (const candidate of ['../asset.svg', '/asset.svg', 'C:/private/file', '//server/share',
    'https://example.com/file', 'asset.svg:secret', 'folder\\asset.svg', 'NUL.svg', '.env']) {
    s.manifest.assets[0].path = candidate;
    await save(s);
    has(await check(s), 'UNSAFE_PATH');
  }
});
test('directory in place of a file is denied', async (t) => {
  const s = await sample(t);
  await mkdir(path.join(s.root, 'folder'));
  s.manifest.assets[0].path = 'folder';
  await save(s);
  has(await check(s), 'NOT_REGULAR_FILE');
});
test('directory junction or symlink cannot redirect declared files', async (t) => {
  const s = await sample(t);
  const outside = await sample(t);
  await symlink(outside.root, path.join(s.root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  s.manifest.assets[0].path = 'linked/asset.svg';
  await save(s);
  has(await check(s), 'LINK_NOT_ALLOWED');
});
test('linked root is denied', async (t) => {
  const s = await sample(t);
  const target = await sample(t);
  const linkedRoot = path.join(s.root, 'linked');
  await symlink(target.root, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir');
  const result = await validatePilotPackage({ manifestPath: path.join(linkedRoot, 'manifest.json'), now });
  has(result, 'LINK_NOT_ALLOWED');
});
test('explicit root cannot read a manifest outside itself', async (t) => {
  const s = await sample(t);
  const outside = await sample(t);
  const result = await validatePilotPackage({ manifestPath: outside.manifestPath, rootDir: s.root, now });
  has(result, 'OUTSIDE_ROOT');
});
test('oversized manifest is rejected before JSON parsing', async (t) => {
  const s = await sample(t);
  await writeFile(s.manifestPath, Buffer.alloc(PILOT_LIMITS.manifestBytes + 1, 32));
  has(await check(s), 'FILE_TOO_LARGE');
});
test('oversized actual file is rejected before hashing', async (t) => {
  const s = await sample(t);
  await truncate(path.join(s.root, 'asset.svg'), PILOT_LIMITS.fileBytes + 1);
  has(await check(s), 'FILE_TOO_LARGE');
});
test('asset count is bounded before any file reads', async (t) => {
  const s = await sample(t);
  s.manifest.assets = Array.from({ length: PILOT_LIMITS.assets + 1 }, () =>
    structuredClone(s.manifest.assets[0]));
  await save(s);
  has(await check(s), 'INVALID_MANIFEST');
});
test('aggregate bytes are bounded across all declared files', async (t) => {
  const s = await sample(t);
  const bytes = Buffer.alloc(PILOT_LIMITS.fileBytes, 32);
  const template = s.manifest.assets[0];
  s.manifest.assets = [];
  for (let i = 0; i < 4; i++) {
    const name = 'large' + i + '.txt';
    await writeFile(path.join(s.root, name), bytes);
    s.manifest.assets.push({ ...structuredClone(template), path: name, asset_id: 'synthetic_' + i,
      sha256: sha(bytes), byte_size: bytes.length, mime_type: 'text/plain' });
  }
  await save(s);
  has(await check(s), 'PACKAGE_TOO_LARGE');
});
test('bad JSON and missing packages fail without raw exception text', async (t) => {
  const s = await sample(t);
  await writeFile(s.manifestPath, '{"private-string":');
  has(await check(s), 'INVALID_JSON');
  const result = await validatePilotPackage({ manifestPath: path.join(s.root, 'missing-private-value.json'), now });
  has(result, 'PACKAGE_UNREADABLE');
  assert.ok(!JSON.stringify(result).includes('missing-private-value'));
});
test('CLI exit 0/1/2 is structured, read-only and does not leak paths or raw values', async (t) => {
  const s = await sample(t);
  const good = runCli(['--manifest', s.manifestPath]);
  assert.equal(good.status, 0, good.stderr);
  assert.equal(JSON.parse(good.stdout).ok, true);
  const before = await readFile(s.manifestPath);
  s.manifest.assets[0].path = '../private-credential-name';
  await save(s);
  const bad = runCli(['--manifest', s.manifestPath]);
  assert.equal(bad.status, 1);
  assert.equal(bad.stderr, '');
  assert.equal(JSON.parse(bad.stdout).ok, false);
  assert.ok(!bad.stdout.includes(s.root));
  assert.ok(!bad.stdout.includes('private-credential-name'));
  const usage = runCli(['--manifest', s.manifestPath, '--unknown', 'do-not-echo']);
  assert.equal(usage.status, 2);
  assert.equal(JSON.parse(usage.stdout).errors[0].code, 'USAGE');
  assert.ok(!usage.stdout.includes('do-not-echo'));
  assert.notDeepEqual(before, await readFile(s.manifestPath));
  const saved = await readFile(s.manifestPath);
  runCli(['--manifest', s.manifestPath]);
  assert.deepEqual(await readFile(s.manifestPath), saved);
});

test('pure entry-path validation rejects remote and device names before filesystem I/O', () => {
  const unsafe = [
    String.raw`\\server\share\manifest.json`, '//server/share/manifest.json',
    String.raw`\\?\C:\package\manifest.json`,
    String.raw`\\.\C:\package\manifest.json`,
    String.raw`\??\C:\package\manifest.json`,
    String.raw`\Device\HarddiskVolume1\package`,
    '/\\server/share', 'https://example.com/package.json', 'file:///package.json',
    'smb://server/share/package.json', 'C:drive-relative.json',
  ];
  for (const candidate of unsafe) {
    assert.throws(() => resolveLocalPackagePaths({ manifestPath: candidate }),
      (failure) => failure.code === 'UNSAFE_PATH');
    assert.throws(() => resolveLocalPackagePaths({ manifestPath: 'never-read.json', rootDir: candidate }),
      (failure) => failure.code === 'UNSAFE_PATH');
  }
  const local = resolveLocalPackagePaths({ manifestPath: 'tests/pilot-input/fixtures/valid/manifest.json' });
  assert.equal(local.manifestAbsolute, path.resolve('tests/pilot-input/fixtures/valid/manifest.json'));
  assert.equal(local.rootAbsolute, path.dirname(local.manifestAbsolute));
  if (process.platform === 'win32') {
    const drivePath = String.raw`C:\local-package\manifest.json`;
    assert.equal(resolveLocalPackagePaths({ manifestPath: drivePath }).manifestAbsolute, drivePath);
  }
});
test('entry-path guard returns sanitized UNSAFE_PATH for manifest and root arguments', async () => {
  // The pure guard above has no fs dependency and is the first operation before I/O.
  for (const candidate of [String.raw`\\server\share\package`, 'file:///package']) {
    for (const options of [
      { manifestPath: candidate }, { manifestPath: 'never-read.json', rootDir: candidate },
    ]) {
      const result = await validatePilotPackage({ ...options, now });
      assert.deepEqual(result.errors, [{ code: 'UNSAFE_PATH', field: 'package' }]);
      assert.ok(!JSON.stringify(result).includes(candidate));
    }
  }
  const relative = runCli(['--manifest', path.relative(process.cwd(), path.join(fixtures, 'manifest.json'))]);
  assert.equal(relative.status, 0, relative.stderr);
  assert.equal(JSON.parse(relative.stdout).ok, true);
});
