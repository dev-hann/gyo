# @gyo-framework/accessibility

## 0.1.3 - 2026-11-27

- Version undefined on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand


## 0.1.3 - 2026-11-27

### Changed

- `openSettings()` opens the Accessibility settings before the service is enabled, which is when it is needed
- The service is `GyoAccessibilityService`
- Brought back into the repository: 0.1.2 was published from work that was never committed

## 0.1.2

- Initial release
