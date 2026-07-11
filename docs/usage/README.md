# Using The Pilot Skills

Select the least-privileged skill that matches the request:

| Need | Skill |
|---|---|
| Understand repository identity and structure | `repo-map` |
| Trace statically visible route surfaces | `route-trace` |
| Map environment variable names without values | `env-audit` |
| Find high-confidence secret exposure risks without values | `secret-audit` |
| Map static API contract surfaces | `api-contract-audit` |
| Review static migration and schema evidence | `migration-review` |
| Prepare local GitHub handoff evidence | `github-handoff` |
| Map static deployment readiness evidence | `deployment-preflight` |
| Collect one deterministic static evidence bundle | `audit` |
| Run existing local validation checks | `build-verify` |
| Assess Git handoff readiness | `git-preflight` |
| Determine what is actually running | `runtime-truth` |
| Reconcile claims with evidence | `llm-drift-control` |

## Typical Flow

1. Use `repo-map` when repository identity or boundaries are not established.
2. Use `route-trace` when route files or declarations must be mapped from static files.
3. Use `env-audit` when environment variable names or sample config references must be
   mapped without reading values.
4. Use `secret-audit` when high-confidence tracked secret exposure risk must be reported
   by path, type, and count without printing matched values.
5. Use `api-contract-audit` when OpenAPI/Swagger files, endpoint declarations, client
   calls, and schema/type files must be mapped without runtime behavior.
6. Use `migration-review` when database migration, schema, config, package-script-key,
   and static risk-indicator evidence must be mapped without database access.
7. Use `github-handoff` when local Git metadata and changed-file summaries are needed
   before separately approved GitHub work.
8. Use `deployment-preflight` when visible deployment config, docs, package script keys,
   and platform hints must be mapped without deployment behavior.
9. Perform implementation outside this pilot pack.
10. Use `build-verify` for approved project-native checks.
11. Use `git-preflight` before handoff or publication.
12. Use `runtime-truth` only when live local state matters.
13. Use `llm-drift-control` when claims and evidence may disagree.

Every skill emits an evidence pack. Read `status`, skipped checks, failures, confidence, and changed state before relying on a completion claim.

Render read-only `repo-map` context with:

```bash
node scripts/render-adapter-repo-map.mjs <project-root>
```

When a project owns a compatible adapter, this validates the adapter first and reports
adapter-declared documentation precedence, safe read paths, ignored paths, and required
evidence. When no `.coding-agent` declaration exists, adapters remain optional: `repo-map`
uses `generic-safe-discovery`, reports `adapterPresent: false`, reduces confidence, and
still refuses builds, tests, runtime checks, deployments, migrations, package installs, and
secret-file reads.

See [examples](../../examples/README.md) for safe concrete inputs and outputs.

## Public CLI Surface

Install the CLI from the public npm registry:

```bash
npm install -g coding-agent-skills
```

Run supported commands:

```bash
coding-agent-skills validate-pack
coding-agent-skills validate-project /path/to/project
coding-agent-skills repo-map /path/to/project
coding-agent-skills route-trace /path/to/project
coding-agent-skills env-audit /path/to/project
coding-agent-skills secret-audit /path/to/project
coding-agent-skills api-contract-audit /path/to/project
coding-agent-skills migration-review /path/to/project
coding-agent-skills github-handoff /path/to/project
coding-agent-skills deployment-preflight /path/to/project
coding-agent-skills audit /path/to/project
coding-agent-skills validate-adapters /path/to/adapter-root
```

For one-off execution, use:

```bash
npx coding-agent-skills validate-pack
```

