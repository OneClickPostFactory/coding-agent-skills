# Route Trace Evidence Template

Use the shared evidence-pack contract and include:

- Skill: `route-trace`
- Repository root, branch, HEAD, and working-tree state
- User intent and declared route scope
- Project adapter ID or `null`
- Static scan scope and ignored paths
- Verified route files with file paths and route patterns
- Inferred route declarations with evidence file paths
- Skipped paths with reasons and consequences
- Not-verified runtime-dependent route classes
- Safety refusals
- Changed state: `false`
- Recommended next action

Completion requires evidence for both findings and boundaries. A static route trace is not runtime truth.
