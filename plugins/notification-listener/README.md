# @gyo-framework/notification-listener

The notification listener service, a way to ask whether access is granted, and the active notifications read through it.

## Installation

```bash
npm install @gyo-framework/notification-listener
```

## Usage

```typescript
import { NotificationListener } from '@gyo-framework/notification-listener';

const listener = new NotificationListener();

const { enabled } = await listener.isEnabled();
if (!enabled) {
  await listener.openSettings(); // the system's notification access settings
}

const { notifications } = await listener.getNotifications(20); // the 20 most recent
```

## API

### `NotificationListener`

| Method | Returns | Description |
|--------|---------|-------------|
| `isEnabled()` | `Promise<NotificationListenerStatus>` | Whether notification access is granted and the listener is connected |
| `getNotifications(limit?)` | `Promise<NotificationListResult>` | The most recent notifications, at most `limit` (50 by default, 200 at most) |
| `openSettings()` | `Promise<{ opened: boolean }>` | Opens the notification access settings |
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
```

## Android Setup

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Nothing in `MainActivity.kt` needs editing.

The module declares the service; the user has to allow notification access for the app once. `@gyo-framework/notification-reader` brings this plugin and reads through the same service.

## Peer Dependencies

- `@gyo-framework/bridge@^0.2.0`

## License

MIT
