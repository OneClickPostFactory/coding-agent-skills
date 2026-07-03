## Safe

```bash
coding-agent-skills env-audit /workspace/app
```

Produces a value-free list of names such as `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, and
`PORT`, with file references and classifications.

```bash
node scripts/render-env-audit.mjs tests/fixtures/env-audit/static-project
```

Runs the synthetic fixture scanner without reading `.env` files or contacting services.

## Unsafe

```bash
cat .env
```

Secret-file reads are forbidden.

```bash
npm run dev
```

Runtime checks are outside this skill.
