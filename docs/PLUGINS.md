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

function requestPermissions(permissions: string[]): Promise<PermissionResult>

interface PermissionResult {
  granted: string[]
  denied: string[]
}
```

`requestPermissions` asks the user for Android run-time permissions and resolves once the user has answered. Only a permission the app declares in `android/app/src/main/AndroidManifest.xml` can be granted. It rejects outside the Android shell.

> See `plugins/bridge/src/Bridge.ts` and `plugins/bridge/src/permissions.ts` for full type definitions.
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

## @gyo-framework/device-info

Device metadata (Android).

### Exports

```typescript
class DeviceInfo {
  constructor()
  getInfo(): Promise<GetInfoResult>
  isAvailable(): boolean
  destroy(): void
}

interface DeviceInfoData {
  manufacturer: string
  model: string
  brand: string
  device: string
  androidVersion: string
  sdkVersion: number
  securityPatch: string
  screenDensity: number
  screenWidth: number
  screenHeight: number
  batteryLevel: number
  isCharging: boolean
}

interface GetInfoResult {
  info: DeviceInfoData
}
```

### Native Handler

**Android**: `gyo.plugins.device_info.DeviceInfoBridge` — no permissions required.

| Method | Input | Output |
|--------|-------|--------|
| `get_info` | — | `{ info: DeviceInfoData }` |

## @gyo-framework/contact-search

Contacts search (Android).

### Exports

```typescript
class ContactSearch {
  constructor()
  search(params: { query: string }): Promise<SearchResult>
  isAvailable(): boolean
  destroy(): void
}

interface ContactInfo {
  id: string
  name: string
  phoneNumbers: string[]
  emails: string[]
}

interface SearchResult {
  contacts: ContactInfo[]
  count: number
}
```

### Native Handler

**Android**: `gyo.plugins.contact_search.ContactSearchBridge` — requires `READ_CONTACTS`.

| Method | Input | Output |
|--------|-------|--------|
| `search` | `{ query: string }` | `{ contacts: ContactInfo[], count: number }` |

## @gyo-framework/notification-reader

Notification reading (Android).

### Exports

```typescript
class NotificationReader {
  constructor()
  list(): Promise<ListResult>
  isAvailable(): boolean
  destroy(): void
}

interface NotificationInfo {
  packageName: string
  title: string
  text: string
  postTime: number
  category: string
  id: number
}

interface ListResult {
  notifications: NotificationInfo[]
  count: number
}
```

### Native Handler

**Android**: `gyo.plugins.notification_reader.NotificationReaderBridge` — reads through `@gyo-framework/notification-listener`, which it brings. Until the user grants notification access, `list` returns an empty result.

| Method | Input | Output |
|--------|-------|--------|
| `list` | — | `{ notifications: NotificationInfo[], count: number }` |

## @gyo-framework/sms-sender

SMS send and read (Android).

### Exports

```typescript
class SmsSender {
  constructor()
  send(params: { phoneNumber: string; message: string }): Promise<boolean>
  read(params: { limit: number }): Promise<ReadResult>
  isAvailable(): boolean
  destroy(): void
}

interface SmsMessage {
  id: string
  address: string
  body: string
  date: number
  type: string
}

interface ReadResult {
  messages: SmsMessage[]
  count: number
}
```

### Native Handler

**Android**: `gyo.plugins.sms_sender.SmsSenderBridge` — requires `SEND_SMS`, `READ_SMS`.

| Method | Input | Output |
|--------|-------|--------|
| `send` | `{ phoneNumber: string, message: string }` | `boolean` |
| `read` | `{ limit: number }` | `{ messages: SmsMessage[], count: number }` |

## @gyo-framework/phone-caller

Calls and call log (Android).

### Exports

```typescript
class PhoneCaller {
  constructor()
  call(params: { phoneNumber: string }): Promise<boolean>
  getCallLog(params: { limit: number }): Promise<CallLogResult>
  isAvailable(): boolean
  destroy(): void
}

interface CallLogEntry {
  number: string
  name: string
  date: number
  duration: number
  type: string
}

interface CallLogResult {
  entries: CallLogEntry[]
  count: number
}
```

### Native Handler

**Android**: `gyo.plugins.phone_caller.PhoneCallerBridge` — requires `CALL_PHONE`, `READ_CALL_LOG`.

| Method | Input | Output |
|--------|-------|--------|
| `call` | `{ phoneNumber: string }` | `boolean` |
| `get_call_log` | `{ limit: number }` | `{ entries: CallLogEntry[], count: number }` |

## @gyo-framework/screen-reader

Screen UI tree reading (Android, accessibility).

### Exports

```typescript
class ScreenReader {
  constructor()
  read(): Promise<ReadResult>
  find(params: { text: string }): Promise<FindResult>
  isAvailable(): boolean
  destroy(): void
}

