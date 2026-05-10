# @gyo-framework/test-utils

Test utilities for Gyo framework apps.

## Installation

```bash
npm install -D @gyo-framework/test-utils
```

## Exports

### `createBridgeMock(name)`

Creates a mock bridge for testing bridge interactions.

```typescript
import { createBridgeMock } from '@gyo-framework/test-utils';

const { mockInvoke, mockListen, simulateEvent, restore } = createBridgeMock('barcode');

mockInvoke('scan').mockResolvedValue({ data: '1234567890' });

const callback = jest.fn();
mockListen(callback);
simulateEvent({ type: 'onDetected', value: 'xxx' });

restore();
```

### `setPlatform(platform)`

Sets up the window environment for Android or iOS bridge.

```typescript
import { setPlatform, cleanupPlatform } from '@gyo-framework/test-utils';

beforeEach(() => setPlatform('android'));
afterEach(() => cleanupPlatform());
```

## Peer Dependencies

| Package | Version |
|---------|---------|
| `@gyo-framework/bridge` | ^0.1.3 |
