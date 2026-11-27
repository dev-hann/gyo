# Changelog

## [0.2.0] - 2026-11-27

### Added

- `@gyo-framework/bridge/testing`: `createBridgeMock(name)`, `setPlatform()` and `cleanupPlatform()`, for the tests of an app. They come from `@gyo-framework/test-utils`, which is withdrawn: that package could not answer a request of the real `Bridge`
- `requestPermissions(permissions)`: asks the user for Android run-time permissions through the handler the Android shell registers in every app, and resolves with what is granted and what is not

### Fixed

- A call that native has answered no longer reports a timeout to the interceptors once its timeout elapses
- `destroy()` rejects the calls that are still pending instead of leaving them unsettled

## [0.1.3] - 2025-01-10

### Changed

- Renamed package from `@gyo/bridge` to `@gyo-framework/bridge`

## [0.1.2] - 2025-01-10

### Added

- Core Bridge class: `invoke()`, `listen()`, `destroy()`
- Android: BridgeHandler, BridgeRegistry, AndroidBridgeInterface
- iOS: BridgeHandler, BridgeRegistry, IOSBridgeInterface
- TypeScript type definitions
- Configurable timeout via `BridgeOptions`

[0.1.3]: https://github.com/gyo-framework/gyo/releases/tag/v0.1.3
[0.1.2]: https://github.com/gyo-framework/gyo/releases/tag/v0.1.2
