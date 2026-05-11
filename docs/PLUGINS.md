# Plugin API Specifications

Type signatures and contracts for Gyo plugins.

## @gyo-framework/bridge

Core bridge for web-native communication.

### Exports

```typescript
class Bridge {
  constructor(name: string, options?: BridgeOptions)
  invoke<T>(method: string, data?: unknown): Promise<T>
  listen(callback: EventCallback): Unsubscribe
  getName(): string
  isAvailable(): boolean
  destroy(): void
}

interface BridgeOptions {
  timeout?: number // default: 30000
}

interface BridgeRequest {
  bridgeName: string
  methodName: string
  data?: unknown
  callbackId: string
}

interface BridgeResponse {
  callbackId: string
  success: boolean
  data?: unknown
  error?: string
}

interface BridgeEvent {
  bridgeName: string
  data: unknown
}

type EventCallback = (data: unknown) => void
type Unsubscribe = () => void
```

> See `plugins/bridge/src/types.ts` for full type definitions.
> See [BRIDGE_INTEGRATION.md](./BRIDGE_INTEGRATION.md) for native handler protocols.

## @gyo-framework/app-launcher

App launching and URL opening via Android PackageManager.

### Exports

```typescript
class AppLauncher {
  constructor()
  listApps(): Promise<ListAppsResult>
  openApp(params: OpenAppParams): Promise<boolean>
  openUrl(params: OpenUrlParams): Promise<boolean>
  searchApps(params: SearchAppsParams): Promise<SearchAppsResult>
  isAvailable(): boolean
  destroy(): void
}

interface AppInfo {
  packageName: string
  name: string
}

interface ListAppsResult {
  apps: AppInfo[]
  count: number
}

interface OpenAppParams {
  packageName: string
}

interface OpenUrlParams {
  url: string
}

interface SearchAppsParams {
  query: string
}

interface SearchAppsResult {
  apps: AppInfo[]
  count: number
}
```

### Native Handler

**Android**: `gyo.plugins.app_launcher.AppLauncherBridge`

| Method | Input | Output | Android API |
|--------|-------|--------|-------------|
| `list_apps` | — | `{ apps: AppInfo[], count: number }` | `PackageManager.getInstalledApplications()` |
| `open_app` | `{ packageName: string }` | `boolean` | `PackageManager.getLaunchIntentForPackage()` |
| `open_url` | `{ url: string }` | `boolean` | `Intent.ACTION_VIEW` |
| `search_apps` | `{ query: string }` | `{ apps: AppInfo[], count: number }` | `PackageManager` + filter |

### Setup

```kotlin
// MainActivity.kt
import gyo.plugins.app_launcher.AppLauncherBridge
import gyo.plugins.bridge.BridgeRegistry

BridgeRegistry.register("app_launcher", AppLauncherBridge(this))
```

## Plugin Development Conventions

### Naming

| Scope | Usage | Example |
|-------|-------|---------|
| `@gyo-framework/` | Official | `@gyo-framework/app-launcher` |
| `@gyo-community/` | Community | `@gyo-community/analytics` |

### Structure

```
@gyo-framework/<name>/
├── package.json
├── src/
│   ├── index.ts        # Exported API
│   └── __tests__/
├── android/            # Kotlin implementation (optional)
│   └── src/main/kotlin/gyo/plugins/<name>/
└── ios/                # Swift implementation (optional)
    └── Sources/
```

### Rules

1. Must depend on `@gyo-framework/bridge` as `peerDependencies`.
2. Export a class with methods wrapping `Bridge.invoke()`.
3. Define and export all TypeScript interfaces for input/output.
4. Register native handlers via `BridgeRegistry` on each platform.

### Publishing

```bash
# Tag and push to trigger CI publish
git tag plugins/<name>/v<version>
git push origin plugins/<name>/v<version>
```

> See `plugins/README.md` for package listing.
