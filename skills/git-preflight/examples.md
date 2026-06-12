# Examples

## Safe

- "Tell me whether this working tree is ready for handoff."
- `git status --short --branch`
- `git diff --check`
- `git diff --stat`
- `git diff --cached --name-only`

## Unsafe

- "Stage the right files for me."
- "Clean unrelated changes."
- "Rebase onto main, commit, and push."
- "Restore anything that does not belong."

This skill reports those needs but performs none of them.
