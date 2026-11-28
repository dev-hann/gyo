# Plugin API Specifications

Type signatures and contracts of the JS packages: the `@gyo-framework/bridge` core and the `@gyo-community` plugins.

## @gyo-framework/bridge

Core bridge for web-native communication. Every plugin depends on it as a peer dependency.

### Exports

| Export | Kind | Role |
|--------|------|------|
| `Bridge` | class | One named channel to the native side |
| `requestPermissions` | function | Asks the user for Android run-time permissions |
| Types | interfaces and type aliases | `BridgeRequest`, `BridgeResponse`, `BridgeEvent`, `EventCallback`, `Unsubscribe`, `BridgeOptions`, `BridgeInterceptor`, `AndroidBridge`, `IOSMessageHandler`, `PermissionResult` |

```typescript
class Bridge {
  constructor(name: string, options?: BridgeOptions)
  invoke<T = unknown>(method: string, data?: unknown): Promise<T>
  listen(callback: EventCallback): Unsubscribe
  getName(): string
  isAvailable(): boolean
  destroy(): void
}

interface BridgeOptions {
  timeout?: number // default: 30000
  interceptors?: BridgeInterceptor[]
}

interface BridgeInterceptor {
  beforeInvoke?(request: BridgeRequest): BridgeRequest | Promise<BridgeRequest>
  onError?(request: BridgeRequest, error: Error): void
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

interface AndroidBridge {
  postMessage(message: string): void
}

interface IOSMessageHandler {
  postMessage(message: unknown): void
}

interface PermissionResult {
  granted: string[]
  denied: string[]
}

function requestPermissions(permissions: string[]): Promise<PermissionResult>
```

| Member | Behaviour |
|--------|-----------|
| Native object | `window.androidBridge` (Android) or `window.webkit.messageHandlers.gyoBridge` (iOS) |
| `invoke` | Posts a `BridgeRequest` and resolves with what native answers for `callbackId`. Rejects when native rejects the call, when an interceptor throws, when there is no native object, and `timeout` ms after a call native has not answered |
| `listen` | Called for every event native publishes for this bridge name; returns what removes the listener. A listener that throws does not hold up the others |
| `isAvailable` | Whether the native object is present and the bridge is not destroyed |
| `destroy` | Rejects every call native has not answered and drops the listeners and the interceptors; `invoke` rejects from then on |
| `requestPermissions` | Invokes `request` on the `permissions` bridge with `{ permissions }` and resolves once the user has answered; a permission granted before is in `granted` without a prompt. Only a permission the app declares in `android/app/src/main/AndroidManifest.xml` can be granted. Rejects outside the Android shell |

> See `bridge/src/Bridge.ts`, `bridge/src/types.ts` and `bridge/src/permissions.ts` for the full definitions.
> See [BRIDGE_INTEGRATION.md](./BRIDGE_INTEGRATION.md) for the native handler protocols and the `permissions` handler.

### `./testing` Subpath

A stand-in for the native side of the bridge, for the tests of an app. It ships with `@gyo-framework/bridge`; there is nothing to install apart from it. The real `Bridge` stays in place, so a test runs the path the app runs in the WebView.

| Export | Kind | Role |
|--------|------|------|
| `createBridgeMock` | function | Replaces the native side of the bridge called `name` |
| `setPlatform` | function | Puts the native object of a platform on `window`, recording nothing |
| `cleanupPlatform` | function | Removes from `window` every native object and what a `Bridge` installed |
| `BridgeMock` | interface | What the mock of a bridge lets a test do |
| `Platform` | type | `'android'`, `'ios'` or `'none'` |

```typescript
interface BridgeMock {
  requests(): BridgeRequest[]
  resolve(data: unknown, request?: BridgeRequest): void
  reject(message: string, request?: BridgeRequest): void
  emitEvent(data: unknown): void
  restore(): void
}

type Platform = 'android' | 'ios' | 'none'

function createBridgeMock(name: string): BridgeMock
function setPlatform(platform: Platform): void
function cleanupPlatform(): void
```

| Member | Behaviour |
|--------|-----------|
| `createBridgeMock` | Brings `window.androidBridge` itself and records every `BridgeRequest` the page posts |
| `requests()` | What was posted, oldest first |
| `resolve`, `reject` | Answer one request, the latest by default, as native answers on success and on failure |
| `emitEvent` | Publishes an event to the listeners of the bridge called `name` |
| `setPlatform` | `android`: `window.androidBridge`; `ios`: `window.webkit.messageHandlers.gyoBridge`; `none`: no native object. Each call runs `cleanupPlatform()` first |
| `restore`, `cleanupPlatform` | Delete `window.gyoBridge`, `window.androidBridge` and `window.webkit`, so that the next test gets its own |

