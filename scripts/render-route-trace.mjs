import { routeTraceCliResult } from "./lib/route-trace.mjs";

const outcome = routeTraceCliResult(process.argv[2]);
for (const line of outcome.lines) {
  if (outcome.stream === "stdout") console.log(line);
  else console.error(line);
}
process.exitCode = outcome.exitCode;
