# Gyo Framework

Framework-agnostic cross-platform app shell: any web application served over HTTP, wrapped in native WebView shells for Android and iOS.

The web app is deployed on a server (or run locally during development). The native app is a thin shell that connects to the configured `serverUrl` — web updates ship without store review.

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
# Put any web app in lib/ (React, Next.js, Vue, Svelte, ...) and set
# script.start + profiles.development.serverUrl in gyo.config.json
gyo run
```

## Project Structure

```
gyo/
├── cli/          # @gyo-framework/cli — CLI tool (create/run/build native shells)
├── plugins/      # bridge + test-utils + 9 feature plugins (Android native)
└── docs/         # Specifications
```

## Documentation

> See [docs/README.md](./docs/README.md) for the full documentation index.

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture and command hierarchy |
| [docs/CLI.md](./docs/CLI.md) | CLI command reference |
| [docs/PLUGINS.md](./docs/PLUGINS.md) | Plugin API specifications |
| [docs/BRIDGE_INTEGRATION.md](./docs/BRIDGE_INTEGRATION.md) | Native handler protocols and WebView security model |
| [docs/DOC_CONVENTIONS.md](./docs/DOC_CONVENTIONS.md) | Documentation writing conventions |

## License

MIT
