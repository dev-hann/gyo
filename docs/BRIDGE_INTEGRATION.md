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

## Android (Kotlin)

### Handler Interface

```kotlin
interface BridgeHandler {
    fun handle(method: String, data: JSONObject): Any?
}
```

> See `plugins/bridge/android/src/main/kotlin/gyo/plugins/bridge/BridgeHandler.kt`

### Registry

```kotlin
BridgeRegistry.register(name: String, handler: BridgeHandler)
```

> See `plugins/bridge/android/src/main/kotlin/gyo/plugins/bridge/BridgeRegistry.kt`

### AndroidBridgeInterface

Receives messages from WebView via `@JavascriptInterface`, dispatches to registered handlers.

> See `plugins/bridge/android/src/main/kotlin/gyo/plugins/bridge/AndroidBridgeInterface.kt`

### Setup

```kotlin
val bridgeInterface = AndroidBridgeInterface(webView)
webView.addJavascriptInterface(bridgeInterface, "androidBridge")
```

## iOS (Swift)

### Handler Protocol

```swift
protocol BridgeHandler {
    func handle(method: String, data: [String: Any]) throws -> Any?
}
```

> See `plugins/bridge/ios/Sources/GyoBridge/BridgeHandler.swift`

### Registry

```swift
BridgeRegistry.shared.register(name: String, handler: BridgeHandler)
```

> See `plugins/bridge/ios/Sources/GyoBridge/BridgeRegistry.swift`

### IOSBridgeInterface

WKWebView script message handler that dispatches to registered handlers.

> See `plugins/bridge/ios/Sources/GyoBridge/IOSBridgeInterface.swift`

### Setup

```swift
let bridgeInterface = IOSBridgeInterface(webView: webView)
webView.configuration.userContentController.add(bridgeInterface, name: "gyoBridge")
```
