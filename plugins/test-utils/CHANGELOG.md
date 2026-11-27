# @gyo-framework/test-utils

## 0.2.0 - 2026-11-27

### Changed

- `createBridgeMock(name)` works with the real `Bridge`: it replaces the native side and offers `requests()`, `resolve()`, `reject()`, `emitEvent()` and `restore()`. The mock of 0.1.0 could not answer a request, and its `window.gyoBridge` kept the `Bridge` from installing the one that settles promises

## 0.1.0

- Initial release
