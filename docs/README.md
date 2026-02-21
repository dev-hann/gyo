# Gyo Framework

React + Vite 기반 크로스플랫폼 모바일 프레임워크. Capacitor/Cordova와 유사.

## 프로젝트 구조

```
gyo/
├── cli/                    # CLI 도구 (gyo create, gyo run 등)
├── plugins/                # 네이티브 플러그인
│   ├── bridge/             # @gyo-framework/bridge - 웹-네이티브 통신 코어
│   ├── camera/             # @gyo-framework/camera - 카메라/갤러리
│   │   └── examples/       # 플러그인 예제
│   └── geolocation/        # @gyo-framework/geolocation - GPS 위치
│       └── examples/       # 플러그인 예제
└── docs/                   # 문서
```

## 패키지 네이밍

- 공식: `@gyo-framework/*` (npm 배포)
- 커뮤니티: `@gyo-community/*`

## 문서

| 문서 | 용도 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 시스템 아키텍처 |
| [PLUGINS.md](./PLUGINS.md) | 플러그인 API 스펙 |
| [CREATING_PLUGINS.md](./CREATING_PLUGINS.md) | 플러그인 개발 가이드 |
| [HOT_RELOAD.md](./HOT_RELOAD.md) | 핫 리로드 시스템 |

## CLI 명령

```bash
gyo create <name>          # 프로젝트 생성
gyo run <android|ios>      # 개발 서버 + 앱 실행
gyo build <platform>       # 프로덕션 빌드
gyo install                # npm install + 플러그인 설정
```

## 플러그인 사용

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
