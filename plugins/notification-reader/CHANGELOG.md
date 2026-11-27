# @gyo-framework/notification-reader

## 0.1.4 - 2026-11-27

- Version 0.1.3 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Reads through `@gyo-framework/notification-listener`, which it brings, instead of waiting for a service the app has to write. The notifications come newest first, with their `id` and the expanded text when there is one

## 0.1.0

- Initial release
- `list()` — list all active notifications
- Android `NotificationReaderBridge` Kotlin handler (NotificationManager)
