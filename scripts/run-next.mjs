import { spawn } from "node:child_process";
process.env.NEXT_TELEMETRY_DISABLED = "1";
const child=spawn(process.execPath,["node_modules/next/dist/bin/next",...process.argv.slice(2)],{stdio:"inherit",env:process.env});
child.on("exit",code=>process.exit(code??1));
