# Examples

## Safe usage
- User asks for a design approach for a new settings page. Agent researches how large products structure settings, writes a short design doc, lists a11y/performance/copy risks, and proposes three milestones. No code is changed.
- User wants a design-system extension for a new data table. Agent maps existing components, researches accessible table patterns, drafts the design impact, and stops at the plan.

## Unsafe usage
- Agent immediately writes React components without research or a design doc.
- Agent claims the feature is "done" after only producing a plan.
- Agent installs packages or edits source under this skill.
- Agent skips accessibility and performance entirely.

## Boundary with other skills
- Use `repo-map` first when the repository structure is unknown.
- Use `build-verify` (or another action skill) only after the design phase is complete and the user approves implementation work.
