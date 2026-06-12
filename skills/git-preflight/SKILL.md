---
name: git-preflight
description: Inspect Git repository and handoff readiness without changing Git state. Use before commits, reviews, handoffs, or publication to report branch, HEAD, staged, unstaged, untracked, file-scope, diff-stat, and whitespace evidence; never add, commit, push, pull, merge, rebase, reset, restore, clean, checkout, switch, or stash.
---

# Git Preflight

Produce an evidence-backed description of Git state. Remain audit-only.

## Purpose And Use

Use before review, commit preparation, handoff, or publication decisions. Do not use to stage, repair, synchronize, rewrite, commit, or publish Git state.

## Inputs

Require repository path and handoff intent. Optionally accept expected branch, base branch, expected files, generated-file rules, and a project adapter.

Do not assume the current directory is the root, a dirty tree belongs to the current task, staged changes are complete, or the current branch is safe to publish.

## Command Policy

Permit read-only Git inspection such as:

- `git rev-parse`
- `git remote -v`
- `git branch --show-current`
- bounded `git log`
- `git status --short --branch`
- `git diff --check`
- `git diff --stat`
- `git diff --name-only`
- corresponding cached/staged diff inspection

Do not add, commit, push, pull, fetch with side effects, merge, rebase, reset, restore, clean, checkout, switch, stash, tag, update-index, or alter configuration.

This is audit-only behavior. Inspect full shell structure and reject wrappers or chains that conceal mutation.

## Procedure

1. Confirm the repository root and worktree.
2. Record branch, HEAD, remote identity, and detached-head state.
3. Inventory staged, unstaged, untracked, conflicted, and ignored-sensitive conditions.
4. Inspect file names and diff statistics without exposing secret contents.
5. Run whitespace/error checks.
6. Compare observed files with declared task scope and identify unrelated changes.
7. Report readiness; do not perform the handoff action.
8. Emit the shared evidence pack.

Use [checklist.md](checklist.md), [failure-modes.md](failure-modes.md), [adapter-interface.md](adapter-interface.md), [examples.md](examples.md), and [evidence-template.md](evidence-template.md).

## Evidence, Recovery, And Dependencies

Emit Git root, worktree, remote, branch, HEAD, staged/unstaged/untracked/conflicted state, diff summaries, whitespace result, scope mismatch, and readiness. Recover from detached HEAD, locks, conflicts, or nested worktrees only by reporting and narrowing inspection; never repair them.

Depend on repository identity from `repo-map` or equivalent evidence and the evidence-pack contract. Adapters may add protected-branch and generated-file rules but cannot hide dirty state. Safe usage reports handoff readiness; unsafe usage stages, restores, rebases, commits, or pushes.

## Approval Boundary

No approval can turn this audit skill into a Git mutation workflow. Direct the user to a separately approved handoff skill for changes to Git state.

## Completion

Claim `complete` when repository identity and relevant Git state are fully described, scope mismatches are reported, and no mutation occurred. A repository conflict, unreadable index, ambiguous worktree, or missing required evidence yields `partial`, `failed`, or `blocked`.

These conditions are both the acceptance criteria and definition of done.
