import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkPreview, sourceDigest } from "./check-preview.mjs";
import { checkToolchain } from "./check-toolchain.mjs";

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "cis-cloud-check-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const write = (path, content) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  };
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
  return { cwd, write, git };
}

function previewFixture(t) {
  const repo = fixture(t);
  repo.git("init", "--quiet");
  repo.write("apps/web/app/page.tsx", "export default function Page() { return null; }\n");
  repo.write("apps/web/public/image.svg", "<svg/>\n");
  repo.write("scripts/run-next.mjs", "// original preview launcher\n");
  repo.write("scripts/stage-export.mjs", "// original exporter\n");
  repo.write(".openai/hosting.json", '{"binding":"original"}\n');
  repo.write("docs/sources/architecture-v0.5.md", "# Original V0.5 architecture\n");
  repo.git("add", ".");
  repo.git("-c", "user.name=CIS test", "-c", "user.email=cis-test@example.invalid", "commit", "--quiet", "-m", "fixture");
  return { ...repo, baseline: repo.git("rev-parse", "HEAD") };
}

test("exact Node and npm pins must agree and match the running toolchain", (t) => {
  const { cwd, write } = fixture(t);
  write(".nvmrc", "24.15.0\n");
  const manifest = { packageManager: "npm@11.19.0", engines: { node: "24.15.0", npm: "11.19.0" } };
  write("package.json", JSON.stringify(manifest));
  assert.deepEqual(checkToolchain({ cwd, nodeVersion: "24.15.0", npmVersion: "11.19.0" }), { node: "24.15.0", npm: "11.19.0" });
  assert.throws(() => checkToolchain({ cwd, nodeVersion: "24.14.0", npmVersion: "11.19.0" }), /Toolchain mismatch/);
  assert.throws(() => checkToolchain({ cwd, nodeVersion: "24.15.0", npmVersion: "11.18.0" }), /Toolchain mismatch/);
  write("package.json", JSON.stringify({ ...manifest, engines: { node: ">=24", npm: "11.19.0" } }));
  assert.throws(() => checkToolchain({ cwd, nodeVersion: "24.15.0", npmVersion: "11.19.0" }), /must match/);
});

test("foundation changes outside the preview are allowed", (t) => {
  const { cwd, write, baseline } = previewFixture(t);
  write("mock/new-contract.ts", "// new isolated mock\n");
  assert.equal(checkPreview({ cwd, baseline }).baseline, baseline);
});

for (const path of ["apps/web/app/page.tsx", "apps/web/public/image.svg", ".openai/hosting.json", "scripts/run-next.mjs", "scripts/stage-export.mjs", "docs/sources/architecture-v0.5.md"]) {
  test(`preview guard rejects changes to ${path}`, (t) => {
    const { cwd, write, baseline } = previewFixture(t);
    write(path, "changed\n");
    assert.throws(() => checkPreview({ cwd, baseline }), /Preview preservation guard failed/);
  });
}

test("preview guard also rejects staged changes and untracked preview files", (t) => {
  const { cwd, write, git, baseline } = previewFixture(t);
  write("apps/web/new-page.tsx", "// added\n");
  assert.throws(() => checkPreview({ cwd, baseline }), /new-page\.tsx/);
  git("add", ".");
  assert.throws(() => checkPreview({ cwd, baseline }), /new-page\.tsx/);
});

test("preview guard fails closed when history is unavailable", (t) => {
  const { cwd } = previewFixture(t);
  assert.throws(() => checkPreview({ cwd, baseline: "0".repeat(40) }), /Fetch repository history/);
});

test("dev container runs as node with no additional mounts or automatic server", () => {
  const config = JSON.parse(readFileSync(fileURLToPath(new URL("../.devcontainer/devcontainer.json", import.meta.url)), "utf8"));
  assert.equal(config.remoteUser, "node");
  assert.equal(config.containerUser, "node");
  for (const field of ["mounts", "workspaceMount", "runArgs", "privileged", "capAdd", "securityOpt", "features", "remoteEnv", "postStartCommand", "postAttachCommand", "initializeCommand"]) {
    assert.equal(config[field], undefined, `${field} requires a separate security review`);
  }
  assert.equal(config.postCreateCommand, "node scripts/check-toolchain.mjs && npm ci --ignore-scripts");
  assert.deepEqual(config.forwardPorts, [3100]);
  assert.equal(config.portsAttributes["3100"].onAutoForward, "silent");
});

function reviewSource(repo, files) {
  repo.write("scripts/preview-review.json", JSON.stringify({ version: 1, baseline: repo.baseline, files }));
}

test("review manifest allows only exact reviewed source including CRLF checkout", t => {
  const repo = previewFixture(t);
  const text = "export default function Page() { return <main/>; }\n";
  repo.write("apps/web/app/page.tsx", text.replace(/\n/g, "\r\n"));
  reviewSource(repo, { "apps/web/app/page.tsx": sourceDigest(Buffer.from(text)) });
  assert.deepEqual(checkPreview(repo).reviewed, ["apps/web/app/page.tsx"]);
  repo.write("apps/web/app/page.tsx", text + "// later change\n");
  assert.throws(() => checkPreview(repo), /digest differs/);
});

test("review manifest does not allow other source or media changes", t => {
  const repo = previewFixture(t);
  repo.write("apps/web/app/page.tsx", "// reviewed\n");
  reviewSource(repo, { "apps/web/app/page.tsx": sourceDigest(Buffer.from("// reviewed\n")) });
  repo.write("apps/web/new-page.tsx", "// not reviewed\n");
  assert.throws(() => checkPreview(repo), /new-page\.tsx/);
});

for (const file of [".openai/hosting.json", "scripts/run-next.mjs", "apps/web/public/image.svg", "apps/web/../page.tsx"]) {
  test("review manifest cannot exempt " + file, t => {
    const repo = previewFixture(t);
    reviewSource(repo, { [file]: "a".repeat(64) });
    assert.throws(() => checkPreview(repo), /invalid reviewed source path/);
  });
}

test("review manifest rejects malformed config, wrong baseline and missing source", t => {
  const repo = previewFixture(t);
  repo.write("scripts/preview-review.json", "{");
  assert.throws(() => checkPreview(repo), /manifest invalid/);
  repo.write("scripts/preview-review.json", JSON.stringify({version:1,baseline:"0".repeat(40),files:{}}));
  assert.throws(() => checkPreview(repo), /invalid structure/);
  reviewSource(repo, { "apps/web/missing.ts": "a".repeat(64) });
  assert.throws(() => checkPreview(repo), /manifest invalid/);
});

test("source digests reject invalid UTF-8", () => {
  assert.throws(() => sourceDigest(Buffer.from([0xff])));
});
