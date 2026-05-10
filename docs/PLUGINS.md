# Plugin API Specifications

Type signatures and contracts for Gyo plugins.

## @gyo-framework/bridge

Core bridge for web-native communication.

### Exports

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

interface BridgeRequest {
  bridgeName: string
  methodName: string
  data?: unknown
  callbackId: string
}

interface BridgeResponse {
  callbackId: string
  success: boolean
  data?: unknown
  error?: string
}

interface BridgeEvent {
  bridgeName: string
  data: unknown
}

type EventCallback = (data: unknown) => void
type Unsubscribe = () => void
```

> See `plugins/bridge/src/types.ts` for full type definitions.
> See [BRIDGE_INTEGRATION.md](./BRIDGE_INTEGRATION.md) for native handler protocols.

## Plugin Development Conventions

### Naming

| Scope | Usage | Example |
|-------|-------|---------|
| `@gyo-framework/` | Official | `@gyo-framework/barcode` |
| `@gyo-community/` | Community | `@gyo-community/analytics` |

### Structure

```
@gyo-framework/<name>/
├── package.json
├── src/
│   ├── index.ts        # Exported API
│   └── __tests__/
├── android/            # Kotlin implementation (optional)
│   └── src/main/kotlin/gyo/plugins/<name>/
└── ios/                # Swift implementation (optional)
    └── Sources/
```

### Rules

1. Must depend on `@gyo-framework/bridge` as `peerDependencies`.
2. Export a class with static methods wrapping `Bridge.invoke()`.
3. Define and export all TypeScript interfaces for input/output.
4. Register native handlers via `BridgeRegistry` on each platform.

> See `plugins/README.md` for package listing.
