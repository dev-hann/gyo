# @gyo-framework/test-utils

Test utilities for the tests of a Gyo app.

## Installation

```bash
npm install -D @gyo-framework/test-utils
```

## Exports

### `createBridgeMock(name)`

Replaces the native side of the bridge called `name`. The real `Bridge` of the app stays in place and makes its promises; the mock only records what the page posts and answers it.

```typescript
import { AppLauncher } from '@gyo-framework/app-launcher';
import { createBridgeMock } from '@gyo-framework/test-utils';

const mock = createBridgeMock('app_launcher');
const launcher = new AppLauncher();

it('should list the apps', async () => {
  const pending = launcher.listApps();
  await Promise.resolve(); // the Bridge posts on the next microtasks

  expect(mock.requests()[0].methodName).toBe('list_apps');
  mock.resolve({ apps: [], count: 0 });

  await expect(pending).resolves.toEqual({ apps: [], count: 0 });
});

it('should pass on a failure of the native side', async () => {
  const pending = launcher.openApp({ packageName: 'missing' });
  await Promise.resolve();

  mock.reject('app not found');

  await expect(pending).rejects.toThrow('app not found');
});

afterEach(() => mock.restore());
```

| Member | Role |
|--------|------|
| `requests()` | What the page posted to native, oldest first |
| `resolve(data, request?)` | Answers a request, the latest by default, as native does on success |
| `reject(message, request?)` | Answers a request, the latest by default, as native does on failure |
| `emitEvent(data)` | Publishes an event to the listeners of the bridge |
| `restore()` | Removes the native object, so that the next test starts clean |

### `setPlatform(platform)`, `cleanupPlatform()`

Puts the native object of `android`, `ios` or neither (`none`) on `window`, without recording anything.

```typescript
import { setPlatform, cleanupPlatform } from '@gyo-framework/test-utils';

beforeEach(() => setPlatform('ios'));
afterEach(() => cleanupPlatform());
```

## Peer Dependencies

| Package | Version |
|---------|---------|
| `@gyo-framework/bridge` | ^0.2.0 |

## License

MIT
