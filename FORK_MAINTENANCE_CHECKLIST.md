# Monaco Fork Maintenance Checklist

Use this checklist when maintaining the SkyCMS Monaco fork.

## GitHub Configuration

- Set `skycms/main` as the default branch.
- Protect `skycms/main` with the required review and CI rules your team expects.
- Leave `vendor/monaco-editor` unprotected unless GitHub Actions has an allowed bypass path for automated mirror updates.

## Branch Roles

- `vendor/monaco-editor` tracks `microsoft/monaco-editor` but intentionally removes upstream workflow files before push.
- `skycms/main` carries SkyCMS-specific integration work and deployment behavior.
- Promotion from vendor to SkyCMS should happen by pull request, not by direct merge from automation.

## Repository Workflows

- Run `Sync Upstream Main Into Vendor Branch` on a schedule or on demand.
- Run `Open Vendor PR Into SkyCMS Main` after the vendor branch is refreshed.
- Review the promotion PR for integration breakage, asset changes, and deployment impact before merging.
- The vendor sync intentionally strips `.github/workflows/` from the upstream snapshot so it can push with the standard GitHub Actions token.

## Local Validation

Useful local commands:

```bash
node integrations/skycms/scripts/upstream-sync-workflow.mjs status
pwsh ./scripts/sync-fork.ps1 -WhatIf -SkipCleanCheck
cd integrations/skycms && pnpm test
```

## Local Remote Conventions

- In GitHub Actions, `origin` points at this fork.
- In local maintainer clones, the writable remote may be `cwalabs-split` instead of `origin`.
- The local helper scripts auto-detect `cwalabs-split` first and fall back to `origin`.

## Review Focus

- Changes under `integrations/skycms/`
- Bundled worker or asset output changes that affect deployment into `SkyCMS/Editor/wwwroot/`
- CI regressions on `skycms/main`
- Any upstream changes that alter Monaco packaging, workers, or supported APIs used by the SkyCMS wrapper
