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

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Nothing in `MainActivity.kt` needs editing.

### Permissions

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.SEND_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
```
`gyo install` points them out when the lines are missing. The system asks the user for them at run time; `send` returns `false` and `read` returns an empty result until they are granted.
## Peer Dependencies

- `@gyo-framework/bridge@^0.1.3`

## License

MIT
