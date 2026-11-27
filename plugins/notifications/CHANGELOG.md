# @gyo-community/notifications

## 0.2.0 - 2026-11-27

- Replaces `@gyo-framework/notification-listener` and `@gyo-framework/notification-reader` with this one package. `NotificationListener` and `NotificationReader` keep their methods; the import path is `@gyo-community/notifications`
- Both classes post to one bridge, `notifications`, answered by one Android handler, `NotificationsBridge`. The method names stay as they were: `is_enabled`, `get_notifications` and `open_settings` for `NotificationListener`, `list` for `NotificationReader`
- The Android module is one: it declares `GyoNotificationListenerService` and the handler and depends on no module of another plugin. An app that had both plugins lists this one in `package.json` instead
- `NotificationReader` gets one `NotificationInfo` type, with the `id` the native side always returned
- `openSettings()` is typed with the `error` the native side returns when it could not open the settings

## @gyo-framework/notification-listener

The history of the package this one replaces, up to 0.1.3.

### 0.1.3 - 2026-11-27

- Version undefined on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand

### 0.1.3 - 2026-11-27

#### Changed

- `openSettings()` opens the notification access settings before access is granted, which is when it is needed
- `getNotifications()` accepts any limit: values below 1 and above 200 are brought into that range
- The service is `GyoNotificationListenerService`
- Brought back into the repository: 0.1.2 was published from work that was never committed

### 0.1.2

- Initial release

## @gyo-framework/notification-reader

The history of the package this one replaces, up to 0.1.4.

### 0.1.4 - 2026-11-27

- Version 0.1.3 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Reads through `@gyo-framework/notification-listener`, which it brings, instead of waiting for a service the app has to write. The notifications come newest first, with their `id` and the expanded text when there is one

### 0.1.0

- Initial release
- `list()` — list all active notifications
- Android `NotificationReaderBridge` Kotlin handler (NotificationManager)
