---
name: github-handoff
description: Prepare read-only GitHub handoff evidence from local Git metadata. Use when Codex needs to summarize branch state, HEAD, tags at HEAD, remote names, and changed-file status before a separately approved pull request, release, or GitHub workflow handoff without creating commits, pushes, tags, pull requests, API calls, token reads, or file changes.
---

# GitHub Handoff

## Purpose And Use

Use this skill to produce a local, audit-only handoff report before a human or separately approved workflow performs GitHub work.

The skill is for local Git evidence only. It does not create pull requests, publish releases, push branches, inspect tokens, or call GitHub APIs.

## Inputs

Required:

- Project root.

Optional:

- Project adapter declaration that enables `github-handoff`.
- Human-provided handoff intent.

Do not assume:

- GitHub authentication is available.
- Local commits are pushed.
- CI status, review status, or PR state is known.
- Remote URLs are safe to print.

## Procedure

1. Confirm the project root exists.
2. Validate the project adapter when one is present.
3. If an adapter exists but does not enable `github-handoff`, report `partial` and do not list changed files.
4. Inspect local Git metadata only: root, branch state, current branch, HEAD, tags at HEAD, remote names, and status entries.
5. Redact secret-bearing changed paths such as `.env`, key files, credential paths, or token paths.
6. Summarize changed-file counts by status.
7. Record skipped and not-verified GitHub state honestly.
8. State refused behavior clearly.

## Evidence, Recovery, And Dependencies

Expected evidence:

- Git root.
- Branch state.
- Current branch.
- HEAD or short HEAD.
- Tags at HEAD.
- Remote names only, not remote URLs.
- Changed-file summary.
- Redacted path count when applicable.

Recovery:

- If the directory is not a Git repository, return `failed` with no mutation.
- If Git status is unavailable, return a warning and preserve partial evidence.
- If adapter validation fails, fail closed.

Dependencies:

- Local Git command-line tool.
- Node.js 20+ for the packaged renderer.

## Approval Boundary

This skill is audit-only.

Allowed:

- Read local Git metadata.
- List changed-file paths unless they are secret-bearing.
- Validate project adapter metadata.
- Render a handoff report.

Forbidden:

- Commit.
- Push.
- Tag.
- Checkout, reset, rebase, merge, stash, restore, or clean.
- Create pull requests.
- Create releases.
- Call GitHub APIs.
- Read tokens, `.env`, `.env.*`, `.npmrc`, keys, or credential files.
- Print remote URLs.
- Change project files.

## Completion

Complete only after a report states what was verified, what was skipped, and what was not verified.

The completion boundary must say that no commit, push, tag, branch change, pull request creation, GitHub API mutation, token read, secret-file read, or project write occurred.
