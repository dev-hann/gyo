# gyo-bridge

Bridge library for seamless communication between web and native platforms (Android, iOS) in the gyo framework.

## Features

- **Bidirectional Communication**: Call native methods from web and send events from native to web
- **Promise-based API**: Clean async/await interface for method invocation
- **Event Streaming**: Listen to native events in real-time
- **Console Bridge**: Forward web console logs to native dev tools
- **Extensible Architecture**: BridgeRegistry system for easy custom bridge registration
- **Type-Safe**: Written in TypeScript with full type definitions
- **Cross-Platform**: Works on both Android and iOS with the same API

## Installation

```bash
npm install gyo-bridge
```

## Usage

### Web Side

```typescript
import { Bridge, initConsoleBridge } from 'gyo-bridge';

// Create a bridge instance with a unique name
const bridge = new Bridge('myBridge');

// Call a native method
const result = await bridge.invoke('getData', { userId: 123 });
console.log(result);

// Listen to events from native
const unsubscribe = bridge.listen((data) => {
  console.log('Event from native:', data);
});

// Stop listening when done
unsubscribe();

// (Optional) Enable console bridge to forward logs to native
initConsoleBridge({ enabled: true });
```

### Console Bridge

Forward web console logs to native dev tools for easier debugging:

```typescript
import { initConsoleBridge } from 'gyo-bridge';

// Enable console forwarding
const cleanup = initConsoleBridge({
  enabled: true,
  levels: ['log', 'info', 'warn', 'error', 'debug'] // optional, defaults to all
});

// Now all console logs will appear in Logcat (Android) or Xcode Console (iOS)
console.log('This will appear in native console!');
console.error('Errors too!');

// Disable when done
cleanup();
```

### Android Side

The Android implementation uses a **BridgeRegistry** system for extensibility. To add custom bridges:

```kotlin
// Step 1: Create a custom bridge handler
class MyCustomBridgeHandler : BridgeHandler {
    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "getData" -> {
                val userId = data.optInt("userId")
                mapOf(
                    "name" to "John Doe",
                    "email" to "john@example.com",
                    "userId" to userId
                )
            }
            else -> throw IllegalArgumentException("Unknown method: $method")
        }
    }
}

// Step 2: Register your bridge in MainActivity
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Register custom bridge
        BridgeRegistry.register("myBridge", MyCustomBridgeHandler())
        
        // ... rest of setup
    }
}
```

**Send events to web:**

```kotlin
// Get reference to bridge interface
private lateinit var bridgeInterface: AndroidBridgeInterface

private fun setupWebView() {
    bridgeInterface = AndroidBridgeInterface(webView)
    // ...
}

// Send event
private fun sendEventToWeb() {
    bridgeInterface.publish("myBridge", mapOf(
        "event" to "userLoggedIn",
        "timestamp" to System.currentTimeMillis()
    ))
}
```

### iOS Side

The iOS implementation uses a **BridgeRegistry** system. To add custom bridges:

```swift
// Step 1: Create a custom bridge handler
class MyCustomBridgeHandler: BridgeHandler {
    func handle(method: String, data: [String: Any]) throws -> Any? {
        switch method {
        case "getData":
            let userId = data["userId"] as? Int ?? 0
            return [
                "name": "John Doe",
                "email": "john@example.com",
                "userId": userId
            ]
        default:
            throw BridgeError.unknownMethod(method)
        }
    }
}

// Step 2: Register your bridge in WebViewController
class WebViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Register custom bridge
        BridgeRegistry.shared.register("myBridge", handler: MyCustomBridgeHandler())
        
        // ... rest of setup
    }
}
```

**Send events to web:**

```swift
// Send event
func sendEventToWeb() {
    publishEvent(bridgeName: "myBridge", data: [
        "event": "userLoggedIn",
        "timestamp": Date().timeIntervalSince1970
    ])
}
```

## API Reference

### Bridge Class

#### Constructor

```typescript
new Bridge(name: string)
```

Creates a new bridge instance with the given name.

- `name`: Unique identifier for this bridge instance

#### Methods

##### invoke<T>(method: string, data?: any): Promise<T>

Invokes a method on the native side and returns a promise.

- `method`: Name of the method to invoke
- `data`: Optional data to send to the native method
- Returns: Promise that resolves with the native method's result

```typescript
const result = await bridge.invoke('getUserProfile', { userId: 123 });
```

##### listen(callback: EventCallback): Unsubscribe

Listens to events from the native side.

- `callback`: Function to call when an event is received
- Returns: Function to call to stop listening

```typescript
const unsubscribe = bridge.listen((data) => {
  console.log('Received:', data);
});

// Later...
unsubscribe();
```

##### getName(): string

Returns the name of the bridge instance.

##### destroy(): void

Cleans up all pending callbacks and listeners.

## Message Format

### Web to Native (Request)

```json
{
  "bridgeName": "myBridge",
  "methodName": "getData",
  "data": { "userId": 123 },
  "callbackId": "myBridge_1234567890_1"
}
```

### Native to Web (Response)

```javascript
// Success
window.gyoBridge.resolve(callbackId, resultData);

// Error
window.gyoBridge.reject(callbackId, errorMessage);
```

### Native to Web (Event)

```javascript
window.gyoBridge.publish(bridgeName, eventData);
```

## Error Handling

The bridge automatically handles errors and rejects promises when:

- No native bridge is found (not running in WebView)
- Method call times out (30 seconds)
- Native method throws an error

```typescript
try {
  const result = await bridge.invoke('someMethod');
} catch (error) {
  console.error('Bridge error:', error.message);
}
```

## Built-in Bridges

### gyo-console

Automatically registered bridge that forwards web console logs to native dev tools.

**Usage:**
```typescript
import { initConsoleBridge } from 'gyo-bridge';

// Enable console forwarding
initConsoleBridge({ enabled: true });

// All console logs now appear in Logcat (Android) or Xcode Console (iOS)
console.log('Debug message');
console.error('Error message');
```

## Architecture

The gyo-bridge system uses a **BridgeRegistry** pattern:

1. **Web creates Bridge instance** with a unique name
2. **Web calls invoke()** which sends a message to native
3. **Native BridgeRouter** receives message and looks up handler by bridge name
4. **BridgeRegistry** finds the registered handler
5. **Handler executes** native code and returns result
6. **Native resolves** the web-side Promise with the result

This architecture makes it easy to:
- Add new bridges without modifying core code
- Keep bridges isolated and testable
- Share bridges across projects

## Creating Custom Bridges

See the [Custom Bridge Development Guide](../../docs/CUSTOM_BRIDGE_GUIDE.md) for detailed instructions on creating your own bridges.

## Example

See the `examples/bridge-test-app` directory for a complete working example with:
- Basic bridge invocation
- Event listening
- Console bridge demonstration
- Custom bridge examples

## Resources

- [Custom Bridge Development Guide](../../docs/CUSTOM_BRIDGE_GUIDE.md)
- [Example App](../../examples/bridge-test-app/)
- [gyo Framework Documentation](../../README.md)

## License

MIT
