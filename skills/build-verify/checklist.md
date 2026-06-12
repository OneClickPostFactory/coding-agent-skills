# Build Verification Checklist

- [ ] Record repository, intent, changed scope, adapter, and time budget.
- [ ] Inspect manifests and CI to discover existing validation commands.
- [ ] Reject scripts with installs, fixes, deploys, migrations, watch mode, or unknown mutation.
- [ ] Run the narrowest relevant tests first.
- [ ] Run required lint, typecheck, test, and build checks.
- [ ] Record command, duration, exit status, and concise failure evidence.
- [ ] Separate pre-existing, new, and unclassified failures.
- [ ] Record skipped checks and consequences.
- [ ] Declare all observed state changes.
- [ ] Emit an evidence pack without unsupported success claims.
