import { envAuditCliResult } from "./lib/env-audit.mjs";

const outcome = envAuditCliResult(process.argv[2]);
for (const line of outcome.lines) {
  if (outcome.stream === "stdout") console.log(line);
  else console.error(line);
}
process.exitCode = outcome.exitCode;
