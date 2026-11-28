# @gyo-community/app-launcher

Gyo plugin for launching apps and URLs via Android PackageManager bridge, and for installing an APK with the system's installer.

## Installation

```bash
npm install @gyo-community/app-launcher
```

## Usage

```typescript
import { AppLauncher } from '@gyo-community/app-launcher';

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

### `ApkInstaller`

For an app that is not in a store: the page has the new version downloaded into the cache of the app (`Downloader` of `@gyo-community/http`) and hands its path here.

| Method | Returns | Description |
|--------|---------|-------------|
| `canInstall()` | `Promise<boolean>` | Whether the app may install an APK: a permission the reader gives in the settings on Android 8 and later, `true` before |
| `openInstallSettings()` | `Promise<boolean>` | Open the settings where the app is allowed to install APKs |
| `install(params)` | `Promise<boolean>` | Hand the APK at `path` to the system's installer; whether the installer was started |
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

interface InstallApkParams {
  // An absolute path, in the cache of the app
  path: string;
}
```

## Android Setup

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Nothing in `MainActivity.kt` needs editing.

The module's manifest declares a `<queries>` element for the apps that have a launcher icon, which is what makes them visible on Android 11 and later.

For `install()` on Android 8 and later, the app declares `REQUEST_INSTALL_PACKAGES` in `android/app/src/main/AndroidManifest.xml`; without it the system's installer refuses the app. `gyo install` warns while the permission is missing. The APK is handed to the installer through a `FileProvider` the module declares, which gives out `apk_install/` in the cache and nothing else of the app.

## Peer Dependencies

- `@gyo-framework/bridge@^0.2.0`

## License

MIT
