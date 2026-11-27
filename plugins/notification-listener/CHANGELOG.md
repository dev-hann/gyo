# @gyo-framework/notification-listener

## 0.1.3 - 2026-11-27

- Version undefined on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand


## 0.1.3 - 2026-11-27

### Changed

- `openSettings()` opens the notification access settings before access is granted, which is when it is needed
- `getNotifications()` accepts any limit: values below 1 and above 200 are brought into that range
- The service is `GyoNotificationListenerService`
- Brought back into the repository: 0.1.2 was published from work that was never committed

## 0.1.2

- Initial release
