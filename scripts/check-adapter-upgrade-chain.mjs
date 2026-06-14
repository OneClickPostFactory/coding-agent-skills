import { adapterChainCliResult } from "./lib/adapter-upgrade-chain.mjs";
import { parseEvidenceCliArguments } from "./lib/safe-evidence-output.mjs";

let outcome;
try {
  const parsed = parseEvidenceCliArguments(process.argv.slice(2), 1);
  outcome = parsed.ok
    ? adapterChainCliResult(parsed.positional[0], {
        json: parsed.json,
        output: parsed.output,
      })
    : {
        exitCode: 2,
        stream: "stderr",
        lines: [
          "usage: node scripts/check-adapter-upgrade-chain.mjs " +
            "<chain-root> [--json | --output <file>]",
        ],
      };
} catch {
  outcome = {
    exitCode: 2,
    stream: "stderr",
    lines: ["adapter upgrade chain validation failed internally"],
  };
}

for (const line of outcome.lines) {
  if (outcome.stream === "stdout") console.log(line);
  else console.error(line);
}
process.exitCode = outcome.exitCode;
