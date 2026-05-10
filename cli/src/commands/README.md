# CLI Commands

Implementation directory for CLI commands.

## Directory Structure

```
commands/
├── base/
│   ├── BaseCommand.ts          # Spinner, error handling, config loading
│   ├── PlatformCommand.ts      # Single platform validation
│   └── MultiPlatformCommand.ts # Multi-platform processing
├── build/
│   ├── AbstractBuildCommand.ts
│   ├── AndroidBuildCommand.ts
│   └── IOSBuildCommand.ts
├── run/
│   ├── AbstractRunCommand.ts
│   ├── AndroidRunCommand.ts
│   └── IOSRunCommand.ts
└── *.ts                        # Entry points: create, config, clean, etc.
```

## Class Hierarchy

> See [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) for the full hierarchy diagram.

## Pattern

Every command implements `getMeta()` and `run()`:

```typescript
export class MyCommand extends BaseCommand<MyCommandOptions> {
  getMeta(): CommandMeta { ... }
  protected async run(): Promise<void> { ... }
}
```

## Registration

Commands are registered in `src/index.ts` via `registerCommand(new MyCommand())`.

## Adding a New Command

1. Create `commands/mycommand.ts` extending the appropriate base class
2. Implement `getMeta()` and `run()`
3. Register in `src/index.ts`
