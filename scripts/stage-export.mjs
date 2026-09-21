import { cpSync, existsSync, mkdirSync } from "node:fs";
if (!existsSync("apps/web/out/index.html")) throw new Error("Missing static export");
mkdirSync("out", { recursive: true });
cpSync("apps/web/out", "out", { recursive: true });
console.log("Static export ready: out/");
