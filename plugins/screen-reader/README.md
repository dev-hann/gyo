# @gyo-framework/screen-reader

Gyo plugin for reading screen content via Android AccessibilityService.

## Installation

```bash
npm install @gyo-framework/screen-reader
```

## Usage

```typescript
import { ScreenReader } from '@gyo-framework/screen-reader';

const reader = new ScreenReader();

// Read full screen tree
const { root, packageName, windowName } = await reader.read();

// Find nodes by text
const { nodes, count } = await reader.find({ text: 'Settings' });

// Check availability
if (reader.isAvailable()) {
  // running in WebView with native bridge
}

// Cleanup
reader.destroy();
```

## API

### `ScreenReader`

| Method | Returns | Description |
|--------|---------|-------------|
| `read()` | `Promise<ReadResult>` | Read full accessibility node tree |
| `find(params)` | `Promise<FindResult>` | Find nodes containing text |
| `isAvailable()` | `boolean` | Check if native bridge is available |
| `destroy()` | `void` | Clean up resources |

### Types

```typescript
interface NodeInfo {
  text: string;
  contentDescription: string;
  className: string;
  bounds: string;
  isClickable: boolean;
  isEditable: boolean;
  children: NodeInfo[];
}

interface ReadResult {
  root: NodeInfo | null;
  windowName: string;
  packageName: string;
}

interface FindParams {
  text: string;
}

interface FindResult {
  nodes: NodeInfo[];
  count: number;
}
```

## Android Setup

Register the bridge handler in your `MainActivity.kt`:

```kotlin
import gyo.plugins.screen_reader.ScreenReaderBridge
import gyo.plugins.bridge.BridgeRegistry

// In onCreate():
BridgeRegistry.register("screen_reader", ScreenReaderBridge(this))
```

The `ScreenReaderBridge` reads from a static service reference. Your
`AccessibilityService` must set it when connected:

```kotlin
override fun onServiceConnected() {
    ScreenReaderBridge.service = this
}
```

## Peer Dependencies

- `@gyo-framework/bridge@^0.1.3`

## License

MIT
