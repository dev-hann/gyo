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

Run with coverage: `npx jest --coverage`

## E2E Tests

## App Testing with @gyo-framework/test-utils

Apps created with `gyo create` can use `@gyo-framework/test-utils` to mock bridge interactions.

### Installation

```bash
npm install -D @gyo-framework/test-utils
```

### Bridge Mocking

```typescript
import { createBridgeMock } from '@gyo-framework/test-utils';

describe('BarcodeScanner', () => {
  let mock: ReturnType<typeof createBridgeMock>;

  beforeEach(() => {
    mock = createBridgeMock('barcode');
  });

  afterEach(() => {
    mock.restore();
  });

  it('should handle scan result', async () => {
    mock.mockInvoke('scan').mockResolvedValue({ data: '1234' });
    // ...
  });

  it('should handle native events', () => {
    const callback = jest.fn();
    mock.mockListen(callback);
    mock.simulateEvent({ type: 'onDetected', value: 'xxx' });
    expect(callback).toHaveBeenCalled();
  });
});
```

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
| Local | `cli/e2e/local-pipeline.e2e.test.ts` | No | `gyo create` → file structure validation → lib build → bridge integration |
| Device | `cli/e2e/device-pipeline.e2e.test.ts` | Yes | Android APK build/install/run, iOS xtool build/install |

### Device Skip Handling

Device tests use `itIfAndroid()` / `itIfIOS()` helpers that automatically skip when no device is connected. Skipped tests appear as `skipped` in the report instead of false positives.

```typescript
import { itIfAndroid } from './helpers';

itIfAndroid()('should build Android APK', async () => {
  // only runs when Android device is connected
});
```

### Commands

| Command | Purpose |
|---------|---------|
| `npm run test` | Unit tests only |
| `npm run test:e2e:local` | Local E2E (no device needed) |
| `npm run test:e2e:device` | Device E2E (requires connected device) |
| `npm run test:e2e` | All E2E tests (local + device) |
| `npm run test:all` | Unit tests + local E2E |
| `npm run verify` | lint + typecheck + unit tests + build |

## Commands

| Command | Purpose |
|---------|---------|
| `npm run test` | Run unit tests |
| `npm run test:e2e:local` | Local E2E tests (no device) |
| `npm run test:e2e:device` | Device E2E tests |
| `npm run test:all` | Unit tests + local E2E |
| `npm run verify` | lint + typecheck + unit tests + build |
