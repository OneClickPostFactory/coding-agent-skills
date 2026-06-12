# Evidence Retention And Privacy

## Collection

Collect only evidence required to justify the skill result. Prefer concise summaries and references over raw output.

## Sanitization

Never retain token values, cookies, private keys, authenticated headers, connection strings, private tenant identifiers, or secret-file contents. Replace private paths, domains, emails, and IDs when they are not necessary to understand the result.

## Retention

- Ephemeral command output should remain in the active task unless retention is explicitly required.
- Persisted evidence packs must be sanitized before writing.
- Validation output belongs in ignored `validation-output/` or `test-results/` directories.
- Delete temporary authentication helpers immediately after use.

## Local Credentials

Local `.env` files may supply credentials for separately approved operations. Load them without shell tracing, reference environment variables, avoid credential-bearing output, and never commit them.

Recommend credential rotation only when evidence shows printing, copying, committing, pushing, or external exposure.
