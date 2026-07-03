Adapters may enable `secret-audit` by declaring the skill ID with unchanged `audit-only`
mode and compatible version `0.2.3` or `0.2.x`.

Useful extension fields:

- `safeReadPaths`: source, docs, sample, and config paths safe for static pattern scanning.
- `ignoredPaths`: generated, dependency, runtime-output, and secret-bearing paths to skip.
- `documentationPrecedence`: docs that explain known synthetic fixtures or report policy.
- `requiredEvidence`: evidence the report must include before completion.

Adapters must not add `.env`, credentials, secret stores, credential API calls, rotation,
builds, tests, deployments, migrations, or project writes.
