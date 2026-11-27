# Changelog

## [Unreleased]

### Added

- `gyo upgrade` command: `--check`, `--version` flags
- `gyo debug <platform>` command: Chrome DevTools (Android), Safari Web Inspector (iOS)
- Bridge configurable timeout via `new Bridge(name, { timeout })`
- BridgeRegistry for Android and iOS
- Android: full-screen video; `element.requestFullscreen()` was rejected with "Fullscreen is not supported"
- Android: `version`, `platforms.android.versionCode`, `displayName` and `platforms.android.icon` in gyo.config.json set the app's version, launcher name and icon; `gyo run` and `gyo build` sync them before every build
- Android: release signing through `android/keystore.properties`, which `gyo build android --release` writes from the `GYO_ANDROID_KEYSTORE_*` variables
- `@gyo-framework/http` plugin: GET requests that run outside the WebView with the caller's headers. Redirects are followed, the raw body comes back as base64, and requests that name the same `jar` share cookies that survive app restarts
- End-to-end suites for the built bundle (`test:e2e:local`) and for an Android build with every official plugin (`test:e2e:android`)
- `requestPermissions()` in `@gyo-framework/bridge`: asks the user for Android run-time permissions through a handler the Android shell registers in every app. Android handlers can answer a call later through `handleAsync`
- Android: a WebView too old to restrict the bridge per frame is told apart in the log, and the fallback checks the main frame's host

### Changed

- Plugin naming unified to `@gyo-framework/*` scope
- Clean architecture: core, services, utils, commands layers
- Removed hot reload (WebSocket-based)
- Removed unused dependencies (chokidar, ws)
- A plugin's `android/` directory is a Gradle library module, included in the app build from where node_modules keeps the package. gyo no longer copies plugin sources into the app or edits `MainActivity.kt`; the manifest merger brings what a module declares and the module brings its own dependencies. The native bridge is the `gyo-bridge` module of the generated project
- Run-time permissions are declared by the app in `android/app/src/main/AndroidManifest.xml`. A plugin lists the ones it needs under `gyo.android.permissions`, and `gyo install` warns about the ones missing
- `gyo run`, `gyo build` and `gyo install` fail when a plugin cannot be included, instead of leaving a broken build for Gradle to find
- `gyo build ios --release` fails; it used to produce the same development build as without the flag
- `gyo config set` gives the value the type of the one it replaces, so `version 2` stays a string; only a new key is read as a boolean or a number
- Each command error is reported once
- Android: the native bridge is registered as a WebView message listener for the origin of `serverUrl`, so Android never injects it into another origin, third-party iframes included. Navigation to another origin opens outside the WebView
- iOS: `IOSBridgeInterface` no longer implements the script message handler; that path had no origin check. `WebViewController` is the handler, as the template always used it
- GitHub Actions runs lint, typecheck, unit tests, the build, the bundle tests and an Android build with every official plugin. Build artifacts, nested lockfiles and the auto-improve skill are no longer tracked

### Fixed

- `gyo create` writes a valid Android package name for hyphenated names and names starting with a digit
- `gyo run` fails before spawning the dev server when its port is already in use
- `gyo run` no longer writes the detected LAN address into `gyo.config.json`; `gyo build` resolves a `localhost` development profile to the LAN address itself
- New projects ignore `android/app/src/main/assets/gyo-config.json`, which `gyo run` and `gyo build` generate
- `gyo run` leaves nothing behind: `Ctrl+C`, `SIGTERM`, a crash and the exit of the launcher all stop the dev server's process group and the log process. Earlier the CLI survived the death of the shell or task runner that launched it and kept both running
- Android: bridge callbacks and events embed ids and messages as JSON strings, like iOS; an error message with a quote, a backslash or a newline no longer leaves the web promise pending
- Android: debug builds permit cleartext traffic, so a real device can load the dev server that `gyo run` starts on the LAN; release builds stay strict
- Android: the `webview` settings in `gyo.config.json` (`userAgent`, `allowFileAccess`, `allowUniversalAccessFromFileURLs`) are now applied; they were written but never read. `gyo create` no longer writes a default `userAgent`, and the `gyo-webview/1.0` default from earlier versions is ignored
- `gyo install` and the sync before `gyo build android` never copied a plugin's sources: they looked under `android/src/main/kotlin/<package>` without the `gyo/plugins` prefix, and never registered the handlers from `MainActivity.kt`. A generated project now builds with all ten official plugins
- `gyo upgrade` crashed with "fs.readJson is not a function", and read the repository's package.json instead of the CLI's
- Bridge: a call that native had answered still reported a timeout to the interceptors thirty seconds later, and `destroy()` left pending calls unsettled for good
- `gyo run` left the dev server running when its terminal closed (SIGHUP), and when the server never opened its port
- `gyo config set name 123` stored a number and left a config that no command, itself included, could read
- `gyo clean ios` left `.build`, where SwiftPM keeps the build, and could report success after a failed removal
- Plugins that had never been compiled: `screen-action` and `screen-find` were missing imports, `screen-action` had a JVM signature clash and the three screen plugins did not take the `Context` every handler receives. `app-launcher` now declares the `<queries>` that make other apps visible on Android 11 and later
