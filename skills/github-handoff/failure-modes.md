# GitHub Handoff Failure Modes

- Project root is not a Git repository.
- Adapter exists but does not enable `github-handoff`.
- Adapter validation fails.
- Git status is unavailable.
- Secret-bearing changed paths are present and must be redacted.
- Remote PR, CI, and review state cannot be verified without separately approved GitHub access.
