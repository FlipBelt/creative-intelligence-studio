import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Preview source changes require an explicit, reviewed file digest. Deployment
// bindings, export scripts, media and the original source remain protected.
export const PREVIEW_BASELINE = "714cf137f136f9a8b951b38a0a2a846d01b377aa";
export const PREVIEW_PATHS = ["apps/web", ".openai/hosting.json", "scripts/run-next.mjs", "scripts/stage-export.mjs", "docs/sources/architecture-v0.5.md"];
const REVIEW_FILE = "scripts/preview-review.json";

export function sourceDigest(bytes) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

function reviewedFiles(cwd, baseline) {
  const path = resolve(cwd, REVIEW_FILE);
  if (!existsSync(path)) return {};
  try {
    const config = JSON.parse(readFileSync(path, "utf8"));
    if (!config || Array.isArray(config) || Object.keys(config).sort().join(",") !== "baseline,files,version" ||
        config.version !== 1 || config.baseline !== baseline || !config.files || Array.isArray(config.files) ||
        typeof config.files !== "object" || Object.keys(config.files).length > 20) throw new Error("invalid structure or baseline");
    for (const [file, digest] of Object.entries(config.files)) {
      if (!/^apps\/web\/[A-Za-z0-9_./-]+\.(?:tsx?|css)$/.test(file) ||
          file.split("/").some(part => !part || part === "." || part === "..") ||
          typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) throw new Error("invalid reviewed source path or digest");
      const full = resolve(cwd, file), actual = relative(realpathSync(cwd), realpathSync(full));
      if (isAbsolute(actual) || actual === ".." || actual.startsWith("../") || actual.startsWith("..\\")) throw new Error("source escapes repository");
      if (!lstatSync(full).isFile() || lstatSync(full).isSymbolicLink()) throw new Error("source must be a regular file");
      if (sourceDigest(readFileSync(full)) !== digest) throw new Error("reviewed source digest differs: " + file);
    }
    return config.files;
  } catch (error) {
    throw new Error("Preview review manifest invalid: " + error.message);
  }
}

export function checkPreview({ cwd = process.cwd(), baseline = PREVIEW_BASELINE } = {}) {
  const git = args => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  try { git(["cat-file", "-e", baseline + "^{commit}"]); }
  catch { throw new Error("Preview baseline " + baseline + " is unavailable. Fetch repository history before running this guard."); }
  const reviewed = reviewedFiles(cwd, baseline);
  const changed = git(["diff", "--no-ext-diff", "--name-only", "-z", baseline, "--", ...PREVIEW_PATHS]).split("\0").filter(Boolean);
  const added = git(["ls-files", "--others", "--exclude-standard", "-z", "--", ...PREVIEW_PATHS]).split("\0").filter(Boolean);
  const unreviewed = [...new Set([...changed, ...added])].filter(file => !Object.hasOwn(reviewed, file));
  if (unreviewed.length) throw new Error("Preview preservation guard failed. Source changes require a reviewed baseline update.\n" + unreviewed.join("\n"));
  return { baseline, paths: [...PREVIEW_PATHS], reviewed: Object.keys(reviewed) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = checkPreview();
    console.log("Preview guard passed: " + result.reviewed.length + " reviewed source files; all other preview files, Sites binding, export scripts and original V0.5 source preserved.");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
