# Creating Plugins

## 필수 구조

```
@gyo-framework/plugin-name/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts
├── android/
│   ├── build.gradle.kts
│   └── src/main/kotlin/com/gyo/plugin/PluginBridge.kt
├── ios/
│   ├── Package.swift
│   └── Sources/PluginBridge.swift
└── examples/
    └── demo/
```

## package.json

```json
{
  "name": "@gyo-framework/plugin-name",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@gyo-framework/bridge": "^0.1.0"
  },
  "scripts": {
    "build": "tsc"
  }
}
```

## Web API (src/index.ts)

```typescript
import { Bridge } from '@gyo-framework/bridge'

export interface Options { key?: string }
export interface Result { success: boolean; data?: string; error?: string }

class Plugin {
  private bridge = new Bridge('@gyo-framework/plugin-name')

  async doSomething(options?: Options): Promise<Result> {
    try {
      return await this.bridge.call('doSomething', options || {}) as Result
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown' }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.bridge.call('isAvailable')
      return true
    } catch { return false }
  }
}

export default new Plugin()
```

## Android (Kotlin)

**build.gradle.kts:**
```kotlin
plugins {
  id("com.android.library")
  id("kotlin-android")
}

android {
  namespace = "com.gyo.plugin"
  compileSdk = 34
  defaultConfig { minSdk = 24 }
}

dependencies {
  implementation("com.google.code.gson:gson:2.10.1")
}
```

**PluginBridge.kt:**
```kotlin
package com.gyo.plugin

import android.content.Context
import com.google.gson.JsonObject
import gyo.plugins.bridge.BridgeInterface
import gyo.plugins.bridge.BridgeResponse

class PluginBridge(private val context: Context) : BridgeInterface {
    override val name = "@gyo-framework/plugin-name"

    override fun handleCall(method: String, params: JsonObject?): BridgeResponse {
        return when (method) {
            "doSomething" -> BridgeResponse.success(mapOf("success" to true, "data" to "result"))
            "isAvailable" -> BridgeResponse.success(mapOf("available" to true))
            else -> BridgeResponse.error("Unknown method: $method")
        }
    }
}
```

**등록 (MainActivity.kt):**
```kotlin
BridgeRegistry.register("@gyo-framework/plugin-name", PluginBridge(this))
```

## iOS (Swift)

**Package.swift:**
```swift
let package = Package(
    name: "PluginBridge",
    platforms: [.iOS(.v13)],
    products: [.library(name: "PluginBridge", targets: ["PluginBridge"])],
    dependencies: [
        .package(url: "https://github.com/dev-hann/gyo.git", from: "0.1.0")
    ],
    targets: [
        .target(name: "PluginBridge", dependencies: ["GyoBridge"], path: "Sources")
    ]
)
```

**PluginBridge.swift:**
```swift
import Foundation
import GyoBridge

public class PluginBridge: BridgeInterface {
    public let name = "@gyo-framework/plugin-name"
    public init() {}

    public func handleCall(method: String, params: [String: Any]?) async -> BridgeResponse {
        switch method {
        case "doSomething":
            return .success(["success": true, "data": "result"])
        case "isAvailable":
            return .success(["available": true])
        default:
            return .error("Unknown method: \(method)")
        }
    }
}
```

**등록 (WebViewContainer.swift):**
```swift
await BridgeRegistry.shared.register("@gyo-framework/plugin-name", handler: PluginBridge())
```

## 권한

**Android** - android/src/main/AndroidManifest.xml:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.PERMISSION_NAME" />
</manifest>
```

**iOS** - 앱의 Info.plist:
```xml
<key>NSPermissionUsageDescription</key>
<string>설명</string>
```

## 이벤트 (Native → Web)

**Android:**
```kotlin
webView.evaluateJavascript(
    "window.gyoBridge.emitEvent('eventName', ${JSONObject(data)})",
    null
)
```

**iOS:**
```swift
let json = try! JSONSerialization.data(withJSONObject: data)
let str = String(data: json, encoding: .utf8)!
webView.evaluateJavaScript("window.gyoBridge.emitEvent('eventName', \(str))")
```

**Web:**
```typescript
bridge.onEvent('eventName', (data) => { /* handle */ })
```
