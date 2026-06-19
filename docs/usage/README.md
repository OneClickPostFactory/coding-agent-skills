# Using The Pilot Skills

Select the least-privileged skill that matches the request:

| Need | Skill |
|---|---|
| Understand repository identity and structure | `repo-map` |
| Run existing local validation checks | `build-verify` |
| Assess Git handoff readiness | `git-preflight` |
| Determine what is actually running | `runtime-truth` |
| Reconcile claims with evidence | `llm-drift-control` |

## Typical Flow

1. Use `repo-map` when repository identity or boundaries are not established.
2. Perform implementation outside this pilot pack.
3. Use `build-verify` for approved project-native checks.
4. Use `git-preflight` before handoff or publication.
5. Use `runtime-truth` only when live local state matters.
6. Use `llm-drift-control` when claims and evidence may disagree.

Every skill emits an evidence pack. Read `status`, skipped checks, failures, confidence, and changed state before relying on a completion claim.

When a project owns a compatible adapter, render read-only adapter-aware `repo-map` context
with:

```bash
node scripts/render-adapter-repo-map.mjs <project-root>
```

This validates the project adapter first, then reports adapter-declared documentation
precedence, safe read paths, ignored paths, and required evidence. It is not a build,
test, runtime, deployment, migration, package-install, or secret-reading flow.

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
coding-agent-skills validate-adapters /path/to/adapter-root
```

For one-off execution, use:

```bash
npx coding-agent-skills validate-pack
```

These commands wrap the same validated scripts shipped in the repository. `repo-map`
validates the project adapter first, then renders adapter-declared documentation
precedence, safe read paths, ignored paths, and required evidence.

The installed CLI does not run target project builds or tests, perform runtime checks,
deploy, migrate, mutate services or processes, or read `.env` files. Project adapters
narrow context; they do not grant additional power or weaken shared restrictions.

## Local Command Surface

From the shared skill repository root, the same wrapper can be used directly:

```bash
bin/coding-agent-skills validate-pack
bin/coding-agent-skills validate-project /path/to/project
bin/coding-agent-skills repo-map /path/to/project
bin/coding-agent-skills validate-adapters /path/to/adapter-root
```

If the repository's `bin/` directory is already on the shell path, the same commands can
also be invoked as:

```bash
coding-agent-skills validate-pack
coding-agent-skills validate-project /path/to/project
coding-agent-skills repo-map /path/to/project
coding-agent-skills validate-adapters /path/to/adapter-root
```

The local wrapper follows the same safety model as the published CLI.
