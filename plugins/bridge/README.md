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

## Native Integration

> See [docs/BRIDGE_INTEGRATION.md](../../docs/BRIDGE_INTEGRATION.md) for Android/iOS integration specs.
