# Gyo Architecture

## 시스템 개요

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI (gyo)                           │
│  create / run / build / config / doctor / devices / debug   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Android     │     │   WebView     │     │     iOS       │
│   (Kotlin)    │     │  (React/Vite) │     │   (Swift)     │
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Bridge System   │
                    │  @gyo-framework/  │
                    │     bridge        │
                    └───────────────────┘
```

## 통신 흐름

```
Web (JS/TS)                 Native (Kotlin/Swift)
    │                              │
    │  bridge.call('method', {})   │
    │─────────────────────────────▶│
    │                              │ handleCall()
    │                              │ 실행
    │  { result }                  │
    │◀─────────────────────────────│
    │                              │
```

## 디렉토리 구조

```
cli/
├── src/
│   ├── core/                 # Types, errors, constants
│   │   ├── types.ts
│   │   ├── errors.ts
│   │   └── constants.ts
│   ├── services/             # Business logic
│   │   ├── config.service.ts
│   │   └── device.service.ts
│   ├── utils/                # Utilities
│   │   ├── logger.ts
│   │   ├── exec.ts
│   │   └── fs.ts
│   ├── commands/             # CLI commands
│   │   ├── base/             # Base command classes
│   │   ├── build/            # gyo build
│   │   ├── run/              # gyo run
│   │   ├── create.ts
│   │   ├── config.ts
│   │   ├── devices.ts
│   │   ├── doctor.ts
│   │   ├── debug.ts
│   │   ├── upgrade.ts
│   │   └── clean.ts
│   └── index.ts              # Entry point
└── templates/                # Project templates
    ├── gyo.config.json
    ├── android/              # Android project template
    ├── ios/                  # iOS project template
    └── lib/                  # Web app template (React + Vite)

plugins/
├── bridge/                   # Built-in bridge library
│   ├── src/                  # TypeScript API
│   ├── android/              # Kotlin implementation
│   └── ios/                  # Swift implementation
├── camera/                   # Camera plugin
└── geolocation/              # Geolocation plugin
```

## 런타임 컴포넌트

### 개발 모드 (`gyo run`)

```
┌─────────────┐         ┌─────────────┐
│ Vite Server │────────▶│   Device    │
│   :3000     │         │   App       │
└─────────────┘         └─────────────┘
```

### 프로덕션

```
┌─────────────┐         ┌─────────────┐
│  Bundled    │────────▶│   Native    │
│  JS/CSS     │         │   WebView   │
└─────────────┘         └─────────────┘
```

## Bridge 인터페이스

### TypeScript

```typescript
import { Bridge } from '@gyo-framework/bridge'

const bridge = new Bridge('@gyo-framework/plugin-name')
const result = await bridge.call('methodName', { param: 'value' })
```

### Android (Kotlin)

```kotlin
class PluginBridge(context: Context) : BridgeInterface {
    override val name = "@gyo-framework/plugin-name"
    
    override fun handleCall(method: String, params: JsonObject?): BridgeResponse {
        return when (method) {
            "methodName" -> BridgeResponse.success(mapOf("result" to "value"))
            else -> BridgeResponse.error("Unknown method")
        }
    }
}
```

### iOS (Swift)

```swift
class PluginBridge: BridgeInterface {
    let name = "@gyo-framework/plugin-name"
    
    func handleCall(method: String, params: [String: Any]?) async -> BridgeResponse {
        switch method {
        case "methodName": return .success(["result": "value"])
        default: return .error("Unknown method")
        }
    }
}
```

## Built-in Bridge 구조

Bridge는 이제 CLI에 내장되어 있으며, 별도의 플러그인 설치 없이 사용할 수 있습니다.

```
plugins/bridge/
├── package.json             # npm 패키지 정보
├── src/
│   └── index.ts             # TypeScript API
├── dist/                    # 빌드 결과물
├── android/
│   ├── build.gradle.kts
│   └── src/main/kotlin/
│       └── BridgeInterface.kt
└── ios/
    ├── Package.swift
    └── Sources/
        └── BridgeInterface.swift
```

## 빌드 산출물

- **Android**: APK/AAB (Gradle)
- **iOS**: IPA (Swift Package Manager + xcodebuild)
- **Web**: 정적 파일 (Vite 빌드 → 네이티브에 번들)
