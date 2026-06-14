# Adapter Upgrade Checks

Project-owned adapter upgrades are compared as two complete, disposable project revisions:

```bash
node scripts/check-adapter-upgrade.mjs <before-project-root> <after-project-root>
```

The command is advisory and read-only. It validates each revision with the existing project
adapter validator, compares the declarations and accepted manifests, and reports stable
rejection codes. It does not update pins, copy adapters, install packages, or approve an
upgrade.

## Revision Convention

Both roots must use the project installation convention in
[project-installation.md](project-installation.md). The before revision declares its current
core compatibility. The after revision declares the proposed target compatibility.

For the `0.1.5` harness, `0.1.4` is the supported upgrade source and `0.1.5` is the target.
Older sources and future targets fail closed.

## Stale Pins

- A **stale exact pin** still fixes the after revision to an older core.
- A **stale compatible range** does not include the running core, or leaves the expected
  version behind while using a range.

The after declaration must set `expectedVersion` to the running core and its `versionPin`
must contain that version. Exact pins and bounded ranges remain distinct in evidence.

## Safe Upgrade Rules

A safe upgrade must:

- Preserve project and adapter identity.
- Use the supported adapter schema.
- Preserve every inherited denied operation.
- Preserve audit-only modes, failure reporting, completion rules, and secret protections.
- Retain all previously required evidence; adding evidence is allowed.
- Declare only approved pilot skills and compatible skill versions.
- Keep all declaration and manifest paths inside their project revision.

Schema drift, skill compatibility drift, adapter downgrade, restriction weakening, mode
escalation, evidence removal, failure suppression, completion override, secret exposure,
scope expansion, traversal, and symlink escape reject the upgrade.

## Evidence And Exit Codes

Exit `0` means both revisions validated and the comparison preserved the shared boundary.
Exit `1` means the upgrade was rejected. Exit `2` means one or both root arguments are
missing. Summaries contain counts and rejection codes only; manifest values are not echoed.

A passing result is evidence that the disposable comparison passed. Applying the same
upgrade to a real project still requires explicit approval and fresh project evidence.

All committed revisions in this milestone are synthetic fixtures. No real project adapter
or project repository is read or modified.
