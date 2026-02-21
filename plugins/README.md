# Gyo Plugins

Cross-platform plugin system for Gyo framework, enabling seamless communication between web and native (Android, iOS) platforms.

## 📦 Packages

| Platform | Package Name | Version | Distribution |
|----------|-------------|---------|--------------|
| **Web + Android + iOS** | `@gyo/bridge` | 0.1.2 | NPM |

## 🚀 Quick Start

### Web (JavaScript/TypeScript)

```bash
npm install @gyo/bridge
```

```typescript
import { Bridge } from '@gyo/bridge';

const bridge = new Bridge('myBridge');
const result = await bridge.invoke('getData');
```

### Android (Kotlin)

```bash
# Automatically added when running: gyo add @gyo/bridge
```

```kotlin
import gyo.plugins.bridge.AndroidBridgeInterface
import gyo.plugins.bridge.BridgeRegistry

val bridgeInterface = AndroidBridgeInterface(webView)
webView.addJavascriptInterface(bridgeInterface, "androidBridge")
```

### iOS (Swift)

```bash
# Automatically added when running: gyo add @gyo/bridge
```

```swift
import GyoBridge

let bridgeInterface = IOSBridgeInterface(webView: webView)
webView.configuration.userContentController.add(bridgeInterface, name: "gyoBridge")
```

## 🏗️ Repository Structure

```
plugins/
└── bridge/                  # Core bridge (@gyo/bridge)
    ├── src/                # Web (NPM)
    │   ├── Bridge.ts
    │   ├── types.ts
    │   └── index.ts
    ├── dist/               # Compiled JavaScript
    ├── android/             # Android (Gradle)
    │   ├── build.gradle.kts
    │   └── Sources/
    │       └── GyoBridge/
    │           ├── BridgeHandler.kt
    │           ├── BridgeRegistry.kt
    │           └── AndroidBridgeInterface.kt
    ├── ios/                 # iOS (Swift Package)
    │   ├── Package.swift
    │   └── Sources/
    │       └── GyoBridge/
    │           ├── BridgeHandler.swift
    │           ├── BridgeRegistry.swift
    │           └── IOSBridgeInterface.swift
    ├── package.json
    └── tsconfig.json
```

## 🔌 Available Plugins

### Bridge (Core)

The core bridge plugin enables bidirectional communication between web and native platforms.

**Features:**
- ✅ Invoke native methods from web
- ✅ Listen to native events in web
- ✅ Custom bridge handlers
- ✅ Promise-based API
- ✅ Type-safe (TypeScript/Swift/Kotlin)

## 🛠️ Development

### Prerequisites

- **Web**: Node.js 16+, npm
- **Android**: Android SDK 24+, Kotlin 1.9+
- **iOS**: Xcode 14+, Swift 5.9+

### Building from Source

```bash
cd plugins/bridge
npm install
npm run build
```

### Publishing to NPM

```bash
cd plugins/bridge
npm publish
```

## 🔌 Creating Custom Plugins

### Plugin Naming Convention

Gyo uses **npm scopes** for plugin discovery:

| Scope | Usage | Example |
|-------|-------|---------|
| `@gyo/` | Official plugins | `@gyo/camera`, `@gyo/geolocation` |
| `@gyo-community/` | Community plugins | `@gyo-community/payment`, `@gyo-community/analytics` |

### Plugin Package Structure

```
@gyo/my-plugin/
├── package.json              # "name": "@gyo/my-plugin"
├── src/
│   ├── Bridge.ts
│   ├── types.ts
│   └── index.ts
├── android/
│   ├── build.gradle.kts
│   └── src/main/kotlin/gyo/plugins/myplugin/
│       └── MyPluginHandler.kt
└── ios/
    ├── Package.swift
    └── Sources/
        └── MyPluginHandler.swift
```

Packages with `@gyo/` or `@gyo-community/` scope are automatically detected and integrated into Android/iOS projects.

### Installing Plugins

```bash
# Using gyo CLI (recommended)
gyo add @gyo/camera

# Or manually via npm
cd lib
npm install @gyo/camera
cd ..
gyo install
```

### 1. Web Plugin (TypeScript)

Create a plugin class that wraps the `Bridge` for type-safe API:

```typescript
import { Bridge } from '@gyo/bridge';

export class MyPlugin {
  private bridge: Bridge;

  constructor() {
    this.bridge = new Bridge('myPlugin');
  }

  async getData(userId: number): Promise<any> {
    return this.bridge.invoke('getData', { userId });
  }

  onUpdate(callback: (data: any) => void): () => void {
    return this.bridge.listen(callback);
  }

  destroy(): void {
    this.bridge.destroy();
  }
}
```

### 2. Android Plugin (Kotlin)

Implement `BridgeHandler` interface and register with `BridgeRegistry`:

```kotlin
package com.gyo.myplugin

import gyo.plugins.bridge.BridgeHandler
import org.json.JSONObject

class MyPluginHandler : BridgeHandler {

    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "getData" -> {
                val userId = data.optInt("userId")
                mapOf(
                    "id" to userId,
                    "name" to "User $userId",
                    "email" to "user$userId@example.com"
                )
            }
            else -> throw IllegalArgumentException("Unknown method: $method")
        }
    }
}
```

**Registration:**

```kotlin
import gyo.plugins.bridge.BridgeRegistry

BridgeRegistry.register("myPlugin", MyPluginHandler())
```

### 3. iOS Plugin (Swift)

Implement `BridgeHandler` protocol and register with `BridgeRegistry`:

```swift
import Foundation
import GyoBridge

class MyPluginHandler: BridgeHandler {

    func handle(method: String, data: [String: Any]) throws -> Any? {
        switch method {
        case "getData":
            let userId = data["userId"] as? Int ?? 0
            return [
                "id": userId,
                "name": "User \(userId)",
                "email": "user\(userId)@example.com"
            ]
        default:
            throw BridgeError.unknownMethod(method)
        }
    }
}
```

**Registration:**

```swift
import GyoBridge

BridgeRegistry.shared.register("myPlugin", handler: MyPluginHandler())
```

## 📋 Roadmap

Future plugins planned:
- File System access
- Camera & Photo Library
- Native notifications
- Geolocation
- Device info
- Secure storage

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT

## 🔗 Links

- [Gyo Framework](https://github.com/gyo-framework/gyo)
- [Documentation](https://gyo.dev/docs)
- [Examples](https://github.com/gyo-framework/gyo-examples)
