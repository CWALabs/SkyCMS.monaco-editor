# SkyCMS Monaco Editor Fork

This repository is the SkyCMS-maintained fork of Monaco Editor.

Its purpose is to keep the Monaco upstream codebase available in a controlled vendor branch while the SkyCMS-specific integration, packaging, and deployment work lives on `skycms/main`.

## Branch Model

- `vendor/monaco-editor`: upstream-tracking branch refreshed from `microsoft/monaco-editor`, with upstream workflow files excluded
- `skycms/main`: SkyCMS product branch and the expected default branch for this fork

Upstream updates should land in `vendor/monaco-editor` first and then move into `skycms/main` through a reviewed pull request.

## SkyCMS Integration

The active SkyCMS integration lives in `integrations/skycms/`.

- SkyCMS editor core for multi-field editing, field-to-model mapping, active-field resolution, dirty tracking, and Monaco AMD runtime setup
- GitHub Copilot inline-completion integration via the SkyCMS proxy helpers in `integrations/skycms/src/copilot.ts`
- Emmet support for HTML, Razor, Handlebars, CSS, SCSS, and LESS authoring flows
- Local playground and runtime helpers for validating SkyCMS host behavior before deployment
- Deploy and packaging scripts for shipping the SkyCMS Monaco bundle and curated Monaco assets back into SkyCMS

- Integration package and playground: `integrations/skycms/`
- Local sync helper: `integrations/skycms/scripts/upstream-sync-workflow.mjs`
- Local audit wrapper: `integrations/skycms/scripts/upstream-sync-workflow.ps1`
- Repository-level vendor mirror script: `scripts/sync-fork.ps1`

Start with the integration guide for build, test, deploy, and local sync commands.

## Maintainer Workflow

Use the repository workflows for normal fork maintenance:

- `Sync Upstream Main Into Vendor Branch`: mirrors upstream into `vendor/monaco-editor`
- `Open Vendor PR Into SkyCMS Main`: opens or reuses the promotion pull request into `skycms/main`
- `CI`: validates pushes to `skycms/main` and pull requests

For setup details, see `FORK_MAINTENANCE_CHECKLIST.md`.

## Local Development

Install root dependencies:

```bash
npm install
```

Install integration dependencies:

```bash
cd integrations/skycms
pnpm install
```

Useful integration commands:

```bash
pnpm build:all
pnpm test
pnpm sync:status
pnpm deploy:skycms
```

## Upstream Reference

This fork still carries the upstream Monaco source tree, samples, and documentation.

- Upstream project: [microsoft/monaco-editor](https://github.com/microsoft/monaco-editor)
- Samples: `samples/`
- Monaco integration docs: `docs/`
- Website sources: `website/`
- API surface: `monaco.d.ts`

For SkyCMS maintenance, prefer the branch model and workflows documented in this fork over the generic upstream publishing guidance.

## License

Licensed under the MIT license. See `LICENSE.txt`.
