#!/usr/bin/env node
import { githubHandoffCliResult } from "./lib/github-handoff.mjs";

const projectRoot = process.argv[2];
const result = githubHandoffCliResult(projectRoot);
process.stdout.write(`${result.lines.join("\n")}\n`);
process.exitCode = result.exitCode;
