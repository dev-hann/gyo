# @gyo-framework/screen-action

## 0.1.5 - 2026-11-27

- Version 0.1.4 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Acts through `@gyo-framework/accessibility`, which it brings, instead of waiting for a service the app has to write. Compiles: `GestureDescription` is a top-level class, `GLOBAL_ACTION_POWER_DIALOG` was not imported, and a property clashed with `setService()`

## 0.1.0

- Initial release
- `tap({ x, y })` — tap at coordinates via dispatchGesture
- `type({ text })` — type text into focused node via ACTION_SET_TEXT
- `swipe({ startX, startY, endX, endY, duration })` — swipe gesture via dispatchGesture
- `globalAction({ action })` — perform global action (back, home, recents, notifications, quick_settings, power_dialog)
- Android `ScreenActionBridge` Kotlin handler (AccessibilityService)
