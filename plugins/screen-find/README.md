# @gyo-framework/screen-find

Gyo plugin for finding UI elements on screen via Android AccessibilityService.

## Installation

```bash
npm install @gyo-framework/screen-find
```

## Usage

```typescript
import { ScreenFind } from '@gyo-framework/screen-find';

const finder = new ScreenFind();

// Find elements by text
const textResults = await finder.findByText({ text: 'Settings', exact: false });

// Find elements by exact text
const exactResults = await finder.findByText({ text: 'OK', exact: true });

// Find elements by view ID
const idResults = await finder.findById({ id: 'com.example:id/button' });

// Check availability
if (finder.isAvailable()) {
  // running in WebView with native bridge
}

// Cleanup
finder.destroy();
```

## API

### `ScreenFind`

| Method | Returns | Description |
|--------|---------|-------------|
| `findByText(params)` | `Promise<FindResult>` | Find UI elements by text content |
| `findById(params)` | `Promise<FindResult>` | Find UI elements by view resource ID |
| `isAvailable()` | `boolean` | Check if native bridge is available |
| `destroy()` | `void` | Clean up resources |

### Types

```typescript
interface FindByTextParams {
  text: string;
  exact: boolean;
}

interface FindByIdParams {
  id: string;
}

interface ElementInfo {
  text: string;
  contentDescription: string;
  className: string;
  bounds: string;
  isClickable: boolean;
  isFocusable: boolean;
  isEditable: boolean;
  centerX: number;
  centerY: number;
}

interface FindResult {
  elements: ElementInfo[];
  count: number;
}
```

## Android Setup

Register the bridge handler in your `MainActivity.kt`:

```kotlin
import gyo.plugins.screen_find.ScreenFindBridge
import gyo.plugins.bridge.BridgeRegistry

// In onCreate():
BridgeRegistry.register("screen_find", ScreenFindBridge())
```

## Peer Dependencies

- `@gyo-framework/bridge@^0.1.3`

## License

MIT
