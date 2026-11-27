# @gyo-community/notifications

The notification listener service, whether access is granted, and the active notifications read through it.

## Installation

```bash
npm install @gyo-community/notifications
```

## Usage

```typescript
import { NotificationListener, NotificationReader } from '@gyo-community/notifications';

const listener = new NotificationListener();

const { enabled } = await listener.isEnabled();
if (!enabled) {
  await listener.openSettings(); // the system's notification access settings
}

const { notifications } = await listener.getNotifications(20); // the 20 most recent

const reader = new NotificationReader();
const list = await reader.list(); // the 20 most recent

reader.destroy();
listener.destroy();
```

## API

### `NotificationListener`

| Method | Returns | Description |
|--------|---------|-------------|
| `isEnabled()` | `Promise<NotificationListenerStatus>` | Whether notification access is granted and the listener is connected |
| `getNotifications(limit?)` | `Promise<NotificationListResult>` | The most recent notifications, at most `limit` (50 by default, 200 at most) |
| `openSettings()` | `Promise<{ opened: boolean; error?: string }>` | Opens the notification access settings. `error` says why when `opened` is `false` |
| `isAvailable()` | `boolean` | Whether the native bridge is present |
| `destroy()` | `void` | Releases the bridge |

### `NotificationReader`

| Method | Returns | Description |
|--------|---------|-------------|
| `list()` | `Promise<ListResult>` | The active notifications, the newest first, at most 20 of them |
| `isAvailable()` | `boolean` | Whether the native bridge is present |
| `destroy()` | `void` | Releases the bridge |

### Types

```typescript
interface NotificationListenerStatus {
  enabled: boolean;
}

interface NotificationInfo {
  packageName: string;
  title: string;
  text: string;
  postTime: number;
  category: string;
  id: number;
}

interface NotificationListResult {
  notifications: NotificationInfo[];
  count: number;
}

interface ListResult {
  notifications: NotificationInfo[];
  count: number;
}
```

## Android Setup

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Nothing in `MainActivity.kt` needs editing.

### `NotificationListener`

The module declares the service; the user has to allow notification access for the app once, under Settings, Notifications. `openSettings()` leads there.

### `NotificationReader`

Reads through the same service. Until access is granted, `list()` returns an empty result.

## Peer Dependencies

- `@gyo-framework/bridge@^0.2.0`

## License

MIT
