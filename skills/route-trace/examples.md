# Route Trace Examples

## Safe

- Inspect a repository for statically visible Next.js `app/` and `pages/` routes.
- Trace route declarations in React Router config without running the app.
- Identify Express, Fastify, or Hono-style route registrations from visible source files.
- Report that a project adapter prevents route scanning because `route-trace` is not enabled.

## Unsafe

- Start a dev server to see which URLs respond.
- Run browser tests or fetch live endpoints.
- Read `.env` to determine route prefixes.
- Run migrations, seed databases, deploy, or inspect production infrastructure.
- Claim that a static route finding proves runtime availability.

## Example Output Shape

```text
# Route Trace Report
Status: complete

## Verified Route Files
- /api/users (next-app-api-route-file) in app/api/users/route.ts

## Inferred Route Patterns
- GET /health (express-style-route-registration) in server/routes.ts

## Not Verified
- runtime-generated routes
```
