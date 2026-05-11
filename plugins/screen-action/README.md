# @gyo-framework/screen-action

Gyo plugin for performing screen actions via Android AccessibilityService.

## Installation

```bash
npm install @gyo-framework/screen-action
```

## Usage

```typescript
import { ScreenAction } from '@gyo-framework/screen-action';

const screen = new ScreenAction();

// Tap at coordinates
await screen.tap({ x: 100, y: 200 });

// Type text into focused field
await screen.type({ text: 'hello world' });

// Swipe from one point to another
await screen.swipe({ startX: 100, startY: 500, endX: 100, endY: 200, duration: 300 });

// Perform global action
await screen.globalAction({ action: 'back' });
await screen.globalAction({ action: 'home' });

// Check availability
if (screen.isAvailable()) {
  // running in WebView with native bridge
}

// Cleanup
screen.destroy();
```

## API

### `ScreenAction`

| Method | Returns | Description |
|--------|---------|-------------|
| `tap(params)` | `Promise<boolean>` | Tap at (x, y) coordinates |
| `type(params)` | `Promise<boolean>` | Type text into focused input |
| `swipe(params)` | `Promise<boolean>` | Swipe from start to end over duration ms |
| `globalAction(params)` | `Promise<boolean>` | Perform global accessibility action |
| `isAvailable()` | `boolean` | Check if native bridge is available |
| `destroy()` | `void` | Clean up resources |

### Global Actions

| Action | Description |
|--------|-------------|
| `back` | Press back button |
| `home` | Go to home screen |
| `recents` | Open recent apps |
| `notifications` | Open notification shade |
| `quick_settings` | Open quick settings |
| `power_dialog` | Open power dialog |

### Types

```typescript
interface TapParams {
  x: number;
  y: number;
}

interface TypeParams {
  text: string;
}

interface SwipeParams {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
}

interface GlobalActionParams {
  action: string;
}
```

## Android Setup

1. Register the bridge handler in your `MainActivity.kt`:

```kotlin
import gyo.plugins.screen_action.ScreenActionBridge
import gyo.plugins.bridge.BridgeRegistry

// In onCreate():
BridgeRegistry.register("screen_action", ScreenActionBridge())
```

2. In your `AccessibilityService`, register the service reference:

```kotlin
import gyo.plugins.screen_action.ScreenActionBridge

// In onServiceConnected():
ScreenActionBridge.setService(this)

// In onDestroy():
ScreenActionBridge.clearService()
```

## Peer Dependencies

- `@gyo-framework/bridge@^0.1.3`

## License

MIT
