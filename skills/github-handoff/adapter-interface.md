# GitHub Handoff Adapter Interface

Adapters may enable `github-handoff` as an audit-only skill.

Adapters may narrow:

- Required evidence labels.
- Ignored path labels.
- Documentation precedence used as human context.

Adapters must not:

- Permit commits, pushes, tags, pull request creation, release creation, or GitHub API mutation.
- Permit token reads.
- Permit secret-file reads.
- Suppress warnings or failures.
- Redefine completion.
- Escalate the skill out of audit-only mode.
