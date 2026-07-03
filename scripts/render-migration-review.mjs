import { migrationReviewCliResult } from "./lib/migration-review.mjs";

const outcome = migrationReviewCliResult(process.argv[2]);
for (const line of outcome.lines) {
  if (outcome.stream === "stdout") console.log(line);
  else console.error(line);
}
process.exitCode = outcome.exitCode;
