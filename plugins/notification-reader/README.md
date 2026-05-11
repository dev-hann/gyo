# @gyo-framework/notification-reader

Gyo plugin for reading notifications via Android NotificationListenerService.

## Installation

```bash
npm install @gyo-framework/notification-reader
```

## Usage

```typescript
import { NotificationReader } from '@gyo-framework/notification-reader';

const reader = new NotificationReader();

// List active notifications
const { notifications, count } = await reader.list();

// Check availability
if (reader.isAvailable()) {
  // running in WebView with native bridge
}

// Cleanup
reader.destroy();
```

## API

### `NotificationReader`

| Method | Returns | Description |
|--------|---------|-------------|
| `list()` | `Promise<ListResult>` | List all active notifications |
| `isAvailable()` | `boolean` | Check if native bridge is available |
| `destroy()` | `void` | Clean up resources |

### Types

```typescript
interface NotificationInfo {
  packageName: string;
  title: string;
  text: string;
  postTime: number;
  category: string;
}

interface ListResult {
  notifications: NotificationInfo[];
  count: number;
}
```

## Android Setup

Register the bridge handler in your `MainActivity.kt`:

```kotlin
import gyo.plugins.notification_reader.NotificationReaderBridge
import gyo.plugins.bridge.BridgeRegistry

// In onCreate():
BridgeRegistry.register("notification_reader", NotificationReaderBridge(this))
```

**Note:** Reading active notifications requires notification listener access. If the permission is not granted, `list()` returns an empty list.

## Peer Dependencies

- `@gyo-framework/bridge@^0.1.3`

## License

MIT
