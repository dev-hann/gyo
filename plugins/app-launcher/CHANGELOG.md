# @gyo-community/app-launcher

## 0.2.0 - 2026-11-28

- `ApkInstaller`: `canInstall()`, `openInstallSettings()` and `install({ path })` install an APK with the system's installer, for an app that is not in a store. The file is copied into `apk_install/` in the cache and handed over through a `FileProvider` of the module's own class, `ApkFileProvider`: the manifest merger tells providers apart by class, and `@gyo-community/media` brings one named `FileProvider`
- Declares the permission `REQUEST_INSTALL_PACKAGES`, which the app writes into its manifest; `gyo install` warns while it is missing

## 0.1.2 - 2026-11-27

- Moved from `@gyo-framework/app-launcher`: the framework keeps its core under `@gyo-framework`, and every add-on feature lives under `@gyo-community`
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
