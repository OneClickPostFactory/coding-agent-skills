# Trigger Tests

`tests/fixtures/triggers/cases.json` provides executable positive, negative, and wrong-skill cases for every pilot skill.

- Repository orientation must trigger `repo-map`, not build or runtime validation.
- Static route-surface tracing must trigger `route-trace`, not repository mapping or runtime truth.
- Value-free environment variable mapping must trigger `env-audit`, not runtime truth or
  secret-value inspection.
- Redacted high-confidence secret exposure detection must trigger `secret-audit`, not
  environment variable mapping or runtime truth.
- Static API contract mapping must trigger `api-contract-audit`, not runtime truth or
  build verification.
- Static migration/schema review must trigger `migration-review`, not runtime truth,
  deployment, or migration execution.
- Local validation must trigger `build-verify` only when project-native checks are requested.
- Git readiness must trigger `git-preflight`, not publication.
- Process/listener/health questions must trigger `runtime-truth`, not restart behavior.
- Claim reconciliation must trigger `llm-drift-control`, not documentation rewriting.

Mutation, deployment, publication, restart, and rewrite requests select no pilot skill. Ambiguous requests must select the least-privileged applicable workflow or request clarification.
