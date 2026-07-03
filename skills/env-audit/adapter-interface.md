Adapters may enable `env-audit` by declaring the skill ID with unchanged `audit-only`
mode and compatible version `0.2.3` or `0.2.x`.

Useful extension fields:

- `safeReadPaths`: source, docs, sample, and config paths that may contain env names.
- `ignoredPaths`: generated, dependency, runtime-output, and secret-bearing paths to skip.
- `documentationPrecedence`: docs that may explain required or optional env names.
- `requiredEvidence`: evidence the report must include before completion.

Adapters must not add `.env`, `.env.*` except `.env.example`, credentials, secret stores,
runtime checks, API calls, builds, tests, deployments, migrations, or project writes.
