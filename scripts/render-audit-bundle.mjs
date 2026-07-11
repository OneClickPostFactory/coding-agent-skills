import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditBundleCliResult } from "./lib/audit-bundle.mjs";

const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageVersion = JSON.parse(fs.readFileSync(path.join(coreRoot, "package.json"), "utf8")).version;
const outcome = auditBundleCliResult(process.argv[2], { coreRoot, packageVersion });
const stream = outcome.stream === "stderr" ? process.stderr : process.stdout;
stream.write(`${outcome.lines.join("\n")}\n`);
process.exitCode = outcome.exitCode;
