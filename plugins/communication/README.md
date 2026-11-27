# @gyo-community/communication

Gyo plugin for searching contacts, sending and reading SMS, and making calls and reading the call log on Android.

It replaces `@gyo-framework/contact-search`, `@gyo-framework/sms-sender` and `@gyo-framework/phone-caller`. The classes keep their methods and types; only the import path changes.

## Installation

```bash
npm install @gyo-community/communication
```

## Usage

```typescript
import { ContactSearch, PhoneCaller, SmsSender } from '@gyo-community/communication';

const contactSearch = new ContactSearch();
const sms = new SmsSender();
const caller = new PhoneCaller();

// Search contacts
const { contacts, count } = await contactSearch.search({ query: 'john' });

// Send an SMS, read the recent ones
const sent = await sms.send({ phoneNumber: '+821012345678', message: 'Hello!' });
const recent = await sms.read({ limit: 10 });

// Make a call, read the call log
const called = await caller.call({ phoneNumber: '01012345678' });
const log = await caller.getCallLog({ limit: 10 });

// Check availability
if (contactSearch.isAvailable()) {
  // running in WebView with native bridge
}

// Cleanup
contactSearch.destroy();
sms.destroy();
caller.destroy();
```

## API

Every method posts to the `communication` bridge, which the Android module answers.

### `ContactSearch`

| Method | Bridge method | Returns | Description |
|--------|---------------|---------|-------------|
| `search(params)` | `search` | `Promise<SearchResult>` | Search contacts by name |
| `isAvailable()` | — | `boolean` | Check if native bridge is available |
| `destroy()` | — | `void` | Clean up resources |

#### Types

```typescript
interface ContactInfo {
  id: string;
  name: string;
  phoneNumbers: string[];
  emails: string[];
}

interface SearchParams {
  query: string;
}

interface SearchResult {
  contacts: ContactInfo[];
  count: number;
}
```

### `SmsSender`

| Method | Bridge method | Returns | Description |
|--------|---------------|---------|-------------|
| `send(params)` | `send` | `Promise<boolean>` | Send SMS to a phone number |
| `read(params)` | `read` | `Promise<ReadResult>` | Read recent SMS from inbox |
| `isAvailable()` | — | `boolean` | Check if native bridge is available |
| `destroy()` | — | `void` | Clean up resources |

#### Types

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

### `PhoneCaller`

| Method | Bridge method | Returns | Description |
|--------|---------------|---------|-------------|
| `call(params)` | `call` | `Promise<boolean>` | Make a phone call |
| `getCallLog(params)` | `get_call_log` | `Promise<CallLogResult>` | Get recent call log entries |
| `isAvailable()` | — | `boolean` | Check if native bridge is available |
| `destroy()` | — | `void` | Clean up resources |

#### Types

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

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler under the name `communication`. Nothing in `MainActivity.kt` needs editing.

The module's manifest is empty: it declares no service and no `<queries>`.

### Permissions

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.READ_CONTACTS" />
<uses-permission android:name="android.permission.SEND_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.CALL_PHONE" />
<uses-permission android:name="android.permission.READ_CALL_LOG" />
```

`gyo install` points them out when the lines are missing. The system asks the user for them at run time.

`READ_SMS`, `SEND_SMS` and `READ_CALL_LOG` are hard-restricted on Android: an app cannot hold them until its installer allowlists them, and asking the user at run time does not change that. For an app installed the usual way, `send` returns `false` and `read` and `getCallLog` return an empty result.

| Class | Permissions | Until they are granted |
|-------|-------------|------------------------|
| `ContactSearch` | `READ_CONTACTS` | `search` returns an empty result |
| `SmsSender` | `SEND_SMS`, `READ_SMS` | `send` returns `false`; `read` returns an empty result |
| `PhoneCaller` | `CALL_PHONE`, `READ_CALL_LOG` | `call` returns `false`; `getCallLog` returns an empty result |

Ask for them with `requestPermissions([...])` from `@gyo-framework/bridge`:

```typescript
await requestPermissions([
  'android.permission.READ_CONTACTS',
  'android.permission.SEND_SMS',
  'android.permission.READ_SMS',
  'android.permission.CALL_PHONE',
  'android.permission.READ_CALL_LOG',
]);
```

## Peer Dependencies

- `@gyo-framework/bridge@^0.2.0`

## License

MIT