interface NodeInfo {
  text: string
  contentDescription: string
  className: string
  bounds: string
  isClickable: boolean
  isEditable: boolean
  children: NodeInfo[]
}

interface ReadResult {
  root: NodeInfo | null
  windowName: string
  packageName: string
}

interface FindResult {
  nodes: NodeInfo[]
  count: number
}
```

### Native Handler

**Android**: `gyo.plugins.screen_reader.ScreenReaderBridge` — reads through `@gyo-framework/accessibility`, which it brings. Until the user enables that service, `read` and `find` return an empty result.

| Method | Input | Output |
|--------|-------|--------|
| `read` | — | `{ root, windowName, packageName }` |
| `find` | `{ text: string }` | `{ nodes: NodeInfo[], count: number }` |

## @gyo-framework/screen-action

UI automation: tap, type, swipe, global actions (Android, accessibility).

### Exports

```typescript
class ScreenAction {
  constructor()
  tap(params: { x: number; y: number }): Promise<boolean>
  type(params: { text: string }): Promise<boolean>
  swipe(params: SwipeParams): Promise<boolean>
  globalAction(params: { action: string }): Promise<boolean>
  isAvailable(): boolean
  destroy(): void
}

interface SwipeParams {
  startX: number
  startY: number
  endX: number
  endY: number
  duration: number
}
```

### Native Handler

**Android**: `gyo.plugins.screen_action.ScreenActionBridge` — acts through `@gyo-framework/accessibility`, which it brings. Until the user enables that service, every method returns `false`.

| Method | Input | Output |
|--------|-------|--------|
| `tap` | `{ x, y }` | `boolean` |
| `type` | `{ text }` | `boolean` |
| `swipe` | `SwipeParams` | `boolean` |
| `global_action` | `{ action }` | `boolean` |

## @gyo-framework/screen-find

Screen element location (Android, accessibility).

### Exports

```typescript
class ScreenFind {
  constructor()
  findByText(params: { text: string; exact: boolean }): Promise<FindResult>
  findById(params: { id: string }): Promise<FindResult>
  isAvailable(): boolean
  destroy(): void
}

interface ElementInfo {
  text: string
  contentDescription: string
  className: string
  bounds: string
  isClickable: boolean
  isFocusable: boolean
  isEditable: boolean
  centerX: number
  centerY: number
}

interface FindResult {
  elements: ElementInfo[]
  count: number
}
```

### Native Handler

**Android**: `gyo.plugins.screen_find.ScreenFindBridge` — finds elements through `@gyo-framework/accessibility`, which it brings. Until the user enables that service, every method returns an empty result.

| Method | Input | Output |
|--------|-------|--------|
| `find_by_text` | `{ text, exact }` | `{ elements: ElementInfo[], count: number }` |
| `find_by_id` | `{ id }` | `{ elements: ElementInfo[], count: number }` |

## @gyo-framework/http

GET requests that run outside the WebView, with the headers the caller chooses (Android). The
WebView cannot make them itself: CORS hides cross-origin responses, and many servers answer a
WebView's own user agent or a foreign `Referer` with a redirect or a 403.

### Exports

```typescript
class Http {
  constructor()
  request(request: HttpRequest): Promise<HttpResponse>
  isAvailable(): boolean
  destroy(): void
}

interface HttpRequest {
  url: string
  headers?: Record<string, string>
  // Requests that share a jar name share their cookies, which survive app
  // restarts. Without a jar no cookie is stored or sent.
  jar?: string
}

interface HttpResponse {
  status: number
  // Where the answer came from, once redirects were followed
  url: string
  // Response headers by lower-case name, without set-cookie
  headers: Record<string, string>
  bodyBase64: string
}

