import { adapterUpgradeCliResult } from "./lib/adapter-upgrade.mjs";

const outcome = adapterUpgradeCliResult(process.argv[2], process.argv[3]);
for (const line of outcome.lines) {
  if (outcome.stream === "stdout") console.log(line);
  else console.error(line);
}
process.exitCode = outcome.exitCode;
