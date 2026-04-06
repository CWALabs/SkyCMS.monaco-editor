# SkyCMS Monaco Editor Integration

This folder contains the SkyCMS integration layer for Monaco Editor. It provides:

- **SkyCMS editor core**: Multi-field editor wiring, SkyCMS field adapters, active-field resolution, dirty tracking, and AMD loader configuration helpers
- **GitHub Copilot integration**: Inline completion provider plus proxy status helpers for SkyCMS-hosted Copilot-backed suggestions
- **Emmet integration**: Abbreviation support for HTML/CSS language families used in SkyCMS authoring flows
- **Playground runtime helpers**: Local SkyCMS host simulation and optional playground add-ons used to validate integration behavior before deployment

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

# Package Monaco static assets (workers, language files)
pnpm build:assets

# Build the playground
pnpm build

# Build everything needed for SkyCMS integration deployment
pnpm build:all

# Optionally also build the full upstream Monaco workspace
pnpm build:all:with-upstream
```

## Testing

```bash
# Run unit tests once
pnpm test

# Run tests in watch mode
pnpm test:watch
```

Current unit-test coverage focus:

- SkyCMS field metadata adapters
- Active field resolution compatibility
- Multi-model core behavior with mocked Monaco runtime
- AMD environment configuration helper

## Deploy Language Set

The current Monaco runtime is intentionally limited to web-page-focused languages that can realistically appear in SkyCMS page content, embeds, or templated fragments.

- HTML
- CSS
- SCSS
- LESS
- JavaScript
- TypeScript
- JSON
- XML
- Markdown
- Handlebars
- Razor
- Liquid
- Twig
- GraphQL
- YAML

## Mock SkyCMS API Playground

The playground includes a mock save workflow so integration behavior can be validated before deployment.

- Use tabs to edit `HeadJavaScript`, `Content`, and `FooterJavaScript`.
- Click `Mock SkyCMS Save API` to simulate a `SaveCode` request/response.
- The mock response log displays the payload that would be posted to SkyCMS.

## Optional Playground Add-ons

The playground now includes two low-risk optional add-ons that are common in Monaco integrations.

- Theme switching between built-in Monaco themes and a small curated theme pack.
- Optional Vim keybindings via `monaco-vim`, enabled only when toggled in the playground UI.

These are currently playground-level validation features only. They are not yet wired into the live SkyCMS host.

## Deployment

```bash
# Deploy the built library to Sky.Editor
pnpm build:all
pnpm deploy:skycms
```

## Upstream Synchronization

Manage updates from the official monaco-editor repository using the SkyCMS vendor-branch flow:

```bash
# Check sync status
pnpm sync:status

# Refresh vendor/monaco-editor from upstream/main
pnpm sync:upstream

# Create or refresh a local review branch from vendor/monaco-editor
pnpm sync:prepare

# Full local workflow (refresh vendor branch, then refresh review branch)
pnpm sync:full
```

Normal promotion into `skycms/main` should happen through a pull request from `vendor/monaco-editor` into `skycms/main`.

`pnpm sync:merge` remains available as a local-only escape hatch when a manual merge is explicitly required.

## Structure

```text
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

## Implementation Checklist

This checklist tracks the extraction and modernization work for the SkyCMS Monaco integration.

- [x] Capture current SkyCMS code editor contract
- [x] Research Monaco multi-model and tab patterns
- [x] Define initial host API contract (draft v0)
- [x] Implement multi-model tab manager in `src/`
- [x] Map SkyCMS article fields (`HeadJavaScript`, `Content`, `FooterJavaScript`) to model URIs
- [x] Preserve per-tab undo/redo and view state on tab switches
- [x] Add dirty-state events and save hooks compatible with SkyCMS (mock API pathway)
- [x] Add worker-loading strategy for packaged deployment
- [x] Build playground with host-rendered tabs + single Monaco instance
- [ ] Validate against current SkyCMS article workflow
- [ ] Prepare rollout and deployment integration for SkyCMS Editor

## SkyCMS Contract To Preserve

SkyCMS tabs are a host concern, not a Monaco concern. Monaco should edit one active model at a time while SkyCMS owns tab UI and save semantics.

- `HeadJavaScript` field -> "Head Block" tab
- `Content` field -> "Html Content" tab
- `FooterJavaScript` field -> "Footer Block" tab
- `EditingField` remains the source of truth for the currently active field

Save payload compatibility target:

- `Payload` (canonical body content)
- `HeadJavaScript`
- `FooterJavaScript`
- `EditingField`

## Host API Draft (v0)

This is the initial API shape for `@skycms/monaco-editor-integration`.

```ts
export type SkyCmsEditorField = {
  id: string;           // e.g. "HeadJavaScript"
  name: string;         // e.g. "Head Block"
  language: string;     // e.g. "html"
  value: string;
  uri?: string;         // optional explicit URI
  readOnly?: boolean;
};

export type SkyCmsEditorOptions = {
  container: HTMLElement;
  fields: SkyCmsEditorField[];
  activeFieldId: string;
  theme?: string;
  readOnly?: boolean;
  automaticLayout?: boolean;
};

export type SkyCmsEditorInstance = {
  switchField(fieldId: string): void;
  getActiveFieldId(): string;
  getValue(fieldId?: string): string;
  setValue(fieldId: string, value: string): void;
  getAllValues(): Record<string, string>;
  markClean(fieldId?: string): void;
  isDirty(fieldId?: string): boolean;
  onDidChangeActiveField(listener: (fieldId: string) => void): () => void;
  onDidChangeDirty(listener: (fieldId: string, dirty: boolean) => void): () => void;
  focus(): void;
  dispose(): void;
};

export function createSkyCmsEditor(options: SkyCmsEditorOptions): SkyCmsEditorInstance;
```

Design notes:

- Keep one Monaco editor instance and switch models with `editor.setModel(...)`.
- Create one model per field with stable URIs (for per-field undo/redo and view state).
- Do not dispose models on normal tab switches.
- Dispose models only when closing the editor instance.
