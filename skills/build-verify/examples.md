# Examples

## Safe

- "Run the repository's existing typecheck, targeted tests, full tests, and build."
- "Reproduce the failing CI test using scripts already defined in the project."
- After inspection confirms them: `npm run lint`, `npm run typecheck`, `npm run test`, or `npm run build`.

## Unsafe

- "Install anything missing and keep trying until it passes."
- "Run the fix script and update snapshots automatically."
- "Deploy after the build succeeds."
- "Run every package script without inspecting it."

Reject unsafe operations and report the blocked verification consequence.