> See `bridge/src/testing/` for the definitions.
> See [TESTING.md](./TESTING.md) for their use in a test.

## @gyo-community/accessibility

The accessibility service, and reading, finding and acting on the screen (Android). The four classes post to the one `accessibility` bridge; each creates its own `Bridge`.

### Exports

| Export | Kind | Role |
|--------|------|------|
| `Accessibility` | class | Whether the service is enabled; opens its settings |
| `ScreenReader` | class | Reads the node tree of the active window; finds the nodes that hold a text |
| `ScreenAction` | class | Tap, type, swipe and global actions |
| `ScreenFind` | class | Finds elements by text or by view ID |
| Types | interfaces | `AccessibilityStatus`, `NodeInfo`, `ReadResult`, `FindParams`, `ScreenReaderFindResult`, `TapParams`, `TypeParams`, `SwipeParams`, `GlobalActionParams`, `FindByTextParams`, `FindByIdParams`, `ElementInfo`, `ScreenFindResult` |

```typescript
class Accessibility {
  constructor()
  isEnabled(): Promise<AccessibilityStatus>
  openSettings(): Promise<{ opened: boolean }>
  isAvailable(): boolean
  destroy(): void
}

class ScreenReader {
  constructor()
  read(): Promise<ReadResult>
  find(params: FindParams): Promise<ScreenReaderFindResult>
  isAvailable(): boolean
  destroy(): void
}

class ScreenAction {
  constructor()
  tap(params: TapParams): Promise<boolean>
  type(params: TypeParams): Promise<boolean>
  swipe(params: SwipeParams): Promise<boolean>
  globalAction(params: GlobalActionParams): Promise<boolean>
  isAvailable(): boolean
  destroy(): void
}

class ScreenFind {
  constructor()
  findByText(params: FindByTextParams): Promise<ScreenFindResult>
  findById(params: FindByIdParams): Promise<ScreenFindResult>
  isAvailable(): boolean
  destroy(): void
}

interface AccessibilityStatus {
  enabled: boolean
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

interface FindParams {
  text: string
}

interface ScreenReaderFindResult {
  nodes: NodeInfo[]
  count: number
}

interface TapParams {
  x: number
  y: number
}

interface TypeParams {
  text: string
}

interface SwipeParams {
  startX: number
  startY: number
  endX: number
  endY: number
  duration: number
}

interface GlobalActionParams {
  action: string
}

interface FindByTextParams {
  text: string
  exact: boolean
}

interface FindByIdParams {
  id: string
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

interface ScreenFindResult {
  elements: ElementInfo[]
  count: number
}
```

### Native Handler

**Android**: `gyo.plugins.accessibility.AccessibilityBridge`, behind the bridge `accessibility`.

| Class | Method | Input | Output |
|-------|--------|-------|--------|
| `Accessibility` | `is_enabled` | — | `AccessibilityStatus` |
| `Accessibility` | `open_settings` | — | `{ opened: boolean }`, with `error` as well when it did not open |
| `ScreenReader` | `read` | — | `ReadResult` |
| `ScreenReader` | `find` | `FindParams` | `ScreenReaderFindResult` |
| `ScreenAction` | `tap` | `TapParams` | `boolean` |
| `ScreenAction` | `type` | `TypeParams` | `boolean` |
| `ScreenAction` | `swipe` | `SwipeParams` | `boolean` |
| `ScreenAction` | `global` | `GlobalActionParams` | `boolean` |
| `ScreenFind` | `find_by_text` | `FindByTextParams` | `ScreenFindResult` |
| `ScreenFind` | `find_by_id` | `FindByIdParams` | `ScreenFindResult` |

| Rule | Value |
|------|-------|
| `global` | `action` is one of the names below, matched without regard to case; any other name returns `false` |
| `swipe` | `duration` in milliseconds, 300 by default |
| `find` | The nodes of the active window that hold `text`, each with its children |
| `find_by_text` | With `exact`, only the nodes whose text is `text` |
| `find_by_id` | The nodes with the view resource ID `id` |
| `tap`, `swipe` | `false` for a negative coordinate |

| `action` | Android global action |
|----------|-----------------------|
| `back` | `GLOBAL_ACTION_BACK` |
| `home` | `GLOBAL_ACTION_HOME` |
| `recents` | `GLOBAL_ACTION_RECENTS` |
| `notifications` | `GLOBAL_ACTION_NOTIFICATIONS` |
| `quick_settings` | `GLOBAL_ACTION_QUICK_SETTINGS` |
| `power_dialog` | `GLOBAL_ACTION_POWER_DIALOG` |

