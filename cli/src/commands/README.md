# CLI Commands

This directory contains the implementation for each CLI command. All commands follow a hierarchical class structure for code reuse and consistency.

## Architecture

```
commands/
├── base/                              # Base command classes
│   ├── index.ts                       # Barrel export
│   ├── BaseCommand.ts                 # All commands inherit from this
│   ├── PlatformCommand.ts             # Single platform commands (build, run, debug)
│   └── MultiPlatformCommand.ts        # Multi-platform commands (clean)
│
├── build/                             # Build command implementations
│   ├── AbstractBuildCommand.ts
│   ├── AndroidBuildCommand.ts
│   └── IOSBuildCommand.ts
│
├── run/                               # Run command implementations
│   ├── AbstractRunCommand.ts
│   ├── AndroidRunCommand.ts
│   └── IOSRunCommand.ts
│
└── *.ts                               # Command entry points
    ├── build.ts, run.ts, clean.ts
    ├── config.ts, create.ts, debug.ts
    ├── devices.ts, doctor.ts, upgrade.ts
```

## Class Hierarchy

```
BaseCommand
├── PlatformCommand → AbstractBuildCommand → Android/IOSBuildCommand
│                   → AbstractRunCommand → Android/IOSRunCommand
│                   → DebugCommand
├── MultiPlatformCommand → CleanCommand
└── Direct inheritance
    ├── DevicesCommand, DoctorCommand, UpgradeCommand
    └── ConfigCommand, CreateCommand
```

## Command Pattern

Each command class implements `getMeta()` and `run()`:

```typescript
export class MyCommand extends BaseCommand<MyCommandOptions> {
  getMeta(): CommandMeta {
    return {
      name: "mycommand <arg>",
      description: "Description of my command",
      arguments: "[optionalArg]",
      options: [
        { flags: "-f, --flag", description: "Some flag", default: false },
      ],
    };
  }

  protected async run(): Promise<void> {
    this.startSpinner("Doing something...");
    // ...
    this.succeedSpinner("Done!");
  }
}
```

## BaseCommand

Base class for all commands. Provides:
- Spinner management (`startSpinner`, `updateSpinner`, `succeedSpinner`, `failSpinner`)
- Error handling (`handleError`)
- Configuration loading (`loadConfiguration`)
- Project validation (`requireGyoProject`)
- Command metadata (`getMeta`)
- Options setter (`setOptions`)

## PlatformCommand

Extends `BaseCommand` for single-platform operations. Provides:
- Platform validation
- Platform enabled check
- Platform directory existence check
- `setPlatform()` method

## MultiPlatformCommand

Extends `BaseCommand` for multi-platform operations (like `clean all`).
- `setPlatform()` method
- `processAllPlatforms()` helper

## Registration

Commands are registered in `src/index.ts`:

```typescript
import { BaseCommand } from "./commands/base/index.js";
import { MyCommand } from "./commands/mycommand.js";

function registerCommand(cmd: BaseCommand<any>): void {
  const meta = cmd.getMeta();
  let c = program.command(meta.name).description(meta.description);
  // ... register options
  c.action(async (...args) => {
    cmd.setOptions(options);
    await cmd.execute();
  });
}

registerCommand(new MyCommand());
```

## Creating a New Command

1. Create `commands/mycommand.ts` extending appropriate base class
2. Implement `getMeta()` and `run()`
3. Register in `src/index.ts` with `registerCommand(new MyCommand())`

### Example

```typescript
// commands/mycommand.ts
import { BaseCommand, CommandMeta, BaseCommandOptions } from "./base/index.js";

interface MyCommandOptions extends BaseCommandOptions {
  flag?: boolean;
}

export class MyCommand extends BaseCommand<MyCommandOptions> {
  getMeta(): CommandMeta {
    return {
      name: "mycommand",
      description: "Description of my command",
      options: [
        { flags: "-f, --flag", description: "Some flag" },
      ],
    };
  }

  protected async run(): Promise<void> {
    this.startSpinner("Running my command...");
    
    if (this.options.flag) {
      // Do something
    }
    
    this.succeedSpinner("Command completed!");
  }
}
```
