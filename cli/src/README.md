# CLI Source (`src`)

This directory contains the main source code for the `gyo` CLI.

## Directory Structure

```
src/
├── index.ts              # Entry point - command registration
│
├── core/                 # Domain core (no business logic)
│   ├── index.ts          # Barrel export
│   ├── types.ts          # Platform, GyoConfig, ProfileConfig
│   ├── errors.ts         # GyoError, BuildFailedError, etc.
│   └── constants.ts      # DEFAULT_PORT, DEFAULT_CONFIG, etc.
│
├── services/             # Business logic layer
│   ├── config.service.ts # loadConfig, saveConfig, getProfileUrl
│   └── device.service.ts # getAndroidDevices, getIOSDevices, getAllDevices
│
├── utils/                # Pure utilities
│   ├── logger.ts         # Console logging with colors
│   ├── exec.ts           # Command execution, getGradlew
│   └── fs.ts             # File system operations
│
└── commands/             # CLI commands
    ├── base/             # BaseCommand, PlatformCommand, MultiPlatformCommand
    ├── build/            # AbstractBuildCommand, Android/IOSBuildCommand
    ├── run/              # AbstractRunCommand, Android/IOSRunCommand
    └── *.ts              # Command entry points
```

## Layers

| Layer | Purpose | Dependencies |
|-------|---------|--------------|
| `core/` | Types, errors, constants | None |
| `services/` | Business logic | core, utils |
| `utils/` | Pure utilities | None |
| `commands/` | CLI presentation | all above |

## Adding a New Command

1. Create `commands/mycommand.ts` extending `BaseCommand`
2. Implement `getMeta()` and `run()`
3. Register in `index.ts`: `registerCommand(new MyCommand())`
