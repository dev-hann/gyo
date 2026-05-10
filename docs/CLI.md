# CLI Reference

Command specifications for `@gyo-framework/cli`.

## Installation

```bash
npm install -g @gyo-framework/cli
```

## Commands

### `gyo create <project-name>`

Create a new Gyo project.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-t, --template <template>` | string | prompt | Web framework: `react` or `next` |
| `-f, --force` | boolean | false | Overwrite existing directory |

### `gyo run`

Build and run on a connected device with a dev server.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-d, --device <device>` | string | auto | Specific device ID |
| `-p, --profile <profile>` | string | development | Build profile |
| `--port <number>` | number | from config | Dev server port override |
| `-v, --verbose` | boolean | false | Detailed logs |

### `gyo build <platform>`

Build production app. Platform: `android` or `ios`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-r, --release` | boolean | false | Release build |
| `-p, --profile <profile>` | string | development | Build profile |
| `-v, --verbose` | boolean | false | Detailed logs |

### `gyo clean [platform]`

Remove build artifacts. Platform: `android`, `ios`, `lib`, or `all`.

### `gyo config`

Manage `gyo.config.json`. Subcommands: `show`, `get <key>`, `set <key> <value>`.

Supports dot-notation keys. Values auto-converted to boolean/number.

### `gyo devices`

List connected devices.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--json` | boolean | false | JSON output |

### `gyo doctor`

Check and diagnose development environment.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-v` | boolean | false | Verbose: show paths |
| `--fix` | boolean | false | Auto-install missing deps |

### `gyo debug <platform>`

Open debugging tools. Platform: `android` or `ios`.

### `gyo upgrade`

Upgrade CLI.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--check` | boolean | false | Check only, no upgrade |
| `--version <ver>` | string | latest | Target version |

## Configuration

### `gyo.config.json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Project name |
| `version` | string | yes | Project version |
| `profiles` | object | no | Profile → `{ serverUrl: string }` mapping |
| `platforms.android` | object | no | `{ enabled: boolean, packageName?: string }` |
| `platforms.ios` | object | no | `{ enabled: boolean, bundleId?: string }` |
| `webview` | object | no | `{ allowFileAccess, allowUniversalAccessFromFileURLs, userAgent }` |
| `script.start` | string | no | Dev server start command (e.g. `npm run dev`) |

## Platform Requirements

### Android

| Requirement | Minimum |
|-------------|---------|
| JDK | 11 |
| Android SDK | API 24 |
| Build-Tools | latest |
| ADB | included with SDK |

Environment: `ANDROID_HOME` must point to SDK path.

### iOS

| Requirement | Notes |
|-------------|-------|
| xtool | `curl -fsSL https://xtool.sh \| sh` |
| libimobiledevice | Linux only: `apt install libimobiledevice-utils` |

> See [ARCHITECTURE.md](./ARCHITECTURE.md) for build pipeline details.

## Dependencies

### Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `commander` | ^12.0 | CLI framework |
| `chalk` | ^4.1 | Terminal colors |
| `inquirer` | ^13.1 | Interactive prompts |
| `fs-extra` | ^11.2 | File system utilities |
| `ora` | ^5.4 | Spinner UI |
| `open` | ^9.1 | Open URLs/apps |

> See `cli/package.json` for full dependency list.
