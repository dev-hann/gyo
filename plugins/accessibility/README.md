# @gyo-framework/accessibility

The accessibility service the screen plugins read and act through, and a way to ask whether it is on.

## Installation

```bash
npm install @gyo-framework/accessibility
```

## Usage

```typescript
import { Accessibility } from '@gyo-framework/accessibility';

const accessibility = new Accessibility();

const { enabled } = await accessibility.isEnabled();
if (!enabled) {
  await accessibility.openSettings(); // the system's Accessibility settings
}
```

## API

### `Accessibility`

| Method | Returns | Description |
|--------|---------|-------------|
| `isEnabled()` | `Promise<AccessibilityStatus>` | Whether the service is enabled and connected |
| `openSettings()` | `Promise<{ opened: boolean }>` | Opens the Accessibility settings |
| `isAvailable()` | `boolean` | Whether the native bridge is present |
| `destroy()` | `void` | Releases the bridge |

### Types

```typescript
interface AccessibilityStatus {
  enabled: boolean;
}
```

## Android Setup

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Nothing in `MainActivity.kt` needs editing.

The module declares the service; the user has to enable it once under Settings, Accessibility. The screen plugins `@gyo-framework/screen-reader`, `screen-action` and `screen-find` bring this plugin themselves and read the screen through the same service.

## Peer Dependencies

- `@gyo-framework/bridge@^0.2.0`

## License

MIT
