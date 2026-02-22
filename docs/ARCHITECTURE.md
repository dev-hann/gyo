# Gyo Architecture

## 시스템 개요

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI (gyo)                           │
│  create / run / build / install                             │
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
│   ├── commands/
│   │   ├── create/           # gyo create
│   │   ├── run/              # gyo run (Android/iOS)
│   │   └── build/            # gyo build
│   ├── templates/
│   │   ├── android/          # Android 프로젝트 템플릿
│   │   ├── ios/              # iOS 프로젝트 템플릿
│   │   └── lib/              # 웹 앱 템플릿 (React + Vite)
│   └── utils/
│       └── plugin-manager.ts

plugins/
├── bridge/                   # @gyo-framework/bridge
│   ├── src/                  # TypeScript API
│   ├── android/              # Kotlin 구현
│   └── ios/                  # Swift 구현
├── camera/                   # @gyo-framework/camera
└── geolocation/              # @gyo-framework/geolocation
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

## 플러그인 구조

```
@gyo-framework/plugin-name/
├── package.json             # npm 패키지 정보
├── src/
│   └── index.ts             # TypeScript API
├── dist/                    # 빌드 결과물
├── android/
│   ├── build.gradle.kts
│   └── src/main/kotlin/
│       └── PluginBridge.kt
├── ios/
│   ├── Package.swift
│   └── Sources/
│       └── PluginBridge.swift
└── examples/                # 사용 예제
    └── demo/
        ├── lib/             # React 앱
        └── README.md
```

## 빌드 산출물

- **Android**: APK/AAB (Gradle)
- **iOS**: IPA (Swift Package Manager + xcodebuild)
- **Web**: 정적 파일 (Vite 빌드 → 네이티브에 번들)
