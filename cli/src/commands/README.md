# CLI Commands

Implementation directory for CLI commands.

## Directory Structure

```
commands/
├── base/
│   ├── BaseCommand.ts          # Options, arguments, lifecycle, error reporting
│   └── PlatformCommand.ts      # A command bound to one platform of a project
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

Every command implements `getMeta()` and `run()`. A command with positional arguments takes them in `setPositionalArgs()`, in the order `getMeta().arguments` spells them. The name in `getMeta()` is the command's word alone: the arguments are listed apart, once.

```typescript
export class MyCommand extends BaseCommand<MyCommandOptions> {
  getMeta(): CommandMeta { ... }
  protected async run(): Promise<void> { ... }
}
```

| Member | Role |
|--------|------|
| `getMeta()` | Name, description, arguments and options, as Commander takes them |
| `setPositionalArgs(args)` | Where the positional arguments arrive |
| `setOptions(options)` | Where the options arrive; merges, so the order of the two does not matter |
| `beforeRun()` | Checks that run before `run()`: a platform, a project, a config |
| `run()` | The command |
| `handleError(error)` | Reports once and rethrows; the entry point only exits |

## Registration

Commands are registered in `src/program.ts` with `registerCommand(program, new MyCommand())`. Commander hands each command what it parsed; nothing is cast there. `program.test.ts` goes through Commander for every command, which is where a wrongly declared argument shows.

## Adding a New Command

1. Create `commands/mycommand.ts` extending the appropriate base class
2. Implement `getMeta()` and `run()`
3. Register in `src/index.ts`
