# External Adapter Discovery

External adapters are extension-only JSON data stored outside this shared skill repository.
The discovery harness accepts a confirmed project or fixture root and inspects only these
relative locations:

```text
.coding-agent/adapters/
coding-agent/adapters/
adapters/coding-agent/
```

Each immediate child directory represents one adapter and must contain the exact manifest
filename `adapter.json`. Discovery does not recursively scan the rest of the project.

## Discovery Rules

1. Resolve the supplied root without accepting `..` path traversal.
2. Inspect only the three declared adapter locations.
3. Reject adapter containers, directories, or manifests that are symlinks.
4. Accept only regular `adapter.json` files no larger than the harness limit.
5. Parse JSON without returning source snippets in errors.
6. Reject secret-like content before semantic validation.
7. Validate against adapter schema version `1.0.0`.
8. Confirm skill ID, skill version, declared mode, command policy, and manifest compatibility.
9. Apply shared restrictions before every adapter extension.
10. Return a nonzero exit code when any discovered adapter or container is invalid.

An empty root is valid and reports that zero adapters were discovered. A missing root,
malformed manifest, unexpected container entry, or mixed valid and invalid root fails.

## Inheritance

Adapters may add bounded read paths, documentation precedence, safe aliases, status-only
runtime hints, package-manager hints, approvals, and evidence requirements. They remain
extension-only: shared denied operations, skill modes, evidence requirements, failure
reporting, completion semantics, secret handling, and scope approval rules always win.

Symlink escapes and path traversal are rejected even when their target would otherwise
contain a structurally valid adapter.

Project repositories may later reference a versioned checkout or installed copy of this
shared core. That integration must run the core validator against the project root; it must
not copy or redefine shared restrictions locally.

The [project installation contract](project-installation.md) defines the declaration and
version pin required before a project-owned adapter can be considered installed.

No real project adapters are added in v0.2.1. The committed roots are disposable synthetic
fixtures only.
