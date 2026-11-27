# @gyo-framework/bridge

Core bridge for web-native communication.

## Installation

```bash
npm install @gyo-framework/bridge
```

## Exports

```typescript
class Bridge {
  constructor(name: string, options?: BridgeOptions)
  invoke<T>(method: string, data?: unknown): Promise<T>
  listen(callback: EventCallback): Unsubscribe
  getName(): string
  destroy(): void
}

interface BridgeOptions {
  timeout?: number // default: 30000
}

function requestPermissions(permissions: string[]): Promise<PermissionResult>

interface PermissionResult {
  granted: string[]
  denied: string[]
}
```

`requestPermissions` asks the user for Android run-time permissions and resolves once the user has answered. Only a permission the app declares in `android/app/src/main/AndroidManifest.xml` can be granted.

> See `src/Bridge.ts`, `src/permissions.ts` and `src/types.ts` for full type definitions.

## Testing an app

`@gyo-framework/bridge/testing` replaces the native side for the tests of an app. The real `Bridge` stays in place and makes its promises; the mock records what the page posts and answers it.

```typescript
import { AppLauncher } from '@gyo-community/app-launcher';
import { createBridgeMock } from '@gyo-framework/bridge/testing';

const mock = createBridgeMock('app_launcher');
const launcher = new AppLauncher();

it('should list the apps', async () => {
  const pending = launcher.listApps();
  await Promise.resolve(); // the Bridge posts on the next microtasks

  expect(mock.requests()[0].methodName).toBe('list_apps');
  mock.resolve({ apps: [], count: 0 });

  await expect(pending).resolves.toEqual({ apps: [], count: 0 });
});

afterEach(() => mock.restore());
```

| Member | Role |
|--------|------|
| `createBridgeMock(name)` | Replaces the native side of the bridge called `name` |
| `requests()` | What the page posted to native, oldest first |
| `resolve(data, request?)` | Answers a request, the latest by default, as native does on success |
| `reject(message, request?)` | Answers a request, the latest by default, as native does on failure |
| `emitEvent(data)` | Publishes an event to the listeners of the bridge |
| `restore()` | Removes the native object, so that the next test starts clean |
| `setPlatform(platform)`, `cleanupPlatform()` | Put the native object of `android`, `ios` or neither (`none`) on `window`, without recording anything |

> See [docs/TESTING.md](../../docs/TESTING.md) for how a test of the CLI uses them.

## Native Integration

> See [docs/BRIDGE_INTEGRATION.md](../../docs/BRIDGE_INTEGRATION.md) for Android/iOS integration specs.
