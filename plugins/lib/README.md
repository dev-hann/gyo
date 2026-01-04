# Gyo Plugins - Web

Web bridge library for Gyo framework.

## 🎯 Overview

This library provides a bridge between web applications and native platforms (Android, iOS), enabling seamless communication between JavaScript and native code.

## 📦 Installation

```bash
npm install gyo-plugins
```

## 🚀 Usage

### Basic Setup

```typescript
import { Bridge } from 'gyo-plugins';

// Create a bridge instance
const bridge = new Bridge('myBridge');

// Invoke native methods
const result = await bridge.invoke('getData', { param: 'value' });
console.log(result);

// Listen to native events
const unsubscribe = bridge.listen((event) => {
  console.log('Event received from native:', event);
});

// Cleanup when done
unsubscribe();
```

### Creating Multiple Bridges

```typescript
import { Bridge } from 'gyo-plugins';

// Create different bridges for different purposes
const authBridge = new Bridge('auth');
const dataBridge = new Bridge('data');

// Use them independently
await authBridge.invoke('login', { username: 'user', password: 'pass' });
await dataBridge.invoke('fetch', { id: 123 });
```

### Error Handling

```typescript
import { Bridge } from 'gyo-plugins';

const bridge = new Bridge('myBridge');

try {
  const result = await bridge.invoke('someMethod', { data: 'test' });
  console.log(result);
} catch (error) {
  console.error('Bridge error:', error);
  // Handle error (e.g., method not found, timeout, etc.)
}
```

### Event Listening

```typescript
import { Bridge } from 'gyo-plugins';

const bridge = new Bridge('myBridge');

// Subscribe to events
const unsubscribe = bridge.listen((event) => {
  console.log('Event:', event);
  
  // Handle different event types
  if (event.type === 'update') {
    // Handle update event
  }
});

// Later, unsubscribe when component unmounts
unsubscribe();
```

## 📚 API Reference

### Bridge

Main bridge class for web-native communication.

#### Constructor

```typescript
constructor(name: string)
```

Creates a new bridge instance with the specified name.

#### Methods

##### `invoke<T>(method: string, data?: any): Promise<T>`

Invokes a method on the native side and returns a promise that resolves with the result.

- **method**: Method name to invoke
- **data**: Optional data to send to native
- **Returns**: Promise that resolves with the native response
- **Throws**: Error if native bridge is not found or method times out (30s)

##### `listen(callback: EventCallback): Unsubscribe`

Listens to events from the native side.

- **callback**: Function to call when event is received
- **Returns**: Unsubscribe function to stop listening

##### `getName(): string`

Returns the bridge name.

##### `destroy(): void`

Cleans up all pending callbacks and listeners.

### Types

```typescript
interface BridgeRequest {
  bridgeName: string;
  methodName: string;
  data?: any;
  callbackId: string;
}

interface BridgeResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface BridgeEvent {
  type: string;
  data?: any;
}

type EventCallback = (event: any) => void;
type Unsubscribe = () => void;
```

## 🔧 Platform-Specific Setup

### Android

Make sure the native bridge is properly set up:

```kotlin
import gyo.plugins.bridge.AndroidBridgeInterface
import gyo.plugins.bridge.BridgeRegistry

val bridgeInterface = AndroidBridgeInterface(webView)
webView.addJavascriptInterface(bridgeInterface, "androidBridge")
```

### iOS

Make sure the native bridge is properly set up:

```swift
import GyoBridge

let bridgeInterface = IOSBridgeInterface(webView: webView)
webView.configuration.userContentController.add(bridgeInterface, name: "gyoBridge")
```

## 🔗 Related Packages

- **Android**: `gyo.plugins:android` (JitPack)
- **iOS**: `gyo-plugins-ios` (Swift Package)

## 📄 License

MIT
