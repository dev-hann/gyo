# 브리지 코드 플러그인화 TODO

현재 `templates` 내에 포함된 네이티브 브리지 코드를 별도의 `plugins`으로 분리하여, 각 플랫폼 프로젝트에서 의존성으로 관리하도록 리팩토링하는 작업 계획입니다.

## 1. Android 브리지 플러그인화

- [ ] **플러그인 디렉토리 생성**: `plugins/gyo-android-bridge` 디렉토리를 생성합니다.
- [ ] **Android 라이브러리 모듈 설정**: 생성된 디렉토리에 Android 라이브러리 프로젝트를 구성합니다. (`build.gradle.kts`, `AndroidManifest.xml` 등)
- [ ] **코드 이동**: `templates/android/app/src/main/kotlin/{{PACKAGE_NAME}}/gyo/` 경로의 모든 Kotlin 파일을 `plugins/gyo-android-bridge/src/main/java/com/gyo/bridge/` 와 같은 새로운 패키지 경로로 이동합니다.
- [ ] **네임스페이스 정리**: 이동된 코드에서 `{{PACKAGE_NAME}}`과 같은 템플릿 변수를 제거하고, `com.gyo.bridge`와 같은 고정된 패키지 이름을 사용하도록 수정합니다.
- [ ] **Android 템플릿 수정**:
    - `templates/android/settings.gradle`에 `include ':gyo-android-bridge'`를 추가하고 `projectDir`를 설정하여 로컬 모듈을 포함시킵니다.
    - `templates/android/app/build.gradle`에 `implementation project(':gyo-android-bridge')` 의존성을 추가합니다.
    - `templates/android/app/src/main/kotlin/{{PACKAGE_NAME}}/MainActivity.kt`에서 브리지 관련 import 경로를 새로운 패키지 이름으로 수정합니다.
    - `templates/android/app/src/main/kotlin/{{PACKAGE_NAME}}/gyo/` 디렉토리를 삭제합니다.

## 2. iOS 브리지 플러그인화

- [ ] **플러그인 디렉토리 생성**: `plugins/gyo-ios-bridge` 디렉토리를 생성합니다.
- [ ] **Swift Package 설정**: 생성된 디렉토리에 `Package.swift` 파일을 만들어 `GyoIOSBridge`라는 이름의 라이브러리를 갖는 Swift Package로 구성합니다.
- [ ] **코드 이동**: `templates/ios/Sources/Gyo/` 경로의 모든 Swift 파일을 `plugins/gyo-ios-bridge/Sources/GyoIOSBridge/` 경로로 이동합니다.
- [ ] **iOS 템플릿 수정**:
    - `templates/ios/Package.swift` 파일에 `gyo-ios-bridge` 패키지를 로컬 의존성으로 추가합니다.
        ```swift
        .package(path: "../plugins/gyo-ios-bridge")
        ```
    - 메인 앱 타겟의 `dependencies`에 `GyoIOSBridge`를 추가합니다.
    - `templates/ios/Sources/WebViewContainer.swift` 등에서 `import Gyo`를 `import GyoIOSBridge`로 수정합니다.
    - `templates/ios/Sources/Gyo/` 디렉토리를 삭제합니다.

## 3. CLI 및 검증

- [ ] **`create` 명령어 수정**: `cli/src/commands/create.ts`의 `gyo create` 명령어 로직을 수정하여, 브리지 파일을 직접 복사하는 대신 위에서 구성한 플러그인 의존성을 추가하도록 변경합니다.
- [ ] **최종 검증**: 수정된 `gyo create` 명령어로 새 프로젝트를 생성하고, Android와 iOS 양쪽 플랫폼에서 모두 정상적으로 빌드 및 실행되는지 확인합니다.
