Adapters may enable `api-contract-audit` only as an audit-only static inspection skill.

Allowed adapter extensions:

- `safeReadPaths` for source, docs, contract, schema, and client files.
- `ignoredPaths` for generated, dependency, build, coverage, and output directories.
- `documentationPrecedence` for API docs or contract references.
- `requiredEvidence` for contract files, route declarations, client calls, schemas, and not-verified areas.

Adapters must not:

- Add commands for `api-contract-audit`.
- Require runtime servers, URL probes, API calls, schema generation, or client generation.
- Include `.env`, credential, or secret-bearing paths.
- Change `api-contract-audit` from `audit-only` to action-capable.
- Expand scope outside the declared project root without named approval.
