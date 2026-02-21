# @gyo-framework/bridge

Core bridge library for Gyo framework - enables seamless communication between web and native platforms (Android, iOS).

## 📦 Installation

```bash
npm install @gyo-framework/bridge
```

## 📦 Package Contents

The `@gyo-framework/bridge` package includes:

| Component | Location | Description |
|-----------|----------|-------------|
| Web (TypeScript) | `dist/` | Core Bridge class for web-native communication |
| Android (Kotlin) | `android/src/` | AndroidBridgeInterface and BridgeRegistry |
| iOS (Swift) | `ios/Sources/` | IOSBridgeInterface and BridgeRegistry |

All native code is bundled within the npm package for unified distribution.

## 🚀 Quick Start

### Web Side

```typescript
import { Bridge } from '@gyo-framework/bridge';

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
```

### Platform Integration

To enable native bridge functionality, you need to integrate the native code into your app:

- **Android**: [Android Integration Guide](docs/ANDROID_INTEGRATION.md)
- **iOS**: [iOS Integration Guide](docs/IOS_INTEGRATION.md)

## 📚 API Reference

### Bridge Class

#### Constructor

```typescript
new Bridge(name: string)
```

Creates a new bridge instance with given name.

- `name`: Unique identifier for this bridge instance

#### Methods

##### `invoke<T>(method: string, data?: any): Promise<T>`

Invokes a method on the native side and returns a promise.

```typescript
const result = await bridge.invoke('getUserProfile', { userId: 123 });
```

##### `listen(callback: EventCallback): Unsubscribe`

Listens to events from the native side.

```typescript
const unsubscribe = bridge.listen((data) => {
  console.log('Received:', data);
});

// Later...
unsubscribe();
```

##### `getName(): string`

Returns the name of the bridge instance.

##### `destroy(): void`

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

- No native bridge is found (not running in a WebView)
- Method call times out (30 seconds)
- Native method throws an error

```typescript
try {
  const result = await bridge.invoke('someMethod');
} catch (error) {
  console.error('Bridge error:', error.message);
}
```

## Architecture

The @gyo-framework/bridge system uses a **BridgeRegistry** pattern:

1. **Web creates Bridge instance** with a unique name
2. **Web calls invoke()** which sends a message to native
3. **Native BridgeInterface** receives message and looks up handler by bridge name
4. **BridgeRegistry** finds the registered handler
5. **Handler executes** native code and returns result
6. **Native resolves** the web-side Promise with the result

This architecture makes it easy to:
- Add new bridges without modifying core code
- Keep bridges isolated and testable
- Share bridges across projects

## 🔗 Documentation

- [Android Integration Guide](docs/ANDROID_INTEGRATION.md) - Integrate Android native code
- [iOS Integration Guide](docs/IOS_INTEGRATION.md) - Integrate iOS native code
- [Gyo Framework](https://github.com/gyo-framework/gyo)
- [Gyo Documentation](https://gyo.dev/docs)

## 🔧 Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Watch for changes
npm run watch

# Type check
npm run typecheck

# Clean build artifacts
npm run clean
```

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions:
- [GitHub Issues](https://github.com/gyo-framework/gyo/issues)
- [Documentation](https://gyo.dev/docs)
