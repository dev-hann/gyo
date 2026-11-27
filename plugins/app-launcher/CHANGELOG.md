# @gyo-framework/app-launcher

## 0.1.2 - 2026-11-27

- Version 0.1.1 on npm was published from work that was never committed to the repository; this version brings that work back and adds what else is listed here
- `android/` is a Gradle library module: `gyo run`, `gyo build android` and `gyo install` include it in the app and register the handler, so `MainActivity.kt` is not edited by hand
- Lists the apps with a launcher icon through the launcher intent, which is how Android 11 and later see them; the module declares the `<queries>` for it. `openApp()` returns `false` instead of throwing when the app cannot be opened

## 0.1.0

- Initial release
- `listApps()` — list all launchable apps
- `openApp({ packageName })` — open app by package name
- `openUrl({ url })` — open URL in default browser
- `searchApps({ query })` — search apps by name or package name
- Android `AppLauncherBridge` Kotlin handler (PackageManager)
