# Git Preflight Workflow

**Intent:** Determine whether the working tree is understood and ready for handoff.

1. Confirm Git root, worktree, remote, branch, and HEAD.
2. Inventory staged, unstaged, untracked, and conflicted files.
3. Compare file scope with the declared task.
4. Check patch whitespace.
5. Report readiness without changing Git state.

```bash
git status --short --branch
git diff --check
git diff --stat
git diff --cached --name-only
```

**Unsafe and denied:** staging, commits, history rewriting, worktree cleanup, synchronization, and publication.
