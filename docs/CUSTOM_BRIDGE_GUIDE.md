# Custom Bridge Development Guide

This guide shows you how to create custom bridges to expose native functionality to your web application using the gyo-bridge system.

## Overview

The gyo-bridge system uses a **BridgeRegistry** pattern that allows you to register custom bridge handlers that respond to specific bridge names. This makes it easy to extend your app with native functionality.

### Architecture

```
Web App (JavaScript/TypeScript)
    ↓ invoke('method', data)
Bridge Instance (gyo-bridge)
    ↓ postMessage
Native Bridge Router (AndroidBridgeInterface / WKScriptMessageHandler)
    ↓ route to handler
BridgeRegistry
    ↓ find handler by name
Custom Bridge Handler
    ↓ execute native code
    ↓ return result
```

## Creating a Custom Bridge

### Step 1: Define Your Bridge Interface (Web Side)

First, create a Bridge instance in your web application:

```typescript
import { Bridge } from 'gyo-bridge';

// Create a bridge for device information
const deviceBridge = new Bridge('device-info');

// Call native method
const deviceInfo = await deviceBridge.invoke('getDeviceId');
console.log('Device ID:', deviceInfo.deviceId);

// Listen for events from native
deviceBridge.listen((data) => {
  console.log('Battery level changed:', data.level);
});
```

### Step 2: Implement Android Handler

Create a handler class that implements the `BridgeHandler` interface:

```kotlin
// In MainActivity.kt or separate file

class DeviceInfoBridgeHandler(private val context: Context) : BridgeHandler {
    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "getDeviceId" -> {
                val deviceId = Settings.Secure.getString(
                    context.contentResolver,
                    Settings.Secure.ANDROID_ID
                )
                mapOf(
                    "deviceId" to deviceId,
                    "model" to Build.MODEL,
                    "manufacturer" to Build.MANUFACTURER,
                    "androidVersion" to Build.VERSION.RELEASE
                )
            }
            
            "getBatteryLevel" -> {
                val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
                val level = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
                mapOf("level" to level)
            }
            
            else -> throw IllegalArgumentException("Unknown method: $method")
        }
    }
}
```

### Step 3: Register the Handler (Android)

Register your handler in `MainActivity.kt`:

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    // ... existing setup code ...
    
    // Register custom bridge
    BridgeRegistry.register("device-info", DeviceInfoBridgeHandler(this))
}
```

### Step 4: Implement iOS Handler

Create a handler class that conforms to the `BridgeHandler` protocol:

```swift
// In WebViewContainer.swift or separate file

class DeviceInfoBridgeHandler: BridgeHandler {
    func handle(method: String, data: [String: Any]) throws -> Any? {
        switch method {
        case "getDeviceId":
            return [
                "deviceId": UIDevice.current.identifierForVendor?.uuidString ?? "",
                "model": UIDevice.current.model,
                "systemName": UIDevice.current.systemName,
                "systemVersion": UIDevice.current.systemVersion
            ]
            
        case "getBatteryLevel":
            UIDevice.current.isBatteryMonitoringEnabled = true
            let level = Int(UIDevice.current.batteryLevel * 100)
            return ["level": level]
            
        default:
            throw BridgeError.unknownMethod(method)
        }
    }
}
```

### Step 5: Register the Handler (iOS)

Register your handler in `WebViewController`:

```swift
override func viewDidLoad() {
    super.viewDidLoad()
    
    // ... existing setup code ...
    
    // Register custom bridge
    BridgeRegistry.shared.register("device-info", handler: DeviceInfoBridgeHandler())
}
```

## Sending Events from Native to Web

### Android

```kotlin
// Get the bridge interface instance (store it during setup)
class MainActivity : AppCompatActivity() {
    private lateinit var bridgeInterface: AndroidBridgeInterface
    
    private fun setupWebView() {
        bridgeInterface = AndroidBridgeInterface(webView)
        webView.addJavascriptInterface(bridgeInterface, "androidBridge")
        // ... rest of setup
    }
    
    // Later, send events
    private fun onBatteryLevelChanged(level: Int) {
        bridgeInterface.publish("device-info", mapOf(
            "event" to "batteryLevelChanged",
            "level" to level
        ))
    }
}
```

### iOS

```swift
class WebViewController: UIViewController {
    
    func notifyBatteryLevelChanged(_ level: Int) {
        publishEvent(bridgeName: "device-info", data: [
            "event": "batteryLevelChanged",
            "level": level
        ])
    }
}
```

## Complete Example: Camera Bridge

### Web Side

```typescript
import { Bridge } from 'gyo-bridge';

