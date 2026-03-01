# Gyo Framework

[![NPM version](https://img.shields.io/npm/v/gyo.svg?style=flat)](https://www.npmjs.com/package/gyo)
[![Build Status](https://img.shields.io/travis/com/gyo-framework/gyo/main.svg?style=flat)](https://travis-ci.com/gyo-framework/gyo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

React + Vite + TypeScript로 Android 및 iOS 앱을 쉽게 빌드할 수 있는 크로스 플랫폼 프레임워크입니다. 단일 웹 코드베이스로 두 플랫폼의 앱을 동시에 개발하고, 필요할 때 네이티브 기능과 통합할 수 있습니다.

## ✨ 주요 기능

- **🚀 간편한 CLI**: 프로젝트 생성, 실행, 빌드를 단순한 명령어로 관리
- **🌐 웹 기술 중심**: React와 Vite, TypeScript를 활용하여 친숙한 웹 기술로 앱 개발
- **💻 단일 코드베이스로 멀티 플랫폼 지원**: `lib` 폴더의 웹 코드를 Android와 iOS에서 공유하여 생산성 극대화
- **🌉 Built-in Bridge**: 별도 설치 없이 브릿지를 통한 웹과 네이티브 코드 간의 원활한 통신으로 카메라, GPS 등 기기 기능 사용
- **📦 템플릿 기반**: 검증된 프로젝트 템플릿으로 빠르게 시작
- **🛠️ 개발 도구**: Chrome DevTools, Safari Web Inspector 지원

## 📋 요구 사항

### 공통
- **Node.js**: 18.0 이상
- **npm**: 9.0 이상

### Android
- **Android Studio**: Hedgehog 이상
- **Android SDK**: API 21 이상
- **JDK**: 11 이상

### iOS
- **macOS**: 12.0 이상
- **Xcode**: 14.0 이상
- **CocoaPods**: 1.10 이상

## 🚀 빠른 시작

### 1. CLI 설치

```bash
cd cli
npm install -g .
```

### 2. 프로젝트 생성

```bash
gyo create my-awesome-app
cd my-awesome-app
```

### 3. 앱 실행

```bash
# Android 앱 실행 (Android Studio 에뮬레이터 또는 연결된 기기 필요)
gyo run android

# iOS 앱 실행 (macOS와 Xcode 필요)
gyo run ios
```

### 4. 빌드

```bash
# Android APK 빌드
gyo build android

# iOS IPA 빌드
gyo build ios
```

## 📂 프로젝트 구조

```
gyo/
├── cli/                    # CLI 도구 소스
│   ├── src/
│   │   ├── core/           # Types, errors, constants
│   │   ├── services/       # Business logic (config, device)
│   │   ├── utils/          # 유틸리티 함수
│   │   └── commands/       # 명령어 구현 (create, run, build, etc.)
│   ├── templates/          # 프로젝트 생성용 템플릿
│   │   ├── lib/            # React + Vite 웹 앱 템플릿
│   │   ├── android/        # Android 네이티브 프로젝트 템플릿
│   │   └── ios/            # iOS 네이티브 프로젝트 템플릿
│   └── package.json
├── plugins/                # 플러그인 패키지
│   └── bridge/             # 웹-네이티브 브릿지 라이브러리 (built-in)
├── docs/                   # 공식 문서
└── README.md
```

## 📖 CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `gyo create <name>` | 새 프로젝트 생성 |
| `gyo run android` | Android 앱 실행 |
| `gyo run ios` | iOS 앱 실행 |
| `gyo build android` | Android APK 빌드 |
| `gyo build ios` | iOS IPA 빌드 |
| `gyo config` | 설정 관리 |
| `gyo doctor` | 개발 환경 진단 |
| `gyo devices` | 연결된 기기 목록 |
| `gyo upgrade` | CLI 업그레이드 |
| `gyo debug <platform>` | 디버거 실행 (Chrome DevTools/Safari) |
| `gyo clean` | 빌드 캐시 정리 |

## 🔧 개발 가이드

### 로컬에서 CLI 개발

```bash
cd cli
npm install
npm run dev    # TypeScript 감시 컴파일
npm link       # 로컬 CLI 링크
```

### 프로젝트 생성 후 웹 개발

```bash
cd my-awesome-app/lib
npm install
npm run dev    # Vite 개발 서버 시작 (http://localhost:5173)
```

### 브릿지 사용

Gyo는 built-in bridge를 제공하여 웹과 네이티브 코드 간의 통신을 지원합니다.

```typescript
import { Bridge } from 'gyo-bridge';

// 기본 브릿지 생성
const bridge = new Bridge('my-bridge');

// 타임아웃 설정
const bridge = new Bridge('my-bridge', { timeout: 5000 });

// 네이티브 함수 호출
const result = await bridge.invoke('getData', { userId: 123 });
console.log(result);

// 네이티브로부터 이벤트 수신
const unsubscribe = bridge.listen((data) => {
  console.log('Received:', data);
});
```

## 📚 문서

- [아키텍처 가이드](./docs/ARCHITECTURE.md)
- [플러그인 API 참조](./docs/PLUGINS.md)

## 🤝 기여

Gyo는 오픈소스 프로젝트입니다. 버그 리포트, 기능 제안, 코드 기여 등 어떤 형태의 참여도 환영합니다.

기여 방법에 대한 자세한 내용은 `CONTRIBUTING.md` 파일을 참조하세요.

## 📝 라이선스

Gyo는 [MIT 라이선스](https://opensource.org/licenses/MIT) 하에 라이선스됩니다.

## 🗺️ 로드맵

- [x] 런타임 브릿지 기본 기능 구현
- [x] CLI `run` 및 `build` 명령어 완성
- [x] BridgeRegistry 시스템 구축
- [x] 카메라 플러그인 (`gyo-camera`)
- [x] CLI 업그레이드 도구 (`gyo upgrade`)
- [x] 디버깅 도구 (`gyo debug`)
- [x] Clean architecture 리팩토링
- [ ] GPS 플러그인 완성 (`gyo-geolocation`)
- [ ] 추가 네이티브 API 모듈 (파일시스템, 알림 등)
- [ ] 공식 문서 작성
- [ ] 첫 번째 릴리스 (v1.0.0)

## 📦 사용 가능한 플러그인

| 플러그인 | 상태 | 설명 |
|---------|------|------|
| `gyo-bridge` | ✅ 완료 | 웹-네이티브 통신 코어 (built-in) |
| `gyo-camera` | ✅ 완료 | 카메라 촬영 및 갤러리 접근 |
| `gyo-geolocation` | 🚧 개발중 | GPS 위치 추적 |

## 🆕 최신 업데이트

### v0.3.0 (최신)
- ✅ Clean architecture 리팩토링
- ✅ 플러그인 시스템 제거 (bridge는 built-in)
- ✅ Hot reload 제거 (WebSocket 기반)
- ✅ Layered architecture (core, services, utils, commands)
- ✅ 불필요한 의존성 제거 (chokidar, ws)

자세한 변경 사항은 [CHANGELOG.md](./CHANGELOG.md)를 참조하세요.

---

**문의사항이나 버그 리포트는 [GitHub Issues](https://github.com/gyo-framework/gyo/issues)를 이용해주세요.**
