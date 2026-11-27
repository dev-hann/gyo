# @gyo-framework/device-info

## 0.1.2 - 2026-11-27

- Version 0.1.1 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand


## 0.1.0

- Initial release
- `getInfo()` — get device manufacturer, model, brand, Android version, SDK version, security patch, screen metrics, and battery status
- Android `DeviceInfoBridge` Kotlin handler (Build, DisplayMetrics, BatteryManager)
