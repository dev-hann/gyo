# Gyo Plugins

Cross-platform plugin system for Gyo framework, enabling seamless communication between web and native (Android, iOS) platforms.

## 📦 Packages

| Platform | Package Name | Version | Distribution |
|----------|-------------|---------|--------------|
| **Web** | `gyo-plugins` | 0.1.0 | NPM |
| **Android** | `gyo.plugins:android` | 0.1.0 | JitPack |
| **iOS** | `gyo-plugins-ios` | 0.1.0 | Swift Package Manager |

## 🚀 Quick Start

### Web (JavaScript/TypeScript)

```bash
npm install gyo-plugins
```

```typescript
import { Bridge } from 'gyo-plugins';

const bridge = new Bridge('myBridge');
const result = await bridge.invoke('getData');
```

[Full Web Documentation →](./lib/README.md)

### Android (Kotlin)

```gradle
repositories {
    maven { url 'https://jitpack.io' }
}

dependencies {
    implementation 'gyo.plugins:android:0.1.0'
}
```

```kotlin
import gyo.plugins.bridge.AndroidBridgeInterface
import gyo.plugins.bridge.BridgeRegistry

val bridgeInterface = AndroidBridgeInterface(webView)
webView.addJavascriptInterface(bridgeInterface, "androidBridge")
```

[Full Android Documentation →](./android/README.md)

### iOS (Swift)

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/<your-org>/gyo-plugins-ios.git", from: "0.1.0")
]
```

```swift
import GyoBridge

let bridgeInterface = IOSBridgeInterface(webView: webView)
webView.configuration.userContentController.add(bridgeInterface, name: "gyoBridge")
```

[Full iOS Documentation →](./ios/README.md)

## 🏗️ Repository Structure

```
plugins/
├── lib/                    # Web (NPM)
│   ├── bridge/             # Bridge module
│   ├── index.js            # Main entry point
│   └── package.json
│
├── android/                # Android (JitPack)
│   ├── bridge/             # Bridge module
│   │   └── src/main/kotlin/gyo/plugins/bridge/
│   ├── build.gradle.kts
│   └── settings.gradle.kts
│
└── ios/                    # iOS (SPM)
    ├── Sources/
    │   └── GyoBridge/      # Bridge module
    └── Package.swift
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

## 📚 Documentation

- [Web Documentation](./lib/README.md)
- [Android Documentation](./android/README.md)
- [iOS Documentation](./ios/README.md)

## 🛠️ Development

### Prerequisites

- **Web**: Node.js 16+, npm/yarn
- **Android**: Android SDK 24+, Kotlin 1.9+
- **iOS**: Xcode 14+, Swift 5.9+

### Building from Source

```bash
# Web
cd plugins/lib/bridge
npm install
npm run build

# Android
cd plugins/android
./gradlew build

# iOS
cd plugins/ios
swift build
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

- [Gyo Framework](https://github.com/<your-org>/gyo)
- [Documentation](https://gyo.dev/docs)
- [Examples](https://github.com/<your-org>/gyo-examples)
