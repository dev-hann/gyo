# @gyo-framework/screen-reader

## 0.1.5 - 2026-11-27

- Version 0.1.4 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Reads through `@gyo-framework/accessibility`, which it brings, instead of waiting for a service the app has to write. Compiles: the handler took no `Context`, which every handler receives

## 0.1.0

- Initial release
- `read()` — read full accessibility node tree from active window
- `find({ text })` — find nodes containing text
- Android `ScreenReaderBridge` Kotlin handler (AccessibilityService)