These commands wrap the same validated scripts shipped in the repository. `repo-map`
uses adapter metadata when present and valid; otherwise it falls back to generic safe
discovery with reduced confidence and clear adapter-absence warnings.
`route-trace` validates a project adapter when present, uses adapter-declared safe paths
when enabled, and statically reports verified route files, inferred route declarations,
skipped items, and not-verified runtime-dependent route classes.
`env-audit` validates a project adapter when present, uses adapter-declared safe paths
when enabled, and statically reports environment variable names, classifications, sample
files inspected, skipped secret-bearing paths, and not-verified runtime or credential
stores without printing values.
`secret-audit` validates a project adapter when present, uses adapter-declared safe paths
when enabled, and statically reports high-confidence secret-like finding paths, types, and
counts without printing matched values or validating credentials.
`api-contract-audit` validates a project adapter when present, uses adapter-declared safe
paths when enabled, and statically reports contract files, endpoint declarations,
client-call patterns, schema/type files, skipped paths, and not-verified runtime behavior.
`migration-review` validates a project adapter when present, uses adapter-declared safe
paths when enabled, and statically reports migration files, schema/config files, package
script keys, risk indicators, skipped paths, and not-verified database behavior without
database access or migration execution.
`github-handoff` validates a project adapter when present, then reports local Git branch
state, HEAD, tags at HEAD, remote names, and changed-file summaries without printing
remote URLs, committing, pushing, tagging, creating pull requests, calling GitHub APIs,
or reading tokens.
`deployment-preflight` validates a project adapter when present, uses adapter-declared
safe paths when enabled, and statically reports deployment config files, deployment docs,
package script keys, platform indicators, risk indicators, skipped paths, and
not-verified provider/runtime behavior without deploying or calling provider APIs.
`audit` executes the eight existing safe static audit libraries in fixed order and
returns one concise human report or one structured JSON envelope. Non-applicable
adapter-limited audits are marked partial/skipped; missing adapters use generic safe
discovery; invalid or unsafe adapters fail closed.

The installed CLI does not run target project builds or tests, perform runtime checks,
deploy, migrate, mutate services or processes, or read `.env` files. Project adapters
narrow context; they do not grant additional power or weaken shared restrictions.

## Machine-Readable Output

Every public CLI command accepts optional `--json` for OpenClaw-style tool callers:

```bash
coding-agent-skills repo-map /path/to/project --json
coding-agent-skills validate-pack --json
coding-agent-skills audit /path/to/project --json
```

The default human-readable output is unchanged. JSON output is sanitized and includes:

- `success`
- `status`
- `tool`
- `command`
- `skillId`
- `packageVersion`
- `mode`
- `changedState`
- `summary`
- `findings`
- `warnings`
- `risks`
- `skipped`
- `notVerified`
- `refusedBehavior`
- `adapter`
- `recommendedNextAction`
- `safety`
- `exitCode`
- `exitCodeMeaning`
- command-specific `details`, `results`, `metrics`, or `evidence` when applicable

The normative contract is [cli-result.schema.json](../../schemas/cli-result.schema.json).
Semantic validation additionally requires package-version agreement, immutable read-only
safety flags, consistent completion state, and stable missing-input/safety-refusal codes.

Exit-code semantics:

- `0`: handled execution path, including complete, partial, blocked, or controlled audit result
- `2`: usage error
- `3`: safety refusal
- `4`: missing required input or file
- `5`: unexpected internal or runtime failure

OpenClaw or another orchestrator should own memory, routing, permissions, scheduling,
chat/user interaction, and workflow state. This package remains a read-only external tool
and evidence producer.

## Local Command Surface

From the shared skill repository root, the same wrapper can be used directly:

```bash
bin/coding-agent-skills validate-pack
bin/coding-agent-skills validate-project /path/to/project
bin/coding-agent-skills repo-map /path/to/project
bin/coding-agent-skills route-trace /path/to/project
bin/coding-agent-skills env-audit /path/to/project
bin/coding-agent-skills secret-audit /path/to/project
bin/coding-agent-skills api-contract-audit /path/to/project
bin/coding-agent-skills migration-review /path/to/project
bin/coding-agent-skills github-handoff /path/to/project
bin/coding-agent-skills deployment-preflight /path/to/project
bin/coding-agent-skills audit /path/to/project
bin/coding-agent-skills validate-adapters /path/to/adapter-root
```

If the repository's `bin/` directory is already on the shell path, the same commands can
also be invoked as:

```bash
coding-agent-skills validate-pack
coding-agent-skills validate-project /path/to/project
coding-agent-skills repo-map /path/to/project
coding-agent-skills route-trace /path/to/project
coding-agent-skills env-audit /path/to/project
coding-agent-skills secret-audit /path/to/project
coding-agent-skills api-contract-audit /path/to/project
coding-agent-skills migration-review /path/to/project
coding-agent-skills github-handoff /path/to/project
coding-agent-skills deployment-preflight /path/to/project
coding-agent-skills audit /path/to/project
coding-agent-skills validate-adapters /path/to/adapter-root
```

The local wrapper follows the same safety model as the published CLI.
