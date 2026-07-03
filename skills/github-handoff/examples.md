# GitHub Handoff Examples

## Safe Examples

```bash
coding-agent-skills github-handoff /path/to/project
```

```bash
node scripts/render-github-handoff.mjs /path/to/project
```

## Unsafe Examples

- Create a pull request.
- Push the current branch.
- Tag the release.
- Read GitHub tokens.
- Print configured remote URLs.
