import { adapterRepoMapCliResult } from "./lib/adapter-repo-map.mjs";

const outcome = adapterRepoMapCliResult(process.argv[2]);
for (const line of outcome.lines) {
  if (outcome.stream === "stdout") console.log(line);
  else console.error(line);
}
process.exitCode = outcome.exitCode;
