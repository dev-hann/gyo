# Gyo 프로젝트 템플릿

## 기능

이 폴더에는 `gyo create` 명령어로 새로운 프로젝트를 생성할 때 사용되는 기본 템플릿들이 들어있습니다. 각 템플릿은 특정 플랫폼 또는 라이브러리에 대한 초기 설정과 기본 구조를 제공하여 사용자가 빠르게 개발을 시작할 수 있도록 돕습니다.

### 템플릿 구성

- **`android/`**: Android 네이티브 앱을 위한 템플릿입니다. 기본적인 `build.gradle` 설정, `MainActivity.kt` 및 웹뷰 설정이 포함되어 있습니다.
- **`ios/`**: iOS 네이티브 앱을 위한 템플릿입니다. `XcodeGen`을 사용한 프로젝트 구조(`project.yml`), `AppDelegate.swift`, `ViewController.swift` 등이 포함되어 있습니다.
- **`lib/`**: 플랫폼 간에 공유되는 웹 애플리케이션의 템플릿입니다. `React`, `Vite`, `TypeScript` 기반으로 구성되어 있으며, 실제 앱의 UI와 비즈니스 로직 대부분이 이곳에 작성됩니다.

## 앞으로 추가할 기능 (Todo List)

- [ ] **템플릿 버전 관리:** 각 플랫폼(Android/iOS)의 최신 OS 버전에 맞춰 템플릿 업데이트 및 유지보수
- [ ] **다양한 상태 관리 라이브러리 템플릿 추가:** `Redux Toolkit`, `Zustand`, `Recoil` 등 다양한 상태 관리 라이브러리가 사전 설정된 `lib` 템플릿 옵션 제공
- [ ] **Custom Template 기능:** 사용자가 자신만의 템플릿을 만들어 `gyo create --template <path>` 형태로 사용할 수 있는 기능 추가
- [ ] **데스크톱 플랫폼 템플릿 추가:** `Electron`이나 `Tauri`를 활용한 데스크톱(Windows, macOS, Linux)용 템플릿 추가 검토
- [ ] **템플릿 최적화:** 불필요한 파일을 제거하고 초기 빌드 속도를 개선하기 위한 템플릿 경량화 작업