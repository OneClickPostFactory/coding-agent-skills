# Failure Modes

| Failure | Recovery |
|---|---|
| Script is absent | Record skipped check; do not invent an equivalent |
| Dependency or executable missing | Report `blocked`; do not install |
| Validation times out | Capture partial evidence and narrow only when justified |
| Test is flaky | Rerun a bounded number of times and label instability |
| Failure predates current changes | Preserve evidence and avoid claiming current work caused it |
| Command mutates files | Stop, report the mutation, and downgrade status |
| Script behavior is unclear | Inspect its definition; reject if still uncertain |
| Broad check fails after targeted pass | Report failure; targeted success is not overall success |

Recovery remains within discovered validation commands. Repairs are outside this skill.
