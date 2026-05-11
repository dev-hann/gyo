# @gyo-framework/app-launcher

Gyo plugin for launching apps and URLs via Android PackageManager bridge.

## Installation

```bash
npm install @gyo-framework/app-launcher
```

## Usage

```typescript
import { AppLauncher } from '@gyo-framework/app-launcher';

const launcher = new AppLauncher();

// List installed apps
const { apps, count } = await launcher.listApps();

// Open an app
const opened = await launcher.openApp({ packageName: 'com.example.app' });

// Open a URL
await launcher.openUrl({ url: 'https://example.com' });

// Search apps
const results = await launcher.searchApps({ query: 'chrome' });

// Check availability
if (launcher.isAvailable()) {
  // running in WebView with native bridge
}

// Cleanup
launcher.destroy();
```

## API

### `AppLauncher`

| Method | Returns | Description |
|--------|---------|-------------|
| `listApps()` | `Promise<ListAppsResult>` | List all launchable apps |
| `openApp(params)` | `Promise<boolean>` | Open app by package name |
| `openUrl(params)` | `Promise<boolean>` | Open URL in default browser |
| `searchApps(params)` | `Promise<SearchAppsResult>` | Search apps by name/package |
| `isAvailable()` | `boolean` | Check if native bridge is available |
| `destroy()` | `void` | Clean up resources |

### Types

```typescript
interface AppInfo {
  packageName: string;
  name: string;
}

interface ListAppsResult {
  apps: AppInfo[];
  count: number;
}

interface OpenAppParams {
  packageName: string;
}

interface OpenUrlParams {
  url: string;
}

interface SearchAppsParams {
  query: string;
}

interface SearchAppsResult {
  apps: AppInfo[];
  count: number;
}
```

## Android Setup

Register the bridge handler in your `MainActivity.kt`:

```kotlin
import gyo.plugins.app_launcher.AppLauncherBridge
import gyo.plugins.bridge.BridgeRegistry

// In onCreate():
BridgeRegistry.register("app_launcher", AppLauncherBridge(this))
```

## Peer Dependencies

- `@gyo-framework/bridge@^0.1.3`

## License

MIT
