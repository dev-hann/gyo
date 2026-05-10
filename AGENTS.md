# Agent Instructions

Read the appropriate documents before starting work. Each layer has an index file listing its documentation.

## General

- Read `docs/DOC_CONVENTIONS.md` before modifying any documentation.
- Code is source of truth. Documentation defines contracts only.
- Read the layer index before reading individual documents within that layer.

## Layer Indexes

| Layer | Index | Scope |
|-------|-------|-------|
| Root | `README.md` | Project overview, requirements, quick start |
| docs/ | `docs/README.md` | User-facing specifications |
| cli/ | `cli/README.md` | CLI development environment and source map |
| plugins/ | `plugins/README.md` | Plugin packages and development |

## Task Routing

### Writing or modifying tests

1. `docs/TESTING.md` — test conventions, naming, mock policy

### Working on CLI code (`cli/`)

1. `cli/README.md` — layer index and dev setup
2. `cli/src/README.md` — source structure and layer responsibilities
3. `docs/CLI.md` — command specifications (signatures, options, behavior)

### Working on plugins (`plugins/`)

1. `plugins/README.md` — layer index
2. `docs/PLUGINS.md` — plugin API specs and development conventions
3. Each plugin's `README.md` for package-specific contracts

### Working on native code (Android/iOS)

1. `docs/BRIDGE_INTEGRATION.md` — native integration specs
2. `docs/ARCHITECTURE.md` — system overview and communication flow

### Modifying documentation

1. `docs/DOC_CONVENTIONS.md` — writing rules and conventions
2. The layer index for the target area
3. The specific document to modify

### Adding a new CLI command

1. `cli/src/commands/README.md` — command class hierarchy and pattern
2. `docs/CLI.md` — existing command specifications for consistency

### Adding a new plugin

1. `docs/PLUGINS.md` — plugin conventions and API patterns
2. `plugins/README.md` — package naming and structure
3. An existing plugin's `README.md` as reference

## Development Workflow

- TDD: write test → confirm failure → implement → confirm pass → refactor
- Never commit without passing `npm run verify`
- Commit message follows Conventional Commits

## Build & Test Commands

| Command | Purpose |
|---------|---------|
| `npm run verify` | lint + typecheck + test + build (pre-push) |
| `npm run build` | Build all packages |
| `npm run build:cli` | Build CLI only |
| `npm run build:bridge` | Build bridge only |
| `npm run test` | Test all packages |
| `npm run test:cli` | Test CLI only |
| `npm run lint` | Lint CLI source |
| `npm run typecheck` | Type check CLI (run in cli/) |
