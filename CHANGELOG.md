# Changelog

## [Unreleased]

### Added

- `gyo upgrade` command: `--check`, `--version` flags
- `gyo debug <platform>` command: Chrome DevTools (Android), Safari Web Inspector (iOS)
- Bridge configurable timeout via `new Bridge(name, { timeout })`
- BridgeRegistry for Android and iOS

### Changed

- Plugin naming unified to `@gyo-framework/*` scope
- Clean architecture: core, services, utils, commands layers
- Removed hot reload (WebSocket-based)
- Removed unused dependencies (chokidar, ws)
