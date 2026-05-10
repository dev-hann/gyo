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
```

> See `src/Bridge.ts` and `src/types.ts` for full type definitions.

## Native Integration

> See [docs/BRIDGE_INTEGRATION.md](../../docs/BRIDGE_INTEGRATION.md) for Android/iOS integration specs.
