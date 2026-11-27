# CLI Reference

Command specifications for `@gyo-framework/cli`.

## Installation

```bash
npm install -g @gyo-framework/cli
```

## Commands

### `gyo create <project-name>`

Create a new Gyo project: native shells (android/ios), `gyo.config.json`, README. Framework-agnostic — the web application in `lib/` is built by the user.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-f, --force` | boolean | false | Overwrite existing directory |

### `gyo run`

Run on a connected device. With the `development` profile (default): spawns the dev server via `script.start` in `lib/`, waits for the port (TCP probe), bakes the detected LAN URL into the native config asset, then builds/installs/launches the native shell. Other profiles: use the configured `serverUrl` directly. `gyo.config.json` is not modified.

Fails before spawning the dev server when its port is already in use, and after starting it when it answers on localhost but not at the address the device will use: it names the fix in both cases.

The address baked into the app is the host of `profiles.<profile>.serverUrl`. A loopback host (`localhost`, `127.0.0.1`) means this machine, whose LAN address is found at run time; any other host is used as it is.

A release build warns when its `serverUrl` is plain `http`: release builds deny cleartext traffic.

Stops, including the dev server and the log process, on `Ctrl+C`, on `SIGTERM`, when its terminal closes, and when the process that launched it goes away. A failed platform part stops the dev server before `gyo run` reports the error.

The dev server's own output is not shown, only what it prints on stderr that names an error.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-d, --device <device>` | string | auto | Specific device ID |
| `-p, --profile <profile>` | string | development | Build profile |
| `--port <number>` | number | from config | Dev server port override |
| `-v, --verbose` | boolean | false | Detailed logs |

### `gyo build <platform>`

Build the app for `android` or `ios`. Bakes `profiles.<profile>.serverUrl` into native assets; a `localhost` address in the `development` profile is baked as the machine's LAN address. If the profile has no `serverUrl`, prompts for the deploy URL (interactive) and saves it; fails with a clear error in non-interactive environments.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-r, --release` | boolean | false | Release build. Android only: `gyo build ios --release` fails before anything is built |
| `-p, --profile <profile>` | string | development | Build profile |
| `-v, --verbose` | boolean | false | Detailed logs |

### `gyo clean [platform]`

Remove build artifacts. Platform: `android`, `ios`, `lib`, or `all`.

### `gyo config`

Manage `gyo.config.json`. Subcommands: `show`, `get <key>`, `set <key> <value>`.

Supports dot-notation keys. The value takes the type of the one it replaces; a new key is read as a number, or as a boolean when it is `true`, `false`, `yes`, `no`, `on` or `off`. Nothing is written unless the result is a valid config.

### `gyo install`

Include the Android module of every plugin installed in `lib/` in the Android project, and register the handlers. `gyo run` and `gyo build` do the same before they build. Fails when a plugin cannot be included, so that nothing is left for Gradle to discover.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-p, --platform <platform>` | string | android | Sync this platform only |

Warns about run-time permissions an installed plugin declares that `android/app/src/main/AndroidManifest.xml` does not.

> See [Plugin modules](#plugin-modules) for what a sync writes.

### `gyo devices`

List connected devices.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--json` | boolean | false | JSON output |

### `gyo doctor`

Check and diagnose development environment. Requires the Node release the CLI names in `engines.node`, JDK 17 and the Android platform the template's `compileSdk` names. An SDK found in its usual place is used for the later checks when `ANDROID_HOME` is not set.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-v` | boolean | false | Verbose: show paths |
| `--fix` | boolean | false | Install with apt (Linux) or Homebrew (macOS) what they can get for a failed check: the JDK, Git, libimobiledevice. Prints how to get the rest |

### `gyo debug <platform>`

Open debugging tools. Platform: `android` or `ios`.

### `gyo upgrade`

Upgrade CLI.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--check` | boolean | false | Check only, no upgrade |
| `--version <ver>` | string | latest | Target version; installed whatever it is |

What npm calls latest is installed only when it is newer than the installed version.

## Configuration

### `gyo.config.json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Project name |
| `version` | string | yes | Project version; the Android `versionName` |
| `displayName` | string | no | Launcher label; non-empty; defaults to `name` |
| `profiles` | object | no | Profile → `{ serverUrl: string }` mapping |
| `platforms.android` | object | no | `{ enabled: boolean, packageName?: string, versionCode?: number, icon?: string }` |
| `platforms.ios` | object | no | `{ enabled: boolean }`. The bundle ID of the iOS app is `bundleID` in `ios/xtool.yml` |
| `webview` | object | no | `{ allowFileAccess, allowUniversalAccessFromFileURLs, userAgent }` |
| `script.start` | string | no | Dev server start command (e.g. `npm run dev -- --host 0.0.0.0`) |
| `script.preStartCleanup` | string[] | no | Paths removed in `lib/` before the dev server starts (e.g. stale lock files) |

