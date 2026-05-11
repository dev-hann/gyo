# @gyo-framework/device-info

Gyo plugin for reading device information via Android Build/Settings.

## Installation

```bash
npm install @gyo-framework/device-info
```

## Usage

```typescript
import { DeviceInfo } from '@gyo-framework/device-info';

const deviceInfo = new DeviceInfo();

// Get device information
const { info } = await deviceInfo.getInfo();

console.log(info.manufacturer); // e.g. "Samsung"
console.log(info.model);        // e.g. "Galaxy S24"
console.log(info.androidVersion); // e.g. "14"

// Check availability
if (deviceInfo.isAvailable()) {
  // running in WebView with native bridge
}

// Cleanup
deviceInfo.destroy();
```

## API

### `DeviceInfo`

| Method | Returns | Description |
|--------|---------|-------------|
| `getInfo()` | `Promise<GetInfoResult>` | Get device information |
| `isAvailable()` | `boolean` | Check if native bridge is available |
| `destroy()` | `void` | Clean up resources |

### Types

```typescript
interface DeviceInfo {
  manufacturer: string;
  model: string;
  brand: string;
  device: string;
  androidVersion: string;
  sdkVersion: number;
  securityPatch: string;
  screenDensity: number;
  screenWidth: number;
  screenHeight: number;
  batteryLevel: number;
  isCharging: boolean;
}

interface GetInfoResult {
  info: DeviceInfo;
}
```

## Android Setup

Register the bridge handler in your `MainActivity.kt`:

```kotlin
import gyo.plugins.device_info.DeviceInfoBridge
import gyo.plugins.bridge.BridgeRegistry

// In onCreate():
BridgeRegistry.register("device_info", DeviceInfoBridge(this))
```

## Peer Dependencies

- `@gyo-framework/bridge@^0.1.3`

## License

MIT
