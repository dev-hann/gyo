# Gyo CLI

## Development Setup

### Initial Setup
```bash
cd cli
npm install
npm run build
npm link  # Make 'gyo' command available globally
```

### Development Mode (Auto Build)
CLI code is automatically built when modified:

```bash
# Terminal 1: Watch mode (auto build on changes)
npm run dev

# Terminal 2: Test gyo commands
cd /path/to/test-project
gyo run
```

### Manual Build
```bash
npm run build
```

## Commands

| Command | Description |
|---------|-------------|
| `gyo create <name>` | Create a new gyo project |
| `gyo run` | Run app on connected device |
| `gyo build <platform>` | Build for production |
| `gyo clean [platform]` | Clean build artifacts |
| `gyo config <action>` | Manage configuration |
| `gyo devices` | List connected devices |
| `gyo doctor` | Check development environment |
| `gyo debug <platform>` | Launch debugger |
| `gyo upgrade` | Upgrade CLI |

## Architecture

```
cli/src/
├── core/        # Types, errors, constants
├── services/    # Business logic
├── utils/       # Pure utilities
└── commands/    # CLI presentation
    └── base/    # BaseCommand hierarchy
```

## Future Enhancements

- [ ] `gyo test` command (unit and integration tests)
- [ ] `gyo lint` command (code style and static analysis)
- [ ] Enhanced help messages for each command
- [ ] Better error handling and user feedback
- [ ] Auto-update functionality (`gyo upgrade`)