### `webview` Settings

| Rule | Value |
|------|-------|
| Baked by | `gyo run`, `gyo build` (Android) |
| Applied by | The Android shell at WebView creation |
| `userAgent` | Replaces the WebView's own user agent when set to a non-empty value |
| Ignored value | `gyo-webview/1.0`: the default written by earlier versions, never applied by any shell |

### Android App Identity

`gyo run` and `gyo build` rewrite the generated Android project from these settings before every build.

| Setting | Android | Rule |
|---------|---------|------|
| `version` | `versionName` | — |
| `platforms.android.versionCode` | `versionCode` | Positive integer; left as generated when unset |
| `displayName` | `app_name` | Left as generated when unset |
| `platforms.android.icon` | Launcher icon | PNG, relative to `gyo.config.json`; copied to the highest-density bucket only |

### Release Signing (Android)

A release build signs the APK when `android/keystore.properties` exists and fails before Gradle when it does not. The file is ignored by git.

| Property | Value |
|----------|-------|
| `storeFile` | Keystore path, relative to `android/app/` |
| `storePassword` | Keystore password |
| `keyAlias` | Key alias |
| `keyPassword` | Key password |

`gyo build android --release` writes the file when all four variables are set, and fails before Gradle when only some are.

| Variable | Property |
|----------|----------|
| `GYO_ANDROID_KEYSTORE_PATH` | `storeFile` |
| `GYO_ANDROID_KEYSTORE_PASSWORD` | `storePassword` |
| `GYO_ANDROID_KEY_ALIAS` | `keyAlias` |
| `GYO_ANDROID_KEY_PASSWORD` | `keyPassword` |

> See [android/README.md](../cli/templates/android/README.md) for the same contract inside a generated project.

## Plugin Modules

A plugin with an `android/` directory is a Gradle library module. The app build includes it from where `node_modules` keeps the package, so the manifest merger brings in what the module declares and the module brings its own dependencies.

| File | Tracked | Content |
|------|---------|---------|
| `android/gyo.settings.gradle` | yes | `include` and `projectDir` of every plugin module |
| `android/app/gyo.build.gradle` | yes | `implementation project(...)` of every plugin module |
| `android/app/src/main/java/gyo/plugins/bridge/PluginRegistry.kt` | yes | One `BridgeRegistry.register` per plugin |
| `.gyo-plugins` | no | Record of the last sync, with paths relative to the project |

| Rule | Value |
|------|-------|
| Written by | `gyo run`, `gyo build android`, `gyo install`; the files are rewritten before every build |
| Skipped when | `.gyo-plugins` matches the installed plugins |
| Bridge | `android/gyo-bridge/`: the native bridge; the app depends on it and plugins compile against it |
| Run-time permissions | Declared by the app in `android/app/src/main/AndroidManifest.xml`; gyo warns about missing ones and never writes them |

An Android project without `android/gyo-bridge/` cannot include plugins. It needs these changes, all of them the content of a current template:

| Part of `android/` | Needs |
|-------------------|-------|
| `gyo-bridge/` | The module; the bridge sources leave `app/src/main/java/gyo/plugins/bridge/` |
| `build.gradle` | `id 'com.android.library' version <AGP version> apply false` |
| `settings.gradle` | `include ':gyo-bridge'` and `apply from: 'gyo.settings.gradle'` |
| `app/build.gradle` | `implementation project(':gyo-bridge')` and `apply from: "gyo.build.gradle"` |
| `app/src/main/java/<package path>/MainActivity.kt` | `PluginRegistry.registerAll(this)` after `BridgeRegistry.initialize()`; no hand-written `BridgeRegistry.register` |
| `app/src/main/java/gyo/plugins/<name>/` | Removed: the plugins bring their own sources |

> See [PLUGINS.md](./PLUGINS.md) for the plugin side of the contract.

## Platform Requirements

### Android

| Requirement | Minimum |
|-------------|---------|
| JDK | 17 |
| Android SDK | the platform the template compiles against: 36 |
| Build-Tools | latest |
| ADB | included with SDK |

Environment: `ANDROID_HOME` must point to SDK path.

### iOS

| Requirement | Notes |
|-------------|-------|
| xtool | `curl -fsSL https://xtool.sh \| sh` |
| libimobiledevice | Linux only: `apt install libimobiledevice-utils` |

> See [ARCHITECTURE.md](./ARCHITECTURE.md) for build pipeline details.

## Dependencies

### Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `commander` | ^12.0 | CLI framework |
| `chalk` | ^4.1 | Terminal colors |
| `inquirer` | ^13.1 | Interactive prompts |
| `fs-extra` | ^11.2 | File system utilities |
| `ora` | ^5.4 | Spinner UI |
| `open` | ^9.1 | Open URLs/apps |

> See `cli/package.json` for full dependency list.
