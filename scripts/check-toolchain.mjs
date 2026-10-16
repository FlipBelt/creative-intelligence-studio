import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function readNpmVersion() {
  const command = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm --version"] : ["--version"];
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) {
    throw new Error("Unable to read npm from PATH. Install the npm version in packageManager.");
  }
  return result.stdout.trim();
}

export function checkToolchain({ cwd = process.cwd(), nodeVersion = process.versions.node, npmVersion = readNpmVersion() } = {}) {
  const node = readFileSync(resolve(cwd, ".nvmrc"), "utf8").trim();
  const manifest = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf8"));
  const npm = /^npm@(\d+\.\d+\.\d+)$/.exec(manifest.packageManager ?? "")?.[1];
  if (!/^\d+\.\d+\.\d+$/.test(node) || !npm) {
    throw new Error("Pin exact versions in .nvmrc and packageManager (npm@x.y.z).");
  }
  if (manifest.engines?.node !== node || manifest.engines?.npm !== npm) {
    throw new Error("package.json engines must match .nvmrc and packageManager exactly.");
  }
  if (nodeVersion !== node || npmVersion !== npm) {
    throw new Error(`Toolchain mismatch: required Node ${node} / npm ${npm}; found Node ${nodeVersion} / npm ${npmVersion}.`);
  }
  return { node, npm };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const versions = checkToolchain();
    console.log(`Toolchain OK: Node ${versions.node} / npm ${versions.npm}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
