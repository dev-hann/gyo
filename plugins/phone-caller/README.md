# @gyo-framework/phone-caller

Gyo plugin for making phone calls via Android Intent.

## Installation

```bash
npm install @gyo-framework/phone-caller
```

## Usage

```typescript
import { PhoneCaller } from '@gyo-framework/phone-caller';

const caller = new PhoneCaller();

// Make a phone call
const called = await caller.call({ phoneNumber: '01012345678' });

// Get call log
const { entries, count } = await caller.getCallLog({ limit: 10 });

// Check availability
if (caller.isAvailable()) {
  // running in WebView with native bridge
}

// Cleanup
caller.destroy();
```

## API

### `PhoneCaller`

| Method | Returns | Description |
|--------|---------|-------------|
| `call(params)` | `Promise<boolean>` | Make a phone call |
| `getCallLog(params)` | `Promise<CallLogResult>` | Get recent call log entries |
| `isAvailable()` | `boolean` | Check if native bridge is available |
| `destroy()` | `void` | Clean up resources |

### Types

```typescript
interface CallParams {
  phoneNumber: string;
}

interface GetCallLogParams {
  limit: number;
}

interface CallLogEntry {
  number: string;
  name: string;
  date: number;
  duration: number;
  type: string;
}

interface CallLogResult {
  entries: CallLogEntry[];
  count: number;
}
```

## Android Setup

Register the bridge handler in your `MainActivity.kt`:

```kotlin
import gyo.plugins.phone_caller.PhoneCallerBridge
import gyo.plugins.bridge.BridgeRegistry

// In onCreate():
BridgeRegistry.register("phone_caller", PhoneCallerBridge(this))
```

### Permissions

Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CALL_PHONE" />
<uses-permission android:name="android.permission.READ_CALL_LOG" />
```

## Peer Dependencies

- `@gyo-framework/bridge@^0.1.3`

## License

MIT
