# Gyo Framework

Cross-platform mobile app framework: React + Vite + TypeScript for Android and iOS.

## Requirements

| Dependency | Minimum | Platform |
|------------|---------|----------|
| Node.js | 24.0 | All |
| npm | 11.0 | All |
| Android Studio | Hedgehog | Android |
| Android SDK | API 24 | Android |
| JDK | 11 | Android |
| xtool | latest | iOS |
| libimobiledevice | any | iOS (Linux only) |

## Quick Start

```bash
cd cli && npm install -g .
gyo create my-app && cd my-app
cd lib && npm install
gyo run
```

## Project Structure

```
gyo/
├── cli/          # @gyo-framework/cli — CLI tool
├── plugins/      # @gyo-framework/bridge — web-native bridge
└── docs/         # Specifications
```

## Documentation

> See [docs/README.md](./docs/README.md) for the full documentation index.

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture and command hierarchy |
| [docs/CLI.md](./docs/CLI.md) | CLI command reference |
| [docs/PLUGINS.md](./docs/PLUGINS.md) | Plugin API specifications |
| [docs/DOC_CONVENTIONS.md](./docs/DOC_CONVENTIONS.md) | Documentation writing conventions |

## License

MIT