### Setup

| Item | Value |
|------|-------|
| Permissions | None |
| Service | `GyoAccessibilityService`, declared by the module's manifest with its configuration. The user enables it under Settings, Accessibility; `Accessibility.openSettings()` opens that screen |
| Until the service is enabled | `is_enabled` answers `{ enabled: false }`; `read` a `null` root with an empty `windowName` and `packageName`; `find`, `find_by_text` and `find_by_id` an empty result; `tap`, `type`, `swipe` and `global` `false` |

## @gyo-community/app-launcher

App launching and URL opening through Android's `PackageManager`, and installing an APK with the system's installer (Android).

### Exports

| Export | Kind | Role |
|--------|------|------|
| `AppLauncher` | class | Lists, opens and searches the apps; opens a URL |
| `ApkInstaller` | class | Installs an APK with the system's installer |
| Types | interfaces | `AppInfo`, `ListAppsResult`, `OpenAppParams`, `OpenUrlParams`, `SearchAppsParams`, `SearchAppsResult`, `InstallApkParams` |

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

class ApkInstaller {
  constructor()
  canInstall(): Promise<boolean>
  openInstallSettings(): Promise<boolean>
  install(params: InstallApkParams): Promise<boolean>
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

interface InstallApkParams {
  // An absolute path, in the cache of the app
  path: string
}
```

### Native Handler

**Android**: `gyo.plugins.app_launcher.AppLauncherBridge`, behind the bridge `app_launcher`.

| Class | Method | Input | Output |
|-------|--------|-------|--------|
| `AppLauncher` | `list_apps` | — | `ListAppsResult` |
| `AppLauncher` | `open_app` | `OpenAppParams` | `boolean` |
| `AppLauncher` | `open_url` | `OpenUrlParams` | `boolean` |
| `AppLauncher` | `search_apps` | `SearchAppsParams` | `SearchAppsResult` |
| `ApkInstaller` | `can_install_apk` | — | `boolean` |
| `ApkInstaller` | `open_install_settings` | — | `boolean` |
| `ApkInstaller` | `install_apk` | `InstallApkParams` | `boolean` |

| Rule | Value |
|------|-------|
| `list_apps` | Every app with a launcher icon, found through the launcher intent and through the installed list |
| `search_apps` | The launchable apps whose name or package name contains `query`, matched without regard to case; all of them for an empty `query` |
| `open_app` | `false` for an empty `packageName`, for an app without a launch intent, and when the app cannot be started |
| `open_url` | `Intent.ACTION_VIEW`, answered by the app that takes the URL; `false` for an empty `url` and when no app can take it |
| `can_install_apk` | `true` before Android 8; from then on whether the reader allowed this app to install APKs |
| `open_install_settings` | The settings where the app is allowed to install APKs (`ACTION_MANAGE_UNKNOWN_APP_SOURCES`); `false` when they cannot be started |
| `install_apk` | Throws when there is no file at `path`. Else the file is copied into `apk_install/` in the cache and handed to the system's installer through the module's `FileProvider`: `Intent.ACTION_VIEW` with `application/vnd.android.package-archive`. `true` once the installer was started; what the reader does there is not reported |

### Setup

| Item | Value |
|------|-------|
| Permissions | `REQUEST_INSTALL_PACKAGES`, which `install_apk` needs from Android 8 on: declared by the app, allowed by the reader in the settings |
| Manifest | The module declares a `<queries>` element for the apps with a launcher icon, which makes them visible on Android 11 and later, and a `FileProvider` (`gyo.plugins.app_launcher.ApkFileProvider`, authority `${applicationId}.gyo.app_launcher`) that hands out `apk_install/` in the cache and nothing else; the build merges both into the app's manifest |
| Dependencies | The module brings `androidx.core:core-ktx:1.17.0`, for the provider |

## @gyo-community/communication

Contacts search, SMS send and read, calls and the call log (Android). The three classes post to the one `communication` bridge; each creates its own `Bridge`.

### Exports

| Export | Kind | Role |
|--------|------|------|
| `ContactSearch` | class | Searches contacts by name |
| `SmsSender` | class | Sends an SMS; reads the inbox |
| `PhoneCaller` | class | Places a call; reads the call log |
| Types | interfaces | `ContactInfo`, `SearchParams`, `SearchResult`, `SendParams`, `ReadParams`, `SmsMessage`, `ReadResult`, `CallParams`, `GetCallLogParams`, `CallLogEntry`, `CallLogResult` |

```typescript
class ContactSearch {
  constructor()
  search(params: { query: string }): Promise<SearchResult>
  isAvailable(): boolean
  destroy(): void
}

class SmsSender {
  constructor()
  send(params: { phoneNumber: string; message: string }): Promise<boolean>
  read(params: { limit: number }): Promise<ReadResult>
  isAvailable(): boolean
  destroy(): void
}

class PhoneCaller {
  constructor()
  call(params: { phoneNumber: string }): Promise<boolean>
  getCallLog(params: { limit: number }): Promise<CallLogResult>
  isAvailable(): boolean
  destroy(): void
}

interface ContactInfo {
  id: string
  name: string
  phoneNumbers: string[]
  emails: string[]
}

interface SearchParams {
  query: string
}

interface SearchResult {
  contacts: ContactInfo[]
  count: number
}

interface SendParams {
  phoneNumber: string
  message: string
}

interface ReadParams {
  limit: number
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

interface CallParams {
  phoneNumber: string
}

interface GetCallLogParams {
  limit: number
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

**Android**: `gyo.plugins.communication.CommunicationBridge`, behind the bridge `communication`. Every method answers with a result, also when a permission is missing: nothing is thrown to the web side.

| Class | Method | Input | Output |
|-------|--------|-------|--------|
| `ContactSearch` | `search` | `SearchParams` | `SearchResult` |
| `SmsSender` | `send` | `SendParams` | `boolean` |
| `SmsSender` | `read` | `ReadParams` | `ReadResult` |
| `PhoneCaller` | `call` | `CallParams` | `boolean` |
| `PhoneCaller` | `get_call_log` | `GetCallLogParams` | `CallLogResult` |

| Rule | Value |
|------|-------|
| `search` | The contacts whose display name contains `query`, in the order of the display name; an empty result for an empty `query` |
| `send` | `false` for an empty `phoneNumber` or `message` |
| `read` | The SMS inbox, the newest first; `limit` between 1 and 100, 10 by default. `type` is `inbox`, `sent`, `draft`, `outbox`, `failed` or `queued`, else `unknown` |
| `call` | `Intent.ACTION_CALL`, which places the call at once; `false` for an empty `phoneNumber` |
| `get_call_log` | The call log, the newest first; `limit` 20 by default. `type` is `INCOMING`, `OUTGOING`, `MISSED`, `REJECTED`, `BLOCKED`, else `UNKNOWN` |

### Setup

| Item | Value |
|------|-------|
| Permissions | Declared by the app in `android/app/src/main/AndroidManifest.xml`: `android.permission.READ_CONTACTS`, `android.permission.SEND_SMS`, `android.permission.READ_SMS`, `android.permission.CALL_PHONE`, `android.permission.READ_CALL_LOG` |
| Run time | The system asks the user, once the app calls `requestPermissions()` of `@gyo-framework/bridge` |
| Services | None; the module's manifest is empty |
| Hard-restricted | `READ_SMS`, `SEND_SMS` and `READ_CALL_LOG`: an app holds them only once its installer allowlists them; asking the user at run time does not change that |

| Class | Permissions | Without them |
|-------|-------------|--------------|
| `ContactSearch` | `READ_CONTACTS` | `search` answers an empty result |
| `SmsSender` | `SEND_SMS`, `READ_SMS` | `send` answers `false`; `read` an empty result |
| `PhoneCaller` | `CALL_PHONE`, `READ_CALL_LOG` | `call` answers `false`; `getCallLog` an empty result |

## @gyo-community/device-info

Device metadata, and what Android has of the app itself (Android).

### Exports

| Export | Kind | Role |
|--------|------|------|
| `DeviceInfo` | class | Reads the device information |
| `PackageInfo` | class | Reads the installed app: its package name, its name and its version |
| `GetInfoResult` | interface | What `getInfo()` resolves with |
| `PackageInfoResult` | interface | What `PackageInfo.getInfo()` resolves with |
| `DeviceInfoType` | interface | The information itself; exported under this name because the class has the name `DeviceInfo` |

```typescript
class DeviceInfo {
  constructor()
  getInfo(): Promise<GetInfoResult>
  isAvailable(): boolean
  destroy(): void
}

class PackageInfo {
  constructor()
  getInfo(): Promise<PackageInfoResult>
  isAvailable(): boolean
  destroy(): void
}

interface DeviceInfoType {
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
  info: DeviceInfoType
}

interface PackageInfoResult {
  // The application ID: `com.example.app`
  packageName: string
  // The name under the app's icon
  appName: string
  // What people read, the `versionName` of the build: `1.2.0`
  versionName: string
  // What an update is decided on, the `versionCode` of the build: a newer build has a larger one
  versionCode: number
}
```

### Native Handler

**Android**: `gyo.plugins.device_info.DeviceInfoBridge`, behind the bridge `device_info`.

| Class | Method | Input | Output |
|-------|--------|-------|--------|
| `DeviceInfo` | `get_info` | — | `GetInfoResult` |
| `PackageInfo` | `get_package_info` | — | `PackageInfoResult` |

| Field | Source |
|-------|--------|
| `manufacturer`, `model`, `brand`, `device`, `androidVersion`, `sdkVersion`, `securityPatch` | `android.os.Build` |
| `screenDensity` | The density of the display in dpi |
| `screenWidth`, `screenHeight` | The window in pixels on Android 11 and later; the real display before |
| `batteryLevel`, `isCharging` | `BatteryManager`; charging or full |
| A string the device does not provide | `"Unknown"` |
| `PackageInfoResult.packageName`, `appName` | The app itself: its application ID and its label |
| `PackageInfoResult.versionName`, `versionCode` | What the build put in; gyo writes them from `version` and `platforms.android.versionCode` of `gyo.config.json` |

### Setup

| Item | Value |
|------|-------|
| Permissions | None |
| Services | None; the module's manifest is empty |

## @gyo-community/http

GET requests that run outside the WebView, with the headers the caller chooses (Android). The WebView cannot make them itself: CORS hides cross-origin responses, and many servers answer a WebView's own user agent or a foreign `Referer` with a redirect or a 403.

### Exports

| Export | Kind | Role |
|--------|------|------|
| `Http` | class | Makes a request |
| `Downloader` | class | Downloads a file into the cache of the app, telling the page how far it is |
| `DownloadCancelledError` | class | Why `DownloadTask.result` rejected when the page cancelled the download |
| `DownloadTask` | interface | What a `download()` returns: the file once it is whole, and the way to stop wanting it |
| `decodeText` | function | Decodes the body of a response |
| `base64ToBytes` | function | The body of a response as bytes |
| Types | interfaces | `HttpRequest`, `HttpResponse`, `DownloadRequest`, `DownloadProgress`, `DownloadResult`, `DownloadOptions` |

```typescript
class Http {
  constructor()
  request(request: HttpRequest): Promise<HttpResponse>
  isAvailable(): boolean
  destroy(): void
}

class Downloader {
  constructor()
  download(request: DownloadRequest, options?: DownloadOptions): DownloadTask
  isAvailable(): boolean
  destroy(): void
}

interface HttpRequest {
  url: string
  // Sent as given: `User-Agent` and `Referer` included
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

interface DownloadRequest {
  url: string
  // Sent as given
  headers?: Record<string, string>
  // The name of the file in the app's cache; when left out, the last part of the address the server
  // answered from, once redirects were followed
  fileName?: string
}

interface DownloadOptions {
  // Called as bytes arrive with the progress of the download; not called once it has ended
  onProgress?: (progress: DownloadProgress) => void
}

interface DownloadTask {
  // The file once it is whole; rejects when the download fails, and with a `DownloadCancelledError` when it was cancelled
  result: Promise<DownloadResult>
  cancel(): void
}

interface DownloadProgress {
  bytesWritten: number
  // The bytes the server announced; -1 when it did not
  totalBytes: number
}

interface DownloadResult {
  // An absolute path, in the app's cache
  path: string
  bytesWritten: number
  // The status the server answered, once redirects were followed
  status: number
  // Where the file came from, once redirects were followed
  url: string
  // Response headers by lower-case name
  headers: Record<string, string>
}

function decodeText(response: HttpResponse, encoding?: string): string
function base64ToBytes(base64: string): Uint8Array
```

| Rule | Value |
|------|-------|
| Method | GET; redirects are followed |
| Resolves | With whatever status the server answered, 404 and 503 included |
| Rejects | When no response arrived at all, such as a timeout or a connection that could not be made |
| Timeouts | The call rejects on its own after 60 seconds; native gives up after 15 seconds without a connection or 20 seconds without data |
| `decodeText` | Decodes with the page's `TextDecoder`; `encoding` is `utf-8` by default; malformed bytes become U+FFFD |
| `bodyBase64` | The raw body; decoding is left to the caller, who knows the charset |
| `Downloader.download` | GET; redirects are followed; the body is streamed to a file, so nothing is held in memory |
| `DownloadTask.result` | Resolves once the file is whole. Rejects when the server answers anything but 2xx, when no response arrived, when the file could not be written, and with a `DownloadCancelledError` when `cancel()` ended it |
| `DownloadTask.cancel` | Ends a download that runs; one that ended already is left as it is |
| Progress | `onProgress` is called for the events of this download only; the first says 0 bytes, the last how many there are |
| Where the file is | `downloads/<fileName>` in the cache of the app, a private place that needs no permission; a file there older than a day is deleted at the next download. A file that did not arrive whole is deleted. Left out, the name is the last part of the address the server answered from once redirects were followed: GitHub sends a release asset to an address that ends in an id, so a page that wants the asset's own name passes `fileName` |
| Timeout | The call rejects after 10 minutes; native gives up after 15 seconds without a connection or 20 seconds without data |

### Native Handler

**Android**: `gyo.plugins.http.HttpBridge`, behind the bridge `http`.

| Class | Method | Input | Output |
|-------|--------|-------|--------|
| `Http` | `request` | `HttpRequest` | `HttpResponse` |
| `Downloader` | `download` | `DownloadRequest` and a `downloadId` of the class | `DownloadResult` |
| `Downloader` | `cancel_download` | `{ downloadId }` | — |

While `download` runs it publishes the event `{ type: "progress", downloadId, bytesWritten, totalBytes }` for the page, at most every 250 ms and always for the first and the last.

Any other method throws, so the call rejects.

### Setup

| Item | Value |
|------|-------|
| Permissions | None beyond `INTERNET`, which the manifest of a generated app declares |
| Services | None; the module's manifest is empty |
| Files | `downloads/` in the cache of the app |
| Dependencies | The module brings `com.squareup.okhttp3:okhttp:4.12.0` |

## @gyo-community/media

Saving images and videos to the device, and sharing media and text with other apps (Android). The WebView can do neither itself: a page cannot read the bytes of the image it shows, and the Web Share API does not exist there.

### Exports

| Export | Kind | Role |
|--------|------|------|
| `Media` | class | Saves a file to the gallery; shares a file or a text |
| Types | interfaces and type aliases | `SaveRequest`, `ShareRequest`, `MediaFailure`, `MediaFailureKind`, `SavedResult`, `SharedResult`, `FailedResult`, `SaveResult`, `ShareResult` |

```typescript
class Media {
  constructor()
  saveToGallery(request: SaveRequest): Promise<SaveResult>
  share(request: ShareRequest): Promise<ShareResult>
  isAvailable(): boolean
  destroy(): void
}

interface SaveRequest {
  url: string
  // As the server names it; null when it does not
  mimeType?: string | null
  // File name without a path; made up from the url when missing
  filename?: string
  // The user agent the download is made with. Send the page's own: sites block unknown clients
  userAgent?: string
  // Folder inside Pictures, Movies or Downloads
  folder?: string
}

type ShareRequest = SaveRequest | { text: string }

interface MediaFailure {
  kind: MediaFailureKind
  message: string
}

type MediaFailureKind = 'network' | 'unsupported' | 'permission' | 'storage' | 'canceled'

interface SavedResult {
  status: 'saved'
  // The content uri of the stored file
  uri: string
  // The MIME type the file was stored under
  mimeType: string
}

interface SharedResult {
  status: 'shared'
}

interface FailedResult {
  status: 'failed'
  error: MediaFailure
}

type SaveResult = SavedResult | FailedResult
type ShareResult = SharedResult | FailedResult
```

| Rule | Value |
|------|-------|
| Method | GET; redirects are followed |
| Resolves | With what native answers: `saved`, `shared` or `failed`. A failure is a value, never a rejection |
| Rejects | Only for a fault of the bridge itself: no native object, a timeout, an unknown method |
| Timeouts | The call rejects on its own after 5 minutes; native gives up after 15 seconds without a connection or 30 seconds without data |
| `share` | Resolves once the chooser is open. What the user does there is not reported, and `canceled` is not answered |
| `share` with `text` | Shared as `text/plain`, in place of a `url` |
| Release build | Plain `http` is refused, as it is everywhere in a release build but to `localhost` and `10.0.2.2`: `network`, with the message of the system |

### Native Handler

**Android**: `gyo.plugins.media.MediaBridge`, behind the bridge `media`.

| Class | Method | Input | Output |
|-------|--------|-------|--------|
| `Media` | `save_to_gallery` | `SaveRequest` | `SaveResult` |
| `Media` | `share` | `ShareRequest` | `ShareResult` |

Any other method throws, so the call rejects.

| Step | Rule |
|------|-------|
| MIME type | The server's `Content-Type`. When it is missing or `application/octet-stream`: the request's `mimeType`, then the extension of the final url, then `application/octet-stream` |
| File name | The request's `filename`, else the last segment of the final url. Without a path, without a character a file name cannot hold, and ending in an extension the system knows |
| Folder | The request's `folder` as a path of safe names: a leading separator and `..` do not survive |
| Destination | `image/*` to `Pictures/<folder>`, `video/*` to `Movies/<folder>`, the rest to `Download/<folder>` |
| Android 10 and later | Through `MediaStore`, one save at a time: an entry written as pending and published once the last byte is written. No permission |
| Before Android 10 | The public folder of the same name, then the media scanner. `WRITE_EXTERNAL_STORAGE` |
| Cache | A download is written to the cache before it is stored or shared: `cache/save` while a save lasts, `cache/share` for a share. A save needs room there for the file. Files older than a day are deleted at the next call |
| Share | The file is offered from `cache/share` with `ACTION_SEND` through a `FileProvider` |

| Kind | When |
|------|------|
| `network` | The server could not be reached or timed out, answered outside 2xx, or sent an empty body |
| `unsupported` | No `url`; an address that is not `http` or `https`, such as a `blob:` url; a web page (`text/html`) in place of a file; a file the media store refuses |
| `permission` | Before Android 10 only: `WRITE_EXTERNAL_STORAGE` is not granted |
| `storage` | The file could not be written. Also when the media store refuses a file, which it does now and then when more than a few dozen of one name are stored in a folder within a second |
| `canceled` | Never on Android |

### Setup

| Item | Value |
|------|-------|
| Permissions | None from Android 10 on. Before: `android.permission.WRITE_EXTERNAL_STORAGE`, declared by the app in `android/app/src/main/AndroidManifest.xml` with `android:maxSdkVersion="28"` and asked for with `requestPermissions()`; `save_to_gallery` answers `permission` until it is granted |
| Provider | A `FileProvider` for `<applicationId>.gyo.media`, declared by the module's manifest. It grants `cache/share` and nothing else |
| Dependencies | The module brings `com.squareup.okhttp3:okhttp:4.12.0` and `androidx.core:core-ktx:1.17.0` |

## @gyo-community/notifications

The notification listener service, and the active notifications read through it (Android). The two classes post to the one `notifications` bridge; each creates its own `Bridge`.

### Exports

| Export | Kind | Role |
|--------|------|------|
| `NotificationListener` | class | Whether notification access is granted; the most recent notifications; opens the settings |
| `NotificationReader` | class | Lists the active notifications |
| Types | interfaces | `NotificationListenerStatus`, `NotificationInfo`, `NotificationListResult`, `ListResult` |

```typescript
class NotificationListener {
  constructor()
  isEnabled(): Promise<NotificationListenerStatus>
  getNotifications(limit?: number): Promise<NotificationListResult>
  openSettings(): Promise<{ opened: boolean }>
  isAvailable(): boolean
  destroy(): void
}

class NotificationReader {
  constructor()
  list(): Promise<ListResult>
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

interface ListResult {
  notifications: NotificationInfo[]
  count: number
}
```

### Native Handler

**Android**: `gyo.plugins.notifications.NotificationsBridge`, behind the bridge `notifications`.

| Class | Method | Input | Output |
|-------|--------|-------|--------|
| `NotificationListener` | `is_enabled` | — | `NotificationListenerStatus` |
| `NotificationListener` | `get_notifications` | `{ limit }` | `NotificationListResult` |
| `NotificationListener` | `open_settings` | — | `{ opened: boolean }`, with `error` as well when it did not open |
| `NotificationReader` | `list` | — | `ListResult` |

| Rule | Value |
|------|-------|
| Order | The active notifications, the newest first |
| `limit` | 50 by default for `get_notifications`, 20 for `list`; kept between 1 and 200 |
| `text` | The expanded text when there is one, else the text |
| `id` | The id the posting app gave the notification |

### Setup

| Item | Value |
|------|-------|
| Permissions | None |
| Service | `GyoNotificationListenerService`, declared by the module's manifest. The user grants the app notification access under Settings, Notifications; `NotificationListener.openSettings()` opens that screen |
| Until access is granted | `is_enabled` answers `{ enabled: false }`; `get_notifications` and `list` an empty result |

## Plugin Development Conventions

The framework is what the shell cannot run without, `cli` and `bridge`, under `@gyo-framework/`. Every add-on feature is a community plugin under `@gyo-community/`.

### Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Scope `@gyo-framework/` | The core | `@gyo-framework/bridge` |
| Scope `@gyo-community/` | Plugins, one package per feature | `@gyo-community/app-launcher` |
| Directory | `plugins/<name>/` | `plugins/app-launcher/` |
| Bridge name | `<name>` with hyphens as underscores; an identifier | `app_launcher` |
| Android package | `gyo.plugins.<name>` with hyphens as underscores | `gyo.plugins.app_launcher` |
| Handler class | `<Name>` in Pascal case and `Bridge` | `AppLauncherBridge` |
| Gradle project | `:gyo-plugin-<name>`, as gyo includes the module | `:gyo-plugin-app-launcher` |

### Structure

```
plugins/<name>/                 # @gyo-community/<name>
├── package.json                # The `gyo` field: the declaration below
├── src/
│   ├── index.ts                # Exported API
│   ├── types.ts                # Input and output interfaces
│   ├── <Class>.ts              # One per exported class
│   └── __tests__/
├── android/                    # Android library module (optional)
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── kotlin/gyo/plugins/<name>/
│       │   ├── <Name>Bridge.kt # The one handler
│       │   └── ...             # What only the handler needs
│       └── res/                # Strings and configurations the manifest names (optional)
└── ios/                        # Swift implementation (optional)
    └── Sources/
```

### Rules

1. Depends on `@gyo-framework/bridge` as a `peerDependency`, and on the same version as a `devDependency` for its tests.
2. Exports one class per ability. Each creates its own `Bridge` under the bridge name of the package, wraps `Bridge.invoke()` and has `isAvailable()` and `destroy()`.
3. Defines and exports the TypeScript interfaces of every input and output.
4. Declares the native handler in the `gyo` field of package.json. `gyo run`, `gyo build` and `gyo install` include it and register it; no file of the app is edited by hand.
5. One bridge and one handler class per plugin: the classes of a package post to the same bridge name, answered by the same class.
6. No dependency on the module of another plugin: the module brings everything its handler needs.
7. In the repository: a workspace of the root `package.json`, under `plugins/<name>/`, and listed in `plugins/README.md`.
8. The npm package ships `dist/` and `android/` (`files`): gyo includes the module from where `node_modules` keeps the package.
9. A handler that tells the page something outside of a call publishes an event, for its own bridge: it takes the way in `attachEvents(publish)`, which it may call from any thread. The event carries what tells the classes of the package whose it is, such as a `downloadId`.

### Declaration

| Rule | Value |
|------|-------|
| Where | Installed in `lib/node_modules/` under `@gyo-community/` or `@gyo-framework/`, as a directory or a symlink |
| What makes it a plugin | The `gyo` field of its package.json; a package without it is skipped |
| Android module | Included when `android/src/` exists and `android.handlerClass` is declared; it needs `android/build.gradle.kts` or `android/build.gradle`, or the sync fails |
| Gradle project | `:gyo-plugin-<name>`; two plugins with the same `<name>` fail the sync |

The `gyo` field of package.json:

| Path | Type | Required | Description |
|------|------|----------|-------------|
| `bridgeName` | string | yes | An identifier (`[A-Za-z_][A-Za-z0-9_]*`): the name the web side passes to `new Bridge(name)` |
| `android.handlerClass` | string | with `android/` | Fully qualified class implementing `BridgeHandler`; its constructor takes a `Context` |
| `android.permissions` | string[] | no | Run-time permissions the handler needs (`android.permission.<NAME>`); a sync warns while the app manifest lacks them. They are never written into the app |
| `ios` | object | no | Not read |

### Android Module

| Rule | Value |
|------|-------|
| Plugins | `com.android.library`; Kotlin comes built into the Android Gradle Plugin |
| Sources | `src/main/kotlin/`, declared as a source directory of `main` |
| Bridge | `compileOnly(project(":gyo-bridge"))`; the app brings the module |
| Handler | One class implementing `BridgeHandler`, taking a `Context` in its constructor; `PluginRegistry.kt` registers it under the `bridgeName` |
| Manifest | Install-time declarations only, such as `<queries>`, services and providers; merged into the app's |
| Run-time permissions | Declared by the app in `android/app/src/main/AndroidManifest.xml`, never by the plugin |
| Dependencies | Declared in the module; the app gets them through it |
| Another plugin's module | Not depended on. gyo includes every installed plugin as `:gyo-plugin-<name>` and fails the sync when a module names one that is not installed |
| Events | `BridgeHandler.attachEvents(publish)` gives the handler the way to publish an event to the page for its bridge, and takes it away with `null` while no WebView serves the bridge. Android only |
| Provider of a module | Under a class of its own (`class XFileProvider : FileProvider()`): the manifest merger tells providers apart by class, so two modules that name `FileProvider` clash |

> See [CLI.md](./CLI.md#plugin-modules) for what a sync writes into the app.
> See [BRIDGE_INTEGRATION.md](./BRIDGE_INTEGRATION.md) for `BridgeHandler`.

### Publishing

There is no publish workflow. Publish a package from its directory once `npm run verify` passes: `npm publish` builds and type-checks it first (`prepublishOnly`), with public access (`publishConfig`).

> See [plugins/README.md](../plugins/README.md) for the package index.
