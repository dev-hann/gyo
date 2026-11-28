# Bridge Native Integration

Specifications for integrating the bridge system on native platforms.

## Message Protocol

### Web → Native (Request)

```json
{
  "bridgeName": "string",
  "methodName": "string",
  "data": "unknown",
  "callbackId": "string"
}
```

### Native → Web (Response)

```javascript
window.gyoBridge.resolve(callbackId: string, data: unknown): void
window.gyoBridge.reject(callbackId: string, error: string): void
```

### Native → Web (Event)

```javascript
window.gyoBridge.publish(bridgeName: string, data: unknown): void
```

### Encoding

| Embedded value | Encoding |
|----------------|----------|
| `callbackId`, `bridgeName`, `error` | JSON string literal |
| `data` | JSON value |

A quote, a backslash or a newline inside an embedded value must not break the statement.

## Android (Kotlin)

### Handler Interface

```kotlin
interface BridgeHandler {
    fun handle(method: String, data: JSONObject): Any?
    fun handleAsync(method: String, data: JSONObject, call: PendingCall): Boolean
    fun attachEvents(publish: ((data: Any?) -> Unit)?)
}

interface PendingCall {
    fun resolve(result: Any?)
    fun reject(message: String)
}

interface BridgeEventSink {
    fun publish(bridgeName: String, data: Any?)
}
```

| Rule | Value |
|------|-------|
| `handle` | Returns what the web side receives; a thrown exception rejects the call |
| `handleAsync` | For a call answered later, such as one that waits for the user; answers `call` once, from any thread; returns false for a method it does not take |
| `attachEvents` | Gives the handler the way to publish an event to the page for its bridge, to call from any thread; `null` takes it away while no WebView serves the bridge |
| Return value | Object, array, string, number, boolean or null |
| Thread | Off the main thread; a slow handler does not hold up the others |

> See `cli/templates/android/gyo-bridge/src/main/java/gyo/plugins/bridge/BridgeHandler.kt`

### Module

The bridge is the `gyo-bridge` Gradle module of the generated Android project. The app depends on it; plugins compile against it with `compileOnly(project(":gyo-bridge"))`.

### Registry

```kotlin
BridgeRegistry.register(name: String, handler: BridgeHandler)
BridgeRegistry.attach(sink: BridgeEventSink)
BridgeRegistry.detach(sink: BridgeEventSink)
```

The handlers of installed plugins are registered by `PluginRegistry.kt` in the app module, which gyo writes.

| Rule | Value |
|------|-------|
| `attach` | The bridge of a WebView tells the registry that it serves the bridge now; every registered handler is given the way to publish to that WebView, and a handler registered later is given it on registration |
| `detach` | The WebView no longer serves the bridge: every handler loses the way. Another WebView's attach is not undone by it |
| An event | Published for one bridge name; the page receives it in the listeners of the `Bridge` of that name |

> See `cli/templates/android/gyo-bridge/src/main/java/gyo/plugins/bridge/BridgeRegistry.kt`
> See [CLI.md](./CLI.md#plugin-modules) for `PluginRegistry.kt`.

### Shell Handler

| Bridge | Method | Input | Output |
|--------|--------|-------|--------|
| `permissions` | `request` | `{ permissions: string[] }` | `{ granted: string[], denied: string[] }` |

The app's `MainActivity` registers it in every project. Only a permission the app declares in its manifest can be granted; for any other the system denies the request without prompting.

> See `cli/templates/android/gyo-bridge/src/main/java/gyo/plugins/bridge/PermissionBridge.kt`
> See `bridge/src/permissions.ts` for `requestPermissions()` on the web side.

### Scripts

> See `cli/templates/android/gyo-bridge/src/main/java/gyo/plugins/bridge/BridgeScripts.kt`

### Origin Restriction

| WebView | Rule |
|---------|------|
| With `WEB_MESSAGE_LISTENER` | Registered with `WebViewCompat.addWebMessageListener` for the origin of `serverUrl`; Android never injects it into a frame of another origin, iframe included |
| Without | `addJavascriptInterface`, and the host of the main frame is checked; a third-party iframe passes that check |

Navigation to another origin is cancelled and opened outside the WebView.

### Release Builds

Release builds minify with R8. The `@JavascriptInterface` methods of the fallback are kept by name.

> See `cli/templates/android/app/proguard-rules.pro`

### AndroidBridgeInterface

Receives messages from the WebView, dispatches them to registered handlers and answers on the main thread. It is the `BridgeEventSink` the registry knows: it attaches itself when made, and the app's `MainActivity` detaches it in `onDestroy`.

> See `cli/templates/android/gyo-bridge/src/main/java/gyo/plugins/bridge/AndroidBridgeInterface.kt`

### Setup

```kotlin
val bridgeInterface = AndroidBridgeInterface(webView)
WebViewCompat.addWebMessageListener(webView, "androidBridge", setOf(originRule), bridgeInterface)
```

## iOS (Swift)

### Handler Protocol

```swift
protocol BridgeHandler {
    func handle(method: String, data: [String: Any]) throws -> Any?
}
```

> See `cli/templates/ios/Sources/GyoBridge/BridgeHandler.swift`

### Registry

```swift
BridgeRegistry.shared.register(name: String, handler: BridgeHandler)
```

> See `cli/templates/ios/Sources/GyoBridge/BridgeRegistry.swift`

### IOSBridgeInterface

Dispatches messages to registered handlers and answers the web side.

> See `cli/templates/ios/Sources/GyoBridge/IOSBridgeInterface.swift`

### Origin Restriction

`WebViewController` is the script message handler: it rejects a message whose frame is not the origin of `serverUrl`, then hands it to `IOSBridgeInterface`.

### Setup

```swift
contentController.add(self, name: "gyoBridge")
bridgeInterface = IOSBridgeInterface(webView: webView)
```

> See `cli/templates/ios/Sources/WebViewContainer.swift`
