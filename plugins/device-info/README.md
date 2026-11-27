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

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Nothing in `MainActivity.kt` needs editing.

No permissions are needed.

## Peer Dependencies

- `@gyo-framework/bridge@^0.2.0`

## License

MIT
