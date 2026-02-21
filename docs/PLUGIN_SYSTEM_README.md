# Plugin System

자동 플러그인 통합 시스템.

## 패키지 스코프

| 스코프 | 설명 |
|--------|------|
| `@gyo-framework/*` | 공식 플러그인 |
| `@gyo-community/*` | 커뮤니티 플러그인 |

## 설치

```json
{
  "dependencies": {
    "@gyo-framework/camera": "^0.1.0"
  }
}
```

```bash
gyo install
```

`gyo install` 수행 항목:
1. `npm install` (lib/)
2. `@gyo-framework/*` 패키지 감지
3. Android Gradle 설정
4. iOS Swift Package 설정

## CLI 명령

```bash
gyo install              # 설치 + 설정
gyo plugin list          # 설치된 플러그인 목록
gyo plugin validate      # 설정 검증
gyo plugin clean         # 캐시 정리
```

## 파일 구조

```
project/
├── .gyo/
│   ├── plugins.json     # 플러그인 매니페스트
│   └── cache/           # 플러그인 캐시
├── lib/
│   └── package.json     # 의존성 정의
├── android/
│   └── settings.gradle  # 자동 설정
└── ios/
    └── Package.swift    # 자동 설정
```

## 로컬 개발

```json
{
  "dependencies": {
    "@gyo-framework/my-plugin": "file:../plugins/my-plugin"
  }
}
```

## 이름 매핑

| 패키지 | Android 모듈 | iOS 패키지 |
|--------|-------------|-----------|
| `@gyo-framework/camera` | `gyo_framework_camera` | `GyoFrameworkCamera` |
| `@gyo-community/analytics` | `gyo_community_analytics` | `GyoCommunityAnalytics` |

## 상태

| 기능 | 상태 |
|------|------|
| 패키지 감지 | 완료 |
| Android 통합 | 완료 |
| iOS 통합 | 완료 |
| 빌드 시 자동 동기화 | 완료 |
