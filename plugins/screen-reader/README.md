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

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Nothing in `MainActivity.kt` needs editing.

The handler reads the screen through `@gyo-framework/accessibility`, which this plugin brings. The user enables that service once, under Settings, Accessibility:

```typescript
import { Accessibility } from '@gyo-framework/accessibility';

const accessibility = new Accessibility();
if (!(await accessibility.isEnabled()).enabled) {
  await accessibility.openSettings();
}
```

Until the service is enabled, `read()` and `find()` return an empty result.

## Peer Dependencies

- `@gyo-framework/bridge@^0.2.0`

## License

MIT
