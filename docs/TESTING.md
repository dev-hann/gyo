# Testing

Test conventions for the Gyo framework.

## Test Structure

| Convention | Value |
|------------|-------|
| Location | `src/__tests__/*.test.ts` (co-located with source) |
| Framework | Jest + ts-jest |
| Environment | `node` (CLI), `jsdom` (bridge/plugins) |
| Config | `jest.config.cjs` per package |

## Naming

```
describe('unitName')
  describe('methodName')
    it('should <expected behavior>')
```

- `describe` matches the module, class, or function name
- `it` starts with `should`
- No `test()` — use `it()` consistently

## Entry Point

A command is tested the way the entry point runs it: `setPositionalArgs()`, `setOptions()`, `execute()`, in a real temporary directory. Mock only what leaves the process, such as a command the CLI spawns. Reaching into private members through brackets is what let the wrong plugin layout and three broken argument hand-offs pass.

The command line itself is covered by `program.test.ts`, which goes through Commander for every command.

| Need | How |
|------|-----|
| A project | `createTestProject()` in `__tests__/helpers/project.ts`: a project as `gyo create` leaves it, made with the real command in a temporary directory. The project is the working directory until `remove()`; `setConfig()` and `setWebApp()` give it a config and a web app |
| The real templates | `utils/paths` reads `import.meta.url`, which Jest cannot run; the test mocks it with the path to `cli/templates` |
| `inquirer` | ESM-only: every test file whose imports reach it mocks it |
| What the user is told | `silenceLogger()` in `__tests__/helpers/logger.ts`: the real logger with every method silenced |
| A process the CLI started | `fakeChildProcess()` in `__tests__/helpers/process.ts`. `signalProcessTree` and `process.kill` are mocked wherever a fake pid can reach them: the real ones signal a real process group |
| The spinner | `ora` is mocked |

## Pattern (AAA)

```
it('should ...', async () => {
  // Arrange — set up mocks and inputs

  // Act — call the function

  // Assert — verify result and mock calls
});
```

## Mock Policy

### What to mock

| Target | Reason |
|--------|--------|
| `fs-extra` operations | File system I/O |
| `child_process` (`exec`) | Shell command execution |
| `logger` | Side effect (console output) |
| `Bridge` (plugins) | Native communication |
| External API calls | Network I/O |

### What NOT to mock

| Target | Reason |
|--------|--------|
| Pure functions (`core/`) | Deterministic, no side effects |
| Business logic under test | Testing the actual code |
| TypeScript type checks | Compiler handles this |
| The file system, when the layout is what is tested | A mocked path answers what the test assumes: the wrong plugin layout passed that way while every published plugin failed |
| The built bundle | Covered by the local E2E suite, not by unit tests |

### Mock Pattern

```typescript
jest.mock('../utils/fs', () => ({
  readJson: jest.fn(),
  writeJson: jest.fn(),
  pathExists: jest.fn(),
}));

import { readJson } from '../utils/fs';

const mockedReadJson = readJson as jest.MockedFunction<typeof readJson>;
```

- Declare `jest.mock()` before importing the mocked module
- Cast with `jest.MockedFunction<typeof fn>` for type safety
- Call `jest.clearAllMocks()` in `beforeEach`

### Plugin Mock Pattern

```typescript
jest.mock('@gyo-framework/bridge', () => {
  const mockInvoke = jest.fn();
  const mockListen = jest.fn().mockReturnValue(() => {});

  return {
    Bridge: jest.fn().mockImplementation(() => ({
      invoke: mockInvoke,
      listen: mockListen,
    })),
  };
});
```

## Test Data

Use factory functions for reusable test fixtures:

```typescript
function mockExecResult(overrides = {}) {
  return {
    success: true,
    stdout: '',
    stderr: '',
    code: 0,
    ...overrides,
  };
}
```

## Layer-Specific Conventions

| Layer | Test Focus | Mock Scope |
|-------|-----------|------------|
| `core/` | Types, errors, constants | No mocks needed |
| `utils/` | Pure function output | Mock external deps only (fs, exec) |
| `services/` | Business logic branching | Mock utils + logger |
| `commands/` | CLI integration, option parsing | Mock services + utils + logger |

## Coverage

| Metric | Threshold |
|--------|-----------|
| Lines | 60% |
| Branches | 60% |
| Functions | 60% |
| Statements | 60% |

Run with coverage: `npx jest --coverage`. The thresholds apply only to a run with coverage; `npm test` does not collect it.

## App Testing with @gyo-framework/test-utils

Apps created with `gyo create` can use `@gyo-framework/test-utils` to mock bridge interactions.

### Installation

```bash
npm install -D @gyo-framework/test-utils
```

### Bridge Mocking

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

afterEach(() => mock.restore());
```

The real `Bridge` stays in place: the mock replaces only the native side, so the test runs the path the app runs in the WebView.

> See `plugins/test-utils/README.md` for the members of the mock.

### Platform Simulation

```typescript
import { setPlatform, cleanupPlatform } from '@gyo-framework/test-utils';

describe('Android-specific test', () => {
  beforeEach(() => setPlatform('android'));
  afterEach(() => cleanupPlatform());

  // window.androidBridge is now available
});
```

### Combining with Bridge

```typescript
import { Bridge } from '@gyo-framework/bridge';
import { setPlatform, cleanupPlatform } from '@gyo-framework/test-utils';

beforeEach(() => {
  setPlatform('android');
  // Bridge constructor will now find window.androidBridge
});

afterEach(() => {
  cleanupPlatform();
});
```

## E2E Tests

E2E tests validate the full CLI pipeline against real file system and build tools.

| Suite | File | Device Required | Description |
|-------|------|:---:|-------------|
| Local | `cli/e2e/local-pipeline.e2e.test.ts` | No | `gyo create` → file structure validation → lib build → bridge integration → commands on the built bundle |
| Android | `cli/e2e/android-compile.e2e.test.ts` | No | `gyo create` with every official plugin → `gyo install` → `./gradlew :app:assembleDebug` |
| Device | `cli/e2e/device-pipeline.e2e.test.ts` | Yes | Android APK build/install/run, iOS xtool build/install |

The Android suite needs the SDK platform the template compiles against and Java; it is skipped without them. It is the only test that compiles Kotlin, so it is where a plugin that does not build shows.

### Skip Handling

Suites skip what the machine lacks with `itIfAndroid()`, `itIfIOS()` and `itIfAndroidSdk()`. A skipped test appears as `skipped` in the report instead of passing without having run.

```typescript
import { itIfAndroid } from './helpers';

itIfAndroid()('should build Android APK', async () => {
  // only runs when Android device is connected
});
```

## Commands

Run from the repository root. The end-to-end scripts build first: the plugins read the bridge from its build output.

| Command | Purpose |
|---------|---------|
| `npm run test` | Unit tests of every package |
| `npm run test:e2e:local` | Local E2E, on the built bundle; no device |
| `npm run test:e2e:android` | Compiles a generated Android project with every official plugin; needs the Android SDK and Java |
| `npm run test:e2e:device` | Device E2E; needs a connected device |
| `npm run test:e2e` | Local, Android and device E2E |
| `npm run test:all` | Unit tests + local E2E |
| `npm run verify` | lint + typecheck + unit tests + build |
