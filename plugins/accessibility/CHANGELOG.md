# @gyo-community/accessibility

## 0.2.0 - 2026-11-27

- Merges four packages into this one and replaces them: `@gyo-framework/accessibility`, `@gyo-framework/screen-reader`, `@gyo-framework/screen-action` and `@gyo-framework/screen-find`
- `Accessibility`, `ScreenReader`, `ScreenAction` and `ScreenFind` keep their methods and are imported from `@gyo-community/accessibility` from now on
- One bridge and one handler: every class posts to `accessibility`, answered by `gyo.plugins.accessibility.AccessibilityBridge`. Before, the three screen plugins posted to `screen_reader`, `screen_action` and `screen_find`, each with a handler of its own. The method names and the JSON they take and return are unchanged
- The Android module is one: it no longer depends on the module of another plugin
- Two different types were both exported as `FindResult`: that of `screen-reader` is `ScreenReaderFindResult` here, that of `screen-find` is `ScreenFindResult`
- `repository.directory` names this package's directory
- Nothing else changed in what the classes do, the Android module included

## History of the packages it replaces

### @gyo-framework/accessibility

#### 0.1.3 - 2026-11-27

- Version undefined on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand

#### 0.1.3 - 2026-11-27

##### Changed

- `openSettings()` opens the Accessibility settings before the service is enabled, which is when it is needed
- The service is `GyoAccessibilityService`
- Brought back into the repository: 0.1.2 was published from work that was never committed

#### 0.1.2

- Initial release

### @gyo-framework/screen-reader

#### 0.1.5 - 2026-11-27

- Version 0.1.4 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Reads through `@gyo-framework/accessibility`, which it brings, instead of waiting for a service the app has to write. Compiles: the handler took no `Context`, which every handler receives

#### 0.1.0

- Initial release
- `read()` — read full accessibility node tree from active window
- `find({ text })` — find nodes containing text
- Android `ScreenReaderBridge` Kotlin handler (AccessibilityService)

### @gyo-framework/screen-action

#### 0.1.5 - 2026-11-27

- Version 0.1.4 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Acts through `@gyo-framework/accessibility`, which it brings, instead of waiting for a service the app has to write. Compiles: `GestureDescription` is a top-level class, `GLOBAL_ACTION_POWER_DIALOG` was not imported, and a property clashed with `setService()`

#### 0.1.0

- Initial release
- `tap({ x, y })` — tap at coordinates via dispatchGesture
- `type({ text })` — type text into focused node via ACTION_SET_TEXT
- `swipe({ startX, startY, endX, endY, duration })` — swipe gesture via dispatchGesture
- `globalAction({ action })` — perform global action (back, home, recents, notifications, quick_settings, power_dialog)
- Android `ScreenActionBridge` Kotlin handler (AccessibilityService)

### @gyo-framework/screen-find

#### 0.1.5 - 2026-11-27

- Version 0.1.4 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Finds elements through `@gyo-framework/accessibility`, which it brings, instead of waiting for a service the app has to write. Compiles: `AccessibilityService` was not imported

#### 0.1.0

- Initial release
- `findByText({ text, exact })` — find UI elements by text content
- `findById({ id })` — find UI elements by view ID
- Android `ScreenFindBridge` Kotlin handler (AccessibilityService)
