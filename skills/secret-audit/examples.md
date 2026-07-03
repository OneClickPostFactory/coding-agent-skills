## Safe

```bash
coding-agent-skills secret-audit /workspace/app
```

Reports possible secret exposure by path, type, and count only.

```bash
node scripts/render-secret-audit.mjs tests/fixtures/secret-audit/static-project
```

Runs the synthetic fixture scanner without reading `.env` files or printing matches.

## Unsafe

```bash
cat .env
```

Secret-file reads are forbidden.

```bash
gh secret list
```

Credential-store and API inspection are outside this skill.
