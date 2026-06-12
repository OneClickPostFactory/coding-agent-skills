# Failure Modes

| Failure | Response |
|---|---|
| Starting path does not exist | Report `blocked`; request a valid path |
| Multiple plausible repositories | Report `partial` or `blocked`; show candidates without choosing silently |
| Not a Git repository | Continue structural mapping and record `not-git` |
| Git command fails | Preserve the error summary and continue only where identity remains reliable |
| Traversal is too large | Reduce depth, add exclusions, and report omitted areas |
| Manifest is malformed | Record the parse failure; use bounded text inspection if safe |
| Permission denied | Do not escalate automatically; record the inaccessible area and consequence |
| Secret-like file encountered | Do not read it; record exclusion unless approval names the file |
| Adapter conflicts with policy | Ignore the weakening rule and report the conflict |
| Required evidence missing | Do not claim `complete` |

Recovery must remain read-only. Do not install tools, alter permissions, or mutate the repository to make inspection easier.
