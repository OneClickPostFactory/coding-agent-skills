# Env Audit Workflow

Use `env-audit` before editing setup docs, config loaders, or handoff notes:

```bash
coding-agent-skills env-audit /workspace/project
```

Review:

- names and classifications
- sample files inspected
- skipped secret-bearing paths
- runtime and credential stores not verified

Do not use the output as proof that values exist or credentials work.
