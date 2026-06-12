# Using The Pilot Skills

Select the least-privileged skill that matches the request:

| Need | Skill |
|---|---|
| Understand repository identity and structure | `repo-map` |
| Run existing local validation checks | `build-verify` |
| Assess Git handoff readiness | `git-preflight` |
| Determine what is actually running | `runtime-truth` |
| Reconcile claims with evidence | `llm-drift-control` |

## Typical Flow

1. Use `repo-map` when repository identity or boundaries are not established.
2. Perform implementation outside this pilot pack.
3. Use `build-verify` for approved project-native checks.
4. Use `git-preflight` before handoff or publication.
5. Use `runtime-truth` only when live local state matters.
6. Use `llm-drift-control` when claims and evidence may disagree.

Every skill emits an evidence pack. Read `status`, skipped checks, failures, confidence, and changed state before relying on a completion claim.

See [examples](../../examples/README.md) for safe concrete inputs and outputs.
