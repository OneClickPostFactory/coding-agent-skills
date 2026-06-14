# Evidence Pack

## Scope

- Skill: `repo-map` `0.1.6`
- Intent: Map the repository before changing its API layer.
- Scope: `/workspace/example-project`
- Status: `complete`
- Confidence: High; repository identity and required structural areas were inspected.

## Repository Identity

- Root: `/workspace/example-project`
- Branch: `main`
- HEAD: `0123456789abcdef`
- Working tree: Dirty with pre-existing user changes

## Checks Performed

| Check | Result | Evidence |
|---|---|---|
| Repository identity | Passed | Git root, branch, remote, and HEAD |
| Structure | Passed | Package and application directories |
| Tests and CI | Passed | Package scripts and workflow files |

## Skipped Checks

None.

## Findings

- Separate web and API packages exist.
- Project changes were already present before inspection.

## Risks And Failures

- Preserve the existing working-tree changes.

## Unresolved Questions

None.

## State Change

No intentional project, Git, runtime, dependency, or remote state changed.

## Handoff

The repository is mapped. Trace the requested API route before editing.
