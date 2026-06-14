import { adapterUpgradeCliResult } from "./lib/adapter-upgrade.mjs";
import { parseEvidenceCliArguments } from "./lib/safe-evidence-output.mjs";

let outcome;
try {
  const parsed = parseEvidenceCliArguments(process.argv.slice(2), 2);
  outcome = parsed.ok
    ? adapterUpgradeCliResult(parsed.positional[0], parsed.positional[1], {
        json: parsed.json,
        output: parsed.output,
      })
    : {
        exitCode: 2,
        stream: "stderr",
        lines: [
          "usage: node scripts/check-adapter-upgrade.mjs " +
            "<before-project-root> <after-project-root> [--json | --output <file>]",
        ],
      };
} catch {
  outcome = {
    exitCode: 2,
    stream: "stderr",
    lines: ["adapter upgrade validation failed internally"],
  };
}
for (const line of outcome.lines) {
  if (outcome.stream === "stdout") console.log(line);
  else console.error(line);
}
process.exitCode = outcome.exitCode;
