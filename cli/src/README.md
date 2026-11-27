# CLI Source (`src`)

## Directory Structure

```
src/
├── index.ts              # Entry point — command registration
├── core/                 # Domain core (no dependencies)
│   ├── types.ts          # Platform, GyoConfig, ProfileConfig
│   ├── errors.ts         # GyoError, BuildFailedError, etc.
│   ├── constants.ts      # DEFAULT_PORT, WEB_SERVER_TIMEOUT_MS, etc.
│   ├── package-name.ts   # Project name → Android package name
│   ├── webview-config.ts # webview settings the shell has to apply
├── services/             # Business logic (depends on: core, utils)
│   ├── config.service.ts # loadConfig, setConfigValue, validation
│   ├── device.service.ts # getAndroidDevices, getIOSDevices, getAllDevices
│   ├── android-shell.service.ts # App identity sync, release signing
│   ├── plugin.service.ts # Plugin discovery; includes Android modules in the app build
│   ├── web-server.service.ts # Starts the dev server and finds the LAN address
├── utils/                # Utilities (no dependency on services or commands)
│   ├── logger.ts         # Console logging with chalk
│   ├── exec.ts           # child_process spawn wrapper, signalling a process tree
│   ├── fs.ts             # fs-extra wrappers
│   └── paths.ts          # Files shipped with the CLI: templates, package.json
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
