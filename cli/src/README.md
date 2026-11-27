# CLI Source (`src`)

## Directory Structure

```
src/
├── index.ts              # Entry point: parse the command line, report what a command did not
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
├── program.ts           # The CLI as Commander defines it: every command, its arguments and options
└── commands/             # CLI commands (depends on: all above)
    ├── base/             # BaseCommand: options, arguments, lifecycle, error reporting
    │   └── PlatformCommand # A command bound to one platform of a gyo project
    ├── build/            # AbstractBuildCommand → Android/IOSBuildCommand
    ├── run/              # AbstractRunCommand → Android/IOSRunCommand
    └── *.ts              # Command entry points, and xtool-output.ts
```

## Dependency Direction

```
core → utils → services → commands
```

Each layer only imports from layers to its left.

> See [commands/README.md](./commands/README.md) for command development patterns.
