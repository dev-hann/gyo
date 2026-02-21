# Gyo Project Templates

This directory contains templates for creating new Gyo projects with `gyo create` command.

## Template Structure

```
templates/
├── android/        # Android native project
├── ios/            # iOS native project
├── lib/            # Web application (React)
└── gyo.config.json # Gyo configuration
```

## Using Gyo Plugins

All templates now use Gyo Plugins as dependencies instead of including bridge code directly.

### Web (React)

**package.json**
```json
{
  "dependencies": {
    "gyo-plugins": "^0.1.0"
  }
}
```

**Usage Example**
```typescript
import { Bridge } from 'gyo-plugins';

// Create a custom bridge
const myBridge = new Bridge('myCustomBridge');

// Call native methods
const result = await myBridge.invoke('getData', { id: 123 });

// Listen to native events
const unsubscribe = myBridge.listen((event) => {
  console.log('Event from native:', event);
});
```

### Android (Kotlin)

**settings.gradle**
```gradle
repositories {
    maven { url 'https://jitpack.io' }
}
```

**app/build.gradle**
```gradle
dependencies {
    implementation 'gyo.plugins:android:0.1.0'
}
```

**Usage Example**
```kotlin
import gyo.plugins.bridge.AndroidBridgeInterface
import gyo.plugins.bridge.BridgeRegistry
import gyo.plugins.bridge.BridgeHandler

// Setup in MainActivity
val bridgeInterface = AndroidBridgeInterface(webView)
webView.addJavascriptInterface(bridgeInterface, "androidBridge")

// Register custom bridge
class MyCustomBridgeHandler : BridgeHandler {
    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "getData" -> {
                val id = data.optInt("id")
                // Return data
                mapOf("success" to true, "data" to "...")
            }
            else -> throw IllegalArgumentException("Unknown method: $method")
        }
    }
}

BridgeRegistry.register("myCustomBridge", MyCustomBridgeHandler())
```

### iOS (Swift)

**Package.swift**
```swift
dependencies: [
    .package(url: "https://github.com/gyo-ai/gyo-plugins-ios.git", from: "0.1.0")
]
```

**Usage Example**
```swift
import GyoBridge

// Setup in WebViewController
let bridgeInterface = IOSBridgeInterface(webView: webView)
webView.configuration.userContentController.add(bridgeInterface, name: "gyoBridge")

// Register custom bridge
final class MyCustomBridgeHandler: BridgeHandler {
    func handle(method: String, data: [String: Any]) throws -> Any? {
        switch method {
        case "getData":
            let id = data["id"] as? Int ?? 0
            // Return data
            return ["success": true, "data": "..."]
        default:
            throw BridgeError.unknownMethod(method)
        }
    }
}

await BridgeRegistry.shared.register("myCustomBridge", handler: MyCustomBridgeHandler())
```

## Migration from Old Templates

If you have an existing project with embedded bridge code:

### Android
1. Remove `app/src/main/kotlin/<package>/gyo/` directory
2. Update imports: `import <package>.gyo.*` → `import gyo.plugins.bridge.*`
3. Add JitPack repository to `settings.gradle`
4. Add `implementation 'gyo.plugins:android:0.1.0'` to `app/build.gradle`
5. Remove ConsoleBridgeHandler registration

### iOS
1. Remove bridge Swift files (BridgeHandler.swift, BridgeRegistry.swift, etc.)
2. Add `import GyoBridge` to files using bridge
3. Update Package.swift to include gyo-plugins-ios dependency
4. Remove ConsoleBridgeHandler registration

### Web
1. Update `gyo-plugins` version to `^0.1.0` in package.json
2. Remove any references to `initConsoleBridge` (deprecated)

## Documentation

- [Gyo Plugins Documentation](../plugins/README.md)
- [Web Bridge API](../plugins/lib/README.md)
- [Android Bridge API](../plugins/android/README.md)
- [iOS Bridge API](../plugins/ios/README.md)

## Future Enhancements

- [ ] Template version management for latest OS versions
- [ ] Multiple state management library templates (Redux Toolkit, Zustand, Recoil)
- [ ] Custom template support (`gyo create --template <path>`)
- [ ] Desktop platform templates (Electron, Tauri)
- [ ] Template optimization and build speed improvements
