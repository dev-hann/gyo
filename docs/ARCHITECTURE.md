# Architecture

System architecture for the Gyo framework.

## Directory Structure

```
gyo/
├── cli/                       # @gyo-framework/cli
│   ├── src/
│   │   ├── core/              # Types, errors, constants
│   │   ├── services/          # Business logic
│   │   ├── utils/             # Utilities
│   │   └── commands/          # CLI commands
│   └── templates/             # Project scaffolding
├── plugins/
│   └── bridge/                # @gyo-framework/bridge (built-in)
└── docs/                      # Specifications
```

> See `cli/src/README.md` for CLI source structure.
> See `plugins/README.md` for plugin package listing.

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
└── MultiPlatformCommand
    └── CleanCommand            gyo clean
```

> See `cli/src/commands/README.md` for command development patterns.

## Runtime Components

### Development (`gyo run`)

```
Android: Vite server → gradlew assembleDebug → installDebug → adb shell am start → adb logcat
iOS:     Vite server → xtool dev → idevicesyslog
```

### Production (`gyo build`)

```
Android: npm run build (lib) → gradlew assembleRelease/Debug → APK
iOS:     npm run build (lib) → xtool dev → install to device
```

## Communication Flow

```
Web (JS/TS)                              Native (Kotlin/Swift)
    │                                         │
    │  bridge.invoke('method', data)          │
    │────────────────────────────────────────▶│
    │                                         │ handler.execute()
    │  Promise<T>                             │
    │◀────────────────────────────────────────│
```

> See [BRIDGE_INTEGRATION.md](./BRIDGE_INTEGRATION.md) for native handler protocols.

## Platform Tooling

| Platform | Build Tool | Device Comm | Log Monitoring | Debug |
|----------|-----------|-------------|----------------|-------|
| Android | Gradle | ADB | adb logcat | Chrome DevTools |
| iOS | xtool | libimobiledevice | idevicesyslog | Safari Web Inspector |

> See [CLI.md](./CLI.md) for platform-specific requirements and setup.
