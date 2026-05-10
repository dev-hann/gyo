# CLI Source (`src`)

## Directory Structure

```
src/
├── index.ts              # Entry point — command registration
├── core/                 # Domain core (no dependencies)
│   ├── types.ts          # Platform, GyoConfig, ProfileConfig
│   ├── errors.ts         # GyoError, BuildFailedError, etc.
│   └── constants.ts      # DEFAULT_PORT, WEB_SERVER_TIMEOUT_MS, etc.
├── services/             # Business logic (depends on: core, utils)
│   ├── config.service.ts # loadConfig, saveConfig, getProfileUrl
│   └── device.service.ts # getAndroidDevices, getIOSDevices, getAllDevices
├── utils/                # Pure utilities (no dependencies)
│   ├── logger.ts         # Console logging with chalk
│   ├── exec.ts           # child_process spawn wrapper
│   └── fs.ts             # fs-extra wrappers
└── commands/             # CLI commands (depends on: all above)
    ├── base/             # BaseCommand, PlatformCommand, MultiPlatformCommand
    ├── build/            # AbstractBuildCommand → Android/IOSBuildCommand
    ├── run/              # AbstractRunCommand → Android/IOSRunCommand
    └── *.ts              # Command entry points
```

## Dependency Direction

```
core → utils → services → commands
```

Each layer only imports from layers to its left.

> See [commands/README.md](./commands/README.md) for command development patterns.
