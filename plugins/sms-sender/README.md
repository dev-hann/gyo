# @gyo-framework/sms-sender

Gyo plugin for sending SMS via Android SmsManager.

## Installation

```bash
npm install @gyo-framework/sms-sender
```

## Usage

```typescript
import { SmsSender } from '@gyo-framework/sms-sender';

const sms = new SmsSender();

// Send SMS
const sent = await sms.send({ phoneNumber: '+821012345678', message: 'Hello!' });

// Read recent SMS
const { messages, count } = await sms.read({ limit: 10 });

// Check availability
if (sms.isAvailable()) {
  // running in WebView with native bridge
}

// Cleanup
sms.destroy();
```

## API

### `SmsSender`

| Method | Returns | Description |
|--------|---------|-------------|
| `send(params)` | `Promise<boolean>` | Send SMS to a phone number |
| `read(params)` | `Promise<ReadResult>` | Read recent SMS from inbox |
| `isAvailable()` | `boolean` | Check if native bridge is available |
| `destroy()` | `void` | Clean up resources |

### Types

```typescript
interface SendParams {
  phoneNumber: string;
  message: string;
}

interface ReadParams {
  limit: number;
}

interface SmsMessage {
  id: string;
  address: string;
  body: string;
  date: number;
  type: string;
}

interface ReadResult {
  messages: SmsMessage[];
  count: number;
}
```

## Android Setup

Register the bridge handler in your `MainActivity.kt`:

```kotlin
import gyo.plugins.sms_sender.SmsSenderBridge
import gyo.plugins.bridge.BridgeRegistry

// In onCreate():
BridgeRegistry.register("sms_sender", SmsSenderBridge(this))
```

### Permissions

Add to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.SEND_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
```

## Peer Dependencies

- `@gyo-framework/bridge@^0.1.3`

## License

MIT