const cameraBridge = new Bridge('camera');

// Take a photo
async function takePhoto() {
  try {
    const result = await cameraBridge.invoke('takePhoto', {
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1080
    });
    
    // result.imageData is base64 encoded image
    displayImage(result.imageData);
  } catch (error) {
    console.error('Failed to take photo:', error);
  }
}

// Listen for camera events
cameraBridge.listen((event) => {
  if (event.type === 'photoTaken') {
    console.log('Photo captured!');
  }
});
```

### Android Handler

```kotlin
class CameraBridgeHandler(private val activity: Activity) : BridgeHandler {
    private val CAMERA_REQUEST_CODE = 100
    
    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "takePhoto" -> {
                val quality = data.optDouble("quality", 0.8)
                val maxWidth = data.optInt("maxWidth", 1920)
                val maxHeight = data.optInt("maxHeight", 1080)
                
                // Launch camera intent
                val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                activity.startActivityForResult(intent, CAMERA_REQUEST_CODE)
                
                // Note: For async operations, you might want to use
                // a different pattern with callbacks/promises
                mapOf("status" to "launched")
            }
            
            else -> throw IllegalArgumentException("Unknown method: $method")
        }
    }
}
```

### iOS Handler

```swift
class CameraBridgeHandler: NSObject, BridgeHandler, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    
    weak var viewController: UIViewController?
    
    init(viewController: UIViewController) {
        self.viewController = viewController
    }
    
    func handle(method: String, data: [String: Any]) throws -> Any? {
        switch method {
        case "takePhoto":
            let quality = data["quality"] as? Double ?? 0.8
            let maxWidth = data["maxWidth"] as? Int ?? 1920
            let maxHeight = data["maxHeight"] as? Int ?? 1080
            
            DispatchQueue.main.async {
                let picker = UIImagePickerController()
                picker.sourceType = .camera
                picker.delegate = self
                self.viewController?.present(picker, animated: true)
            }
            
            return ["status": "launched"]
            
        default:
            throw BridgeError.unknownMethod(method)
        }
    }
}
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully and return meaningful error messages:

```kotlin
override fun handle(method: String, data: JSONObject): Any? {
    try {
        // Your logic here
    } catch (e: SecurityException) {
        throw IllegalStateException("Permission denied: ${e.message}")
    } catch (e: Exception) {
        throw IllegalStateException("Operation failed: ${e.message}")
    }
}
```

### 2. Async Operations

For long-running operations, consider using events instead of blocking:

```kotlin
override fun handle(method: String, data: JSONObject): Any? {
    when (method) {
        "downloadFile" -> {
            val url = data.getString("url")
            
            // Start download in background
            Thread {
                try {
                    // Download file...
                    bridgeInterface.publish("file-manager", mapOf(
                        "event" to "downloadComplete",
                        "url" to url,
                        "path" to savedPath
                    ))
                } catch (e: Exception) {
                    bridgeInterface.publish("file-manager", mapOf(
                        "event" to "downloadError",
                        "error" to e.message
                    ))
                }
            }.start()
            
            // Return immediately
            return mapOf("status" to "started")
        }
    }
}
```

### 3. Type Safety

Use TypeScript on the web side for type safety:

```typescript
interface DeviceInfo {
  deviceId: string;
  model: string;
  manufacturer: string;
  androidVersion?: string;
  systemVersion?: string;
}

const deviceBridge = new Bridge('device-info');

const info = await deviceBridge.invoke<DeviceInfo>('getDeviceId');
console.log(info.deviceId); // TypeScript knows this exists
```

### 4. Permissions

Always check and request permissions before accessing sensitive APIs:

```kotlin
override fun handle(method: String, data: JSONObject): Any? {
    when (method) {
        "getLocation" -> {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
                throw SecurityException("Location permission not granted")
            }
            // Get location...
        }
    }
}
```

## Testing Your Custom Bridge

1. Build and run your app: `gyo run android` or `gyo run ios`
2. Use the browser dev tools or native console to check for errors
3. Test all methods and edge cases
4. Verify error handling works correctly

## Built-in Bridges

gyo comes with these built-in bridges:

- **gyo-console**: Forwards web console logs to native console (automatically registered)

## Next Steps

- Check out the example app in `examples/bridge-test-app`
- Read the [gyo-bridge API documentation](../plugins/gyo-bridge/README.md)
- Explore more advanced patterns like bi-directional streaming
