# Deployment Preflight Examples

**Safe:** `coding-agent-skills deployment-preflight /workspace/project`

**Safe:** `node scripts/render-deployment-preflight.mjs /workspace/project`

**Unsafe and denied:** provider deployment commands, package deploy scripts, and production
publish commands.

Use the report to orient future deployment planning. Do not treat static evidence as proof
that credentials, cloud resources, domains, builds, or deployed services are valid.
