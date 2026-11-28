# Architecture

System architecture for the Gyo framework.

## Model

Framework-agnostic: the web application is deployed on a server and consumed over HTTP. The native app is a thin WebView shell that loads `serverUrl` from `gyo-config.json`. The CLI holds no web-framework knowledge — the user configures the start command and server URL in `gyo.config.json`.

## Directory Structure

```
gyo/
├── cli/                       # @gyo-framework/cli
│   ├── src/
│   │   ├── core/              # Types, errors, constants
│   │   ├── services/          # Business logic
│   │   ├── utils/             # Utilities
│   │   └── commands/          # CLI commands
│   ├── templates/             # Native shell templates (android/ios)
│   │   └── android/
│   │       ├── app/           # The app module
│   │       └── gyo-bridge/    # The native bridge, a library module plugins compile against
│   └── e2e/                   # E2E pipeline tests
├── bridge/                    # @gyo-framework/bridge: the JS bridge for apps and plugins
│   └── src/
│       ├── index.ts           # Bridge, requestPermissions
│       └── testing/           # The ./testing subpath: a stand-in for the native side in tests
├── plugins/                   # Community plugins, @gyo-community/<name>
│   ├── accessibility/
│   ├── app-launcher/
│   ├── communication/
│   ├── device-info/
│   ├── http/
│   ├── media/
│   └── notifications/         # Each: src/ for the web side; android/ a Gradle library module
└── docs/                      # Specifications
```

> See `cli/src/README.md` for CLI source structure.
> See `bridge/README.md` for the bridge package.
> See [plugins/README.md](../plugins/README.md) for the plugin packages.

## Command Class Hierarchy

```
BaseCommand
├── CreateCommand               gyo create
├── ConfigCommand               gyo config (show/set/get)
├── DoctorCommand               gyo doctor
├── DevicesCommand              gyo devices
├── UpgradeCommand              gyo upgrade
├── RunCommand                  gyo run (delegates to Android/IOSRunCommand)
├── BuildCommand                gyo build <platform> (delegates to Android/IOSBuildCommand)
├── PlatformCommand
│   ├── DebugCommand            gyo debug <platform>
│   ├── AbstractRunCommand
│   │   ├── AndroidRunCommand
│   │   └── IOSRunCommand
│   └── AbstractBuildCommand
│       ├── AndroidBuildCommand
│       └── IOSBuildCommand
├── InstallCommand             gyo install
└── CleanCommand                gyo clean
```

> See `cli/src/commands/README.md` for command development patterns.

## Runtime Components

### Development (`gyo run`, default profile: `development`)

```
script.start from gyo.config.json → dev server spawned in lib/
  → fails before spawning when the port is already in use
  → readiness detected by TCP port probe (profiles.<profile>.serverUrl port)
Android: gyo-config.json (serverUrl = detected LAN URL) → plugin modules included → gradlew assembleDebug → install → launch → logcat
iOS:     gyo-config.json (serverUrl = detected LAN URL) → xtool dev → idevicesyslog
```

The dev server must listen on `0.0.0.0` (set the host flag in `script.start`, e.g. `npm run dev -- --host 0.0.0.0`) so devices on the LAN can connect.

The dev server's process group and the log process are killed on `Ctrl+C`, on `SIGTERM`, on a closed terminal, and when the process that launched the CLI goes away.

### Plugins

A plugin is a package under `@gyo-community/` or `@gyo-framework/` installed in `lib/`, with a `gyo` field in its `package.json`. A plugin with an `android/` directory is a Gradle library module. Before every Android build, gyo includes the module of each plugin installed in `lib/` in the app build and registers its handler.

> See [CLI.md](./CLI.md#plugin-modules) for the files a sync writes and their rules.
> See [PLUGINS.md](./PLUGINS.md) for the packages and the plugin conventions.

### Production (`gyo build`)

```
Deploy web app to a server
  → profiles.<profile>.serverUrl (prompted once and saved if missing)
  → a localhost serverUrl in the development profile is replaced by the LAN address
  → gyo-config.json (serverUrl) baked into native assets
Android: gradlew assembleRelease/Debug → APK
iOS:     xtool dev → install to device
```

### Written Files

| File | Written by | Tracked |
|------|------------|---------|
| `gyo.config.json` | `gyo create`, `gyo config set`, the one-time deploy URL prompt | yes |
| `android/app/src/main/assets/gyo-config.json` | `gyo run`, `gyo build` | no (generated, ignored) |
| `android/app/build.gradle` (version lines), `res/values/strings.xml`, `AndroidManifest.xml` (icon, label) | `gyo run`, `gyo build`, from the app identity settings | yes (edited in place) |
| `android/keystore.properties` | `gyo build android --release`, from the environment | no (ignored) |
| `android/gyo.settings.gradle`, `android/app/gyo.build.gradle`, `PluginRegistry.kt`, `.gyo-plugins` | `gyo run`, `gyo build android`, `gyo install` | the Gradle files and the registry: yes; `.gyo-plugins`: no |

The detected LAN address is never written to `gyo.config.json`.

### WebView Security

The native bridge is origin-restricted: only the origin (scheme, host and port) of the configured `serverUrl` may invoke bridge handlers. External navigation is blocked in the WebView and opened in the system browser.

| Build | Cleartext traffic | Reason |
|-------|-------------------|--------|
| debug | permitted | `gyo run` serves the web app over plain http from the developer machine's LAN address |
| release | denied, except `localhost` and `10.0.2.2` | — |

> See [BRIDGE_INTEGRATION.md](./BRIDGE_INTEGRATION.md) for details.

### Android Shell Behaviour

| Situation | What the app does |
|-----------|-------------------|
| The server cannot be reached | Says so and offers Retry, instead of the browser's error page |
| No `gyo-config.json` | Says that `gyo run` or `gyo build android` has to run once, instead of stopping |
| `<input type="file">` | Opens the system picker, which needs no permission; several files when the input takes them |
| A link the WebView cannot show | Downloads it: to Downloads on Android 10 and later, to the app's own folder before |
| Dark mode, font size, keyboard, rotation | Keeps the page: the Activity is not recreated |
| System bars and keyboard | Keeps the page clear of them |
| The back button or the back gesture | Closes full-screen video, then asks the page, then goes to the previous page, then puts the app behind the one in front and keeps its state |
| The page takes the back press | On Android, the app dispatches `gyo:backbutton` on `window` before acting; a page that calls `preventDefault()` keeps it from acting. Nothing is asynchronous: the decision is taken when the event arrives |

## Communication Flow

```
Web (JS/TS)                              Native (Kotlin/Swift)
    │                                         │
    │  bridge.invoke('method', data)          │
    │────────────────────────────────────────▶│
    │                                         │ handler.execute()
    │  Promise<T>                             │
    │◀────────────────────────────────────────│
    │                                         │
    │  an event (Android)                     │ handler.attachEvents(publish)
    │◀────────────────────────────────────────│
    │  bridge.listen(callback)                │

> See [BRIDGE_INTEGRATION.md](./BRIDGE_INTEGRATION.md) for native handler protocols.

## Platform Tooling

| Platform | Build Tool | Device Comm | Log Monitoring | Debug |
|----------|-----------|-------------|----------------|-------|
| Android | Gradle | ADB | adb logcat | Chrome DevTools |
| iOS | xtool | libimobiledevice | idevicesyslog | Safari Web Inspector |

> See [CLI.md](./CLI.md) for platform-specific requirements and setup.
