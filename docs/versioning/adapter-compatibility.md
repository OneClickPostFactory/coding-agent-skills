# Adapter Compatibility Across Upgrades

Adapter upgrades compare four independent version surfaces:

1. The before and after project core `expectedVersion`.
2. The exact core pin or bounded compatible range.
3. The declared adapter schema version and installed adapter version.
4. Each adapter's compatible pilot skill versions.

## Supported Transition

The `v0.1.5` harness recognizes `0.1.4` as its supported source and `0.1.5` as its target.
The source revision is validated against the version it declares. The target revision is
then required to match the running core.

This separation allows a valid older revision to be inspected without pretending its pin is
current. A source older than the immediately preceding patch is an unsupported old core. A
target newer than the running core is an unsupported future core.

## Drift Rules

- **Pin drift:** the target exact pin or range excludes the running core.
- **Schema drift:** the project declares an adapter schema unsupported by the shared core.
- **Adapter version drift:** the declared and discovered adapter versions disagree or
  downgrade.
- **Skill compatibility drift:** approved skill IDs, modes, or compatible versions no longer
  agree.
- **Policy drift:** the target removes restrictions, evidence, failure reporting, completion
  integrity, secret protection, or approval boundaries.

Project adapters may narrow reads and add required evidence. They must preserve all shared
restrictions and all evidence already required by the before revision.

## Upgrade Evidence

A review should retain:

- Both immutable project revision roots or equivalent commit identities.
- The core target version.
- The upgrade command and exit status.
- Accepted adapter and skill counts.
- Every rejection code or skipped comparison.
- Confirmation that no project state changed.

Upgrade evidence is advisory. It does not authorize edits, publication, deployment, or
adoption in a real project.
