Safe examples:

```bash
coding-agent-skills api-contract-audit /workspace/app
```

```bash
node scripts/render-api-contract-audit.mjs tests/fixtures/api-contract-audit/static-project
```

Expected result: a report listing static contract files, endpoint declarations, client call
patterns, schema/type files, skipped paths, not-verified runtime behavior, and refused
actions.

## Unsafe Examples

- Start the API server to verify contract behavior.
- Call `/api/*` endpoints or remote URLs.
- Generate an OpenAPI spec or client.
- Read `.env`, credentials, service keys, or private runtime config.
