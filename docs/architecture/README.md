# Architecture

The library uses a hybrid model:

- This standalone repository owns general shared skills, contracts, and schemas.
- Project repositories may own narrow adapters that add local manifests, documentation precedence, ignored paths, or safe detection rules.

Skills consume the evidence-pack contract but do not depend on hidden state. Audit-only and action-capable behavior remain separate. Adapters may only narrow permissions or enrich evidence; shared restrictions and completion rules take precedence.

## Pilot Skills

Audit-only:

- `repo-map`
- `route-trace`
- `env-audit`
- `secret-audit`
- `git-preflight`
- `runtime-truth`
- `llm-drift-control`

Controlled local validation:

- `build-verify`

The evidence pack is a shared output contract, not an executable skill. Deployment
preflight, GitHub handoff, provider operations, and additional project adapters remain
separate future work.