function decodeText(response: HttpResponse, encoding?: string): string
function base64ToBytes(base64: string): Uint8Array
```

`request` resolves with whatever status the server answered, 404 and 503 included, and rejects when
no response arrived at all, such as a timeout or a connection that could not be made. After 60
seconds without an answer it rejects on its own.

### Native Handler

**Android**: `gyo.plugins.http.HttpBridge` — needs no permission beyond INTERNET. Its module brings OkHttp.

| Method | Input | Output |
|--------|-------|--------|
| `request` | `HttpRequest` | `HttpResponse` |

## @gyo-framework/accessibility

The accessibility service the screen plugins read and act through, and whether it is enabled (Android).

### Exports

```typescript
class Accessibility {
  constructor()
  isEnabled(): Promise<AccessibilityStatus>
  openSettings(): Promise<{ opened: boolean }>
  isAvailable(): boolean
  destroy(): void
}

interface AccessibilityStatus {
  enabled: boolean
}
```

### Native Handler

**Android**: `gyo.plugins.accessibility.AccessibilityBridge`. The module declares `GyoAccessibilityService`; the user enables it in the system settings. `@gyo-framework/screen-reader`, `screen-action` and `screen-find` depend on it.

| Method | Input | Output |
|--------|-------|--------|
| `is_enabled` | — | `{ enabled: boolean }` |
| `open_settings` | — | `{ opened: boolean }` |

## @gyo-framework/notification-listener

The notification listener service, whether access is granted, and the active notifications (Android).

### Exports

```typescript
class NotificationListener {
  constructor()
  isEnabled(): Promise<NotificationListenerStatus>
  getNotifications(limit?: number): Promise<NotificationListResult>
  openSettings(): Promise<{ opened: boolean }>
  isAvailable(): boolean
  destroy(): void
}

interface NotificationListenerStatus {
  enabled: boolean
}

interface NotificationInfo {
  packageName: string
  title: string
  text: string
  postTime: number
  category: string
  id: number
}

interface NotificationListResult {
  notifications: NotificationInfo[]
  count: number
}
```

### Native Handler

**Android**: `gyo.plugins.notification_listener.NotificationListenerBridge`. The module declares `GyoNotificationListenerService`; the user grants the app notification access in the system settings. `@gyo-framework/notification-reader` depends on it.

| Method | Input | Output |
|--------|-------|--------|
| `is_enabled` | — | `{ enabled: boolean }` |
| `get_notifications` | `{ limit }` | `{ notifications: NotificationInfo[], count: number }` |
| `open_settings` | — | `{ opened: boolean }` |

## Plugin Development Conventions

### Naming

| Scope | Usage | Example |
|-------|-------|---------|
| `@gyo-framework/` | Official | `@gyo-framework/app-launcher` |
| `@gyo-community/` | Community | `@gyo-community/analytics` |

### Structure

```
@gyo-framework/<name>/
├── package.json               # `gyo` field: the declaration below
├── src/
│   ├── index.ts               # Exported API
│   └── __tests__/
├── android/                   # Android library module (optional)
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       └── kotlin/gyo/plugins/<name>/
└── ios/                       # Swift implementation (optional)
    └── Sources/
```

### Rules

1. Must depend on `@gyo-framework/bridge` as `peerDependencies`.
2. Export a class with methods wrapping `Bridge.invoke()`.
3. Define and export all TypeScript interfaces for input/output.
4. Declare the native handler in package.json. `gyo run`, `gyo build` and `gyo install` include it and register it; no file of the app is edited by hand.

### Declaration

The `gyo` field of package.json:

| Path | Type | Required | Description |
|------|------|----------|-------------|
| `bridgeName` | string | yes | Name the web side passes to `new Bridge(name)`; an identifier |
| `android.handlerClass` | string | with `android/` | Fully qualified class implementing `BridgeHandler`; its constructor takes a `Context` |
| `android.permissions` | string[] | no | Run-time permissions the handler needs; a sync warns while the app manifest lacks them |
| `ios` | object | no | Not read |

### Android Module

| Rule | Value |
|------|-------|
| Plugins | `com.android.library`, `org.jetbrains.kotlin.android` |
| Bridge | `compileOnly(project(":gyo-bridge"))`; the app brings the module |
| Manifest | Install-time declarations only, such as `<queries>`; merged into the app's |
| Run-time permissions | Declared by the app in `android/app/src/main/AndroidManifest.xml`, never by the plugin |
| Dependencies | Declared in the module; the app gets them through it |
| Another plugin's module | `implementation(project(":gyo-plugin-<name>"))`; gyo includes every installed plugin under that name and fails when that plugin is not installed |

> See [CLI.md](./CLI.md#plugin-modules) for what a sync writes into the app.

### Publishing

There is no publish workflow. Publish a package from its directory once `npm run verify` passes.

> See `plugins/README.md` for package listing.
