import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// This foundation batch preserves the accepted preview. Future preview work must
// deliberately review and update this baseline as part of its own change.
export const PREVIEW_BASELINE = "714cf137f136f9a8b951b38a0a2a846d01b377aa";
export const PREVIEW_PATHS = ["apps/web", ".openai/hosting.json", "scripts/run-next.mjs", "scripts/stage-export.mjs", "docs/sources/architecture-v0.5.md"];

export function checkPreview({ cwd = process.cwd(), baseline = PREVIEW_BASELINE } = {}) {
  const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  try {
    git(["cat-file", "-e", `${baseline}^{commit}`]);
  } catch {
    throw new Error(`Preview baseline ${baseline} is unavailable. Fetch repository history before running this guard.`);
  }
  const changed = git(["diff", "--no-ext-diff", "--name-status", baseline, "--", ...PREVIEW_PATHS]).trim();
  const added = git(["ls-files", "--others", "--exclude-standard", "--", ...PREVIEW_PATHS]).trim();
  if (changed || added) {
    throw new Error(`Preview preservation guard failed. This cloud foundation batch must preserve the preview; future preview changes require a reviewed baseline update.\n${[changed, added].filter(Boolean).join("\n")}`);
  }
  return { baseline, paths: [...PREVIEW_PATHS] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    checkPreview();
    console.log(`Preview unchanged from ${PREVIEW_BASELINE}: app, assets, export scripts, Sites binding, and original V0.5 source.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
