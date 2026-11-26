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

### Fixed

- `gyo create` writes a valid Android package name for hyphenated names and names starting with a digit
- `gyo run` fails before spawning the dev server when its port is already in use
- `gyo run` no longer writes the detected LAN address into `gyo.config.json`; `gyo build` resolves a `localhost` development profile to the LAN address itself
- New projects ignore `android/app/src/main/assets/gyo-config.json`, which `gyo run` and `gyo build` generate
- `gyo run` kills the dev server's whole process group and the log process on every exit path, including crashes
