# @gyo-community/accessibility

Android's accessibility service, and what it makes possible: whether the service is on, reading the screen, finding its elements and acting on it.

## Installation

```bash
npm install @gyo-community/accessibility
```

## Usage

```typescript
import { Accessibility, ScreenReader, ScreenAction, ScreenFind } from '@gyo-community/accessibility';

// Nothing else works until the user has enabled the service
const accessibility = new Accessibility();
if (!(await accessibility.isEnabled()).enabled) {
  await accessibility.openSettings(); // the system's Accessibility settings
}

// Read the full tree of the active window
const reader = new ScreenReader();
const { root, packageName, windowName } = await reader.read();

// Find the nodes that hold a text
const { nodes, count } = await reader.find({ text: 'Settings' });

// Find elements by text, or by view ID
const finder = new ScreenFind();
const settings = await finder.findByText({ text: 'Settings', exact: false });
const button = await finder.findById({ id: 'com.example:id/button' });

// Tap, type, swipe and act globally
const screen = new ScreenAction();
await screen.tap({ x: 100, y: 200 });
await screen.type({ text: 'hello world' });
await screen.swipe({ startX: 100, startY: 500, endX: 100, endY: 200, duration: 300 });
await screen.globalAction({ action: 'back' });

// Each class is available only in a WebView with the native bridge
if (screen.isAvailable()) {
  // running in the app
}

// Release each class when it is done with
accessibility.destroy();
reader.destroy();
screen.destroy();
finder.destroy();
```

## API

Every class posts to the one `accessibility` bridge. Each creates its own bridge, so each has `isAvailable()` and `destroy()`.

### `Accessibility`

| Method | Returns | Description |
|--------|---------|-------------|
| `isEnabled()` | `Promise<AccessibilityStatus>` | Whether the service is enabled and connected |
| `openSettings()` | `Promise<{ opened: boolean; error?: string }>` | Opens the Accessibility settings. `error` says why when `opened` is `false` |
| `isAvailable()` | `boolean` | Whether the native bridge is present |
| `destroy()` | `void` | Releases the bridge |

#### Types

```typescript
interface AccessibilityStatus {
  enabled: boolean;
}
```

### `ScreenReader`

| Method | Returns | Description |
|--------|---------|-------------|
| `read()` | `Promise<ReadResult>` | Read full accessibility node tree |
| `find(params: FindParams)` | `Promise<ScreenReaderFindResult>` | Find nodes containing text |
| `isAvailable()` | `boolean` | Check if native bridge is available |
| `destroy()` | `void` | Clean up resources |

#### Types

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

interface ScreenReaderFindResult {
  nodes: NodeInfo[];
  count: number;
}
```

### `ScreenAction`

| Method | Returns | Description |
|--------|---------|-------------|
| `tap(params: TapParams)` | `Promise<boolean>` | Tap at (x, y) coordinates. `false` when the system did not take the gesture |
| `type(params: TypeParams)` | `Promise<boolean>` | Type text into focused input |
| `swipe(params: SwipeParams)` | `Promise<boolean>` | Swipe from start to end over duration ms. `false` when the system did not take the gesture |
| `globalAction(params: GlobalActionParams)` | `Promise<boolean>` | Perform global accessibility action |
| `isAvailable()` | `boolean` | Check if native bridge is available |
| `destroy()` | `void` | Clean up resources |

#### Global Actions

| Action | Description |
|--------|-------------|
| `back` | Press back button |
| `home` | Go to home screen |
| `recents` | Open recent apps |
| `notifications` | Open notification shade |
| `quick_settings` | Open quick settings |
| `power_dialog` | Open power dialog |

#### Types

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

### `ScreenFind`

| Method | Returns | Description |
|--------|---------|-------------|
| `findByText(params: FindByTextParams)` | `Promise<ScreenFindResult>` | Find UI elements by text content |
| `findById(params: FindByIdParams)` | `Promise<ScreenFindResult>` | Find UI elements by view resource ID |
| `isAvailable()` | `boolean` | Check if native bridge is available |
| `destroy()` | `void` | Clean up resources |

#### Types

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

interface ScreenFindResult {
  elements: ElementInfo[];
  count: number;
}
```

`@gyo-framework/screen-reader` and `@gyo-framework/screen-find` both exported a `FindResult`, of different shapes. Here they are `ScreenReaderFindResult` and `ScreenFindResult`.

## Android Setup

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Nothing in `MainActivity.kt` needs editing.

The module declares the service `GyoAccessibilityService`; the user has to enable it once under Settings, Accessibility. `Accessibility.openSettings()` opens that screen. Until the service is enabled:

| Class | What its methods return |
|-------|-------------------------|
| `ScreenReader` | `read()` a `null` root with an empty `windowName` and `packageName`; `find()` an empty result |
| `ScreenAction` | `false` |
| `ScreenFind` | An empty result |

## Peer Dependencies

- `@gyo-framework/bridge@^0.2.0`

## License

MIT
