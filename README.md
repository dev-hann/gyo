# Gyo Framework

[![NPM version](https://img.shields.io/npm/v/gyo.svg?style=flat)](https://www.npmjs.com/package/gyo)
[![Build Status](https://img.shields.io/travis/com/gyo-framework/gyo/main.svg?style=flat)](https://travis-ci.com/gyo-framework/gyo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

React + Vite + TypeScript로 Android 및 iOS 앱을 쉽게 빌드할 수 있는 크로스 플랫폼 프레임워크입니다. 단일 웹 코드베이스로 두 플랫폼의 앱을 동시에 개발하고, 필요할 때 네이티브 기능과 통합할 수 있습니다.

## ✨ 주요 기능

- **🚀 간편한 CLI**: 프로젝트 생성, 실행, 빌드를 단순한 명령어로 관리
- **🔥 Hot Reload**: 웹 코드 변경 시 앱 자동 새로고침 (WebSocket 기반)
- **🌐 웹 기술 중심**: React와 Vite, TypeScript를 활용하여 친숙한 웹 기술로 앱 개발
- **💻 단일 코드베이스로 멀티 플랫폼 지원**: `lib` 폴더의 웹 코드를 Android와 iOS에서 공유하여 생산성 극대화
- **🔌 플러그인 시스템**: `gyo-` 접두사로 자동 플러그인 감지 및 통합 (제로 컨피그레이션)
- **🌉 네이티브 통합**: 브릿지를 통한 웹과 네이티브 코드 간의 원활한 통신으로 카메라, GPS 등 기기 기능 사용
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
│   │   ├── commands/       # 명령어 구현 (create, run, build, etc.)
│   │   └── utils/          # 유틸리티 함수
│   └── package.json
├── plugins/                # 플러그인 패키지
│   └── bridge/             # 웹-네이티브 브릿지 라이브러리
├── templates/              # 프로젝트 생성용 템플릿
│   ├── lib/                # React + Vite 웹 앱 템플릿
│   ├── android/            # Android 네이티브 프로젝트 템플릿
│   └── ios/                # iOS 네이티브 프로젝트 템플릿
├── docs/                   # 공식 문서
├── examples/               # 예제 프로젝트
└── README.md
```

## 🎯 플러그인 시스템

Gyo는 자동 플러그인 통합 시스템을 제공합니다. `gyo-` 접두사로 시작하는 패키지는 자동으로 감지되어 설정됩니다.

### 플러그인 설치

```bash
# package.json에 gyo-camera 추가
# {
#   "dependencies": {
#     "gyo-camera": "^1.0.0"
#   }
# }

# 플러그인 설치 및 자동 설정
gyo install
```

### 플러그인 관리

```bash
# 설치된 플러그인 목록
gyo plugin list

# 플러그인 캐시 정리
gyo plugin clean

# 플러그인 구성 검증
gyo plugin validate
```

플러그인 시스템에 대한 자세한 내용은 [docs/PLUGIN_SYSTEM_README.md](./docs/PLUGIN_SYSTEM_README.md)를 참조하세요.

## 📖 CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `gyo create <name>` | 새 프로젝트 생성 |
| `gyo run android` | Android 앱 실행 (Hot Reload 자동 활성화) |
| `gyo run ios` | iOS 앱 실행 (Hot Reload 자동 활성화) |
| `gyo build android` | Android APK 빌드 |
| `gyo build ios` | iOS IPA 빌드 |
| `gyo install` | 의존성 설치 및 플러그인 설정 |
| `gyo plugin list` | 설치된 플러그인 목록 |
| `gyo plugin clean` | 플러그인 캐시 정리 |
| `gyo doctor` | 개발 환경 진단 |
| `gyo devices` | 연결된 기기 목록 |
| `gyo upgrade` | CLI 업그레이드 |
| `gyo debug <platform>` | 디버거 실행 (Chrome DevTools/Safari) |

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

### 플러그인 사용

```typescript
// 카메라 플러그인
import { Camera } from 'gyo-camera';

// 사진 촬영
const photo = await Camera.takePicture({ quality: 0.8 });
console.log('Base64:', photo.base64);

// 갤러리에서 선택
const image = await Camera.pickFromGallery();
```

## 📚 문서

- [플러그인 시스템 가이드](./docs/PLUGIN_SYSTEM_README.md)
- [플러그인 사용법](./docs/plugin-system-usage.md)
- [플러그인 퀵 스타트](./docs/plugin-quick-start.md)
- [커스텀 브릿지 가이드](./docs/CUSTOM_BRIDGE_GUIDE.md)

## 🤝 기여

Gyo는 오픈소스 프로젝트입니다. 버그 리포트, 기능 제안, 코드 기여 등 어떤 형태의 참여도 환영합니다.

기여 방법에 대한 자세한 내용은 `CONTRIBUTING.md` 파일을 참조하세요.

## 📝 라이선스

Gyo는 [MIT 라이선스](https://opensource.org/licenses/MIT) 하에 라이선스됩니다.

## 🗺️ 로드맵

- [x] 런타임 브릿지 기본 기능 구현
- [x] CLI `run` 및 `build` 명령어 완성
- [x] BridgeRegistry 시스템 구축
- [x] Hot Reload 인프라
- [x] 카메라 플러그인 (`gyo-camera`)
- [x] CLI 업그레이드 도구 (`gyo upgrade`)
- [x] 디버깅 도구 (`gyo debug`)
- [ ] GPS 플러그인 완성 (`gyo-geolocation`)
- [ ] 추가 네이티브 API 모듈 (파일시스템, 알림 등)
- [ ] 공식 문서 작성
- [ ] 첫 번째 릴리스 (v1.0.0)

## 📦 사용 가능한 플러그인

| 플러그인 | 상태 | 설명 |
|---------|------|------|
| `gyo-bridge` | ✅ 완료 | 웹-네이티브 통신 코어 |
| `gyo-camera` | ✅ 완료 | 카메라 촬영 및 갤러리 접근 |
| `gyo-geolocation` | 🚧 개발중 | GPS 위치 추적 |

## 🆕 최신 업데이트

### v0.2.0 (개발중)
- ✅ Hot Reload 시스템 (WebSocket 기반)
- ✅ BridgeRegistry 아키텍처
- ✅ Camera 플러그인
- ✅ `gyo upgrade` 명령어
- ✅ `gyo debug` 명령어
- ✅ 설정 가능한 Bridge 타임아웃
- ✅ 통일된 플러그인 네이밍 (`gyo-` 접두사)

자세한 변경 사항은 [CHANGELOG.md](./CHANGELOG.md)를 참조하세요.

---

**문의사항이나 버그 리포트는 [GitHub Issues](https://github.com/gyo-framework/gyo/issues)를 이용해주세요.**
