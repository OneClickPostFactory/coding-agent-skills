# Npm Package Release

The package is prepared for public npm distribution as a dependency-free CLI wrapper
around the existing validated scripts. Publication does not change the shared skill
safety model.

## Current Package Shape

- Package name: `coding-agent-skills`.
- Package version: `0.2.15`.
- CLI bin: `coding-agent-skills` mapped to `bin/coding-agent-skills`.
- Module type: `module`.
- Dependencies: none.
- Publication mode: public package on the public npm registry.
- License metadata: `MIT`.
- Node requirement: `>=20`.

Install globally with:

```bash
npm install -g coding-agent-skills
```

The supported installed commands are:

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
coding-agent-skills validate-adapters /path/to/adapter-root
```

The package can also be executed without a repo-local install:

```bash
npx coding-agent-skills validate-pack
```

Adapter compatibility remains controlled by the existing shared core and
project-adapter validators. `route-trace` is static and audit-only; it reports route
files and route declarations without executing the target project. `env-audit` is static
and audit-only; it reports environment variable names without reading `.env` files or
printing values.
`secret-audit` is static and audit-only; it reports high-confidence secret-like finding
paths, types, and counts without printing matched values, reading `.env` files, or
validating credentials.
`api-contract-audit` is static and audit-only; it reports contract files, endpoint
declarations, client-call patterns, schema/type files, and not-verified runtime behavior
without running servers, calling APIs, or generating clients or schemas.
`migration-review` is static and audit-only; it reports migration files, schema/config
files, package script keys, static risk indicators, and not-verified database behavior
without connecting to databases, applying migrations, generating ORM clients, or reading
secrets.
`github-handoff` is local Git metadata only; it reports branch state, HEAD, tags at HEAD,
remote names, and changed-file summaries without printing remote URLs, reading tokens,
creating pull requests, committing, pushing, tagging, or calling GitHub APIs.
`deployment-preflight` is static and audit-only; it reports deployment config files,
deployment docs, package script keys, platform indicators, risk indicators, and
not-verified provider/runtime behavior without deploying, calling provider APIs,
installing packages, building, testing, or reading secrets.

`coding-agent-skills validate-pack` is package-aware. In a source checkout, it keeps
source-only checks such as `.gitignore` validation. In an installed package tree, where
`.gitignore` is not packaged, it validates the package metadata, strict `files`
allowlist, dependency-free shape, bin mapping, required packaged files, and absence of
environment files instead of silently skipping safety checks.

## Included Files

The package uses a strict `files` allowlist. It includes the local command wrapper,
scripts, skills, schemas, contracts, docs, examples, tests, and governance files needed
for `coding-agent-skills validate-pack` to work after packaging.

The allowlist intentionally excludes local environment files, Git internals, generated
validation output, dependency folders, and project-specific adapters.

## Dry-Run And Publish Checks

Before publication, run the dry-run package inspection:

```bash
npm pack --dry-run
npm publish --dry-run --access public --registry=https://registry.npmjs.org/
```

The dry-run output must be reviewed for accidental secrets, local-only files, environment
files, dependency folders, build artifacts, generated validation output, or unrelated
project files. It must also confirm that the bin wrapper and validation inputs are
included.

## Safety Boundaries

The public CLI remains read-only for target projects unless a specific underlying skill
already permits a bounded local validation action. The installed `repo-map`,
`route-trace`, `env-audit`, `secret-audit`, `api-contract-audit`, `migration-review`,
`github-handoff`, `deployment-preflight`, and adapter flows do not:

- deploy
- run migrations
- mutate runtime services or processes
- read `.env` or secret files
- execute target project application code
- run target project builds or tests
- grant adapters additional power

Project adapters narrow context for safer repository understanding; they do not weaken
shared restrictions or authorize additional command families.
