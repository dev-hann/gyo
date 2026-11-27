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

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Nothing in `MainActivity.kt` needs editing.

Reading active notifications requires notification listener access. The app needs a `NotificationListenerService` of its own, which the user enables in the system settings; without it `list()` returns an empty list.

## Peer Dependencies

- `@gyo-framework/bridge@^0.1.3`

## License

MIT
