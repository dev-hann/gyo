# CLI Reference

Command specifications for `@gyo-framework/cli`.

## Installation

```bash
npm install -g @gyo-framework/cli
```

## Commands

### `gyo create <project-name>`

Create a new Gyo project: native shells (android/ios), `gyo.config.json`, README. Framework-agnostic — the web application in `lib/` is built by the user.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-f, --force` | boolean | false | Overwrite existing directory |

### `gyo run`

Run on a connected device. With the `development` profile (default): spawns the dev server via `script.start` in `lib/`, waits for the port (TCP probe), bakes the detected LAN URL into the native config asset, then builds/installs/launches the native shell. Other profiles: use the configured `serverUrl` directly. `gyo.config.json` is not modified.

Fails before spawning the dev server when its port is already in use.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-d, --device <device>` | string | auto | Specific device ID |
| `-p, --profile <profile>` | string | development | Build profile |
| `--port <number>` | number | from config | Dev server port override |
| `-v, --verbose` | boolean | false | Detailed logs |

### `gyo build <platform>`

Build the app for `android` or `ios`. Bakes `profiles.<profile>.serverUrl` into native assets; a `localhost` address in the `development` profile is baked as the machine's LAN address. If the profile has no `serverUrl`, prompts for the deploy URL (interactive) and saves it; fails with a clear error in non-interactive environments.

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
| `script.start` | string | no | Dev server start command (e.g. `npm run dev -- --host 0.0.0.0`) |
| `script.preStartCleanup` | string[] | no | Paths removed in `lib/` before the dev server starts (e.g. stale lock files) |

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
