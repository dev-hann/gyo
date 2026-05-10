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

## Commands

| Command | Purpose |
|---------|---------|
| `npm run test` | Run all tests |
| `npm run test:cli` | CLI tests only |
| `npm run test:watch` | Watch mode (in cli/) |
| `npm run verify` | lint + typecheck + test + build |
