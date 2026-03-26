# SkyCMS Monaco Editor Integration

This folder contains the SkyCMS integration layer for Monaco Editor. It provides:

- **Playground**: Development environment for testing the editor
- **Integration layer**: Custom wrapping and utilities for SkyCMS
- **Build tooling**: Vite-based build pipeline for development and production
- **Deploy scripts**: Automation for deploying builds to Sky.Editor

## Setup

```bash
cd integrations/skycms
pnpm install
```

## Development

```bash
# Start the Vite dev server
pnpm dev
```

## Building

```bash
# Build the library
pnpm build:lib

# Build the playground
pnpm build

# Build everything (monaco + library + playground)
pnpm build:all
```

## Deployment

```bash
# Deploy the built library to Sky.Editor
pnpm deploy:skycms
```

## Upstream Synchronization

Manage updates from the official monaco-editor repository:

```bash
# Check sync status
pnpm sync:status

# Sync upstream changes
pnpm sync:upstream

# Full sync workflow (prepare, merge, etc.)
pnpm sync:full
```

## Structure

```
integrations/skycms/
├── src/                  # Integration source code
├── playground/           # Development playground
├── scripts/              # Build and deployment scripts
├── dist/                 # Built library (generated)
├── playground-dist/      # Built playground (generated)
├── vite.config.mjs       # Playground Vite config
├── vite.lib.config.mjs   # Library Vite config
└── package.json          # Scripts and dependencies
```
