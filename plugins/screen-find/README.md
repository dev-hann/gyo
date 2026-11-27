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

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Nothing in `MainActivity.kt` needs editing.

The handler finds elements through `@gyo-framework/accessibility`, which this plugin brings. The user enables that service once, under Settings, Accessibility:

```typescript
import { Accessibility } from '@gyo-framework/accessibility';

const accessibility = new Accessibility();
if (!(await accessibility.isEnabled()).enabled) {
  await accessibility.openSettings();
}
```

Until the service is enabled, `findByText` and `findById` return an empty result.

## Peer Dependencies

- `@gyo-framework/bridge@^0.2.0`

## License

MIT
