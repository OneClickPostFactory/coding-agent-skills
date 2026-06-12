# Failure Modes

| Failure | Recovery |
|---|---|
| Not a Git repository | Report `blocked` or defer to `repo-map` |
| Detached HEAD | Report exact state and avoid publication readiness |
| Conflicts present | Report `failed` for handoff readiness |
| Index unreadable or locked | Record error; do not remove lock files |
| Nested worktree ambiguity | Identify candidates and stop before choosing silently |
| Secret-like filename appears | Report filename risk without reading content |
| Unrelated changes cannot be attributed | Mark handoff `partial` |

Never repair Git state within this skill.
