# Trigger Tests

For each skill, test representative positive, negative, and ambiguous prompts.

- Repository orientation must trigger `repo-map`, not build or runtime validation.
- Local validation must trigger `build-verify` only when project-native checks are requested.
- Git readiness must trigger `git-preflight`, not publication.
- Process/listener/health questions must trigger `runtime-truth`, not restart behavior.
- Claim reconciliation must trigger `llm-drift-control`, not documentation rewriting.

Ambiguous requests must select the least-privileged applicable workflow or request clarification.
