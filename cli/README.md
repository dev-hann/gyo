# Gyo CLI

## 개발 환경 설정

### 초기 설정
```bash
cd cli
npm install
npm run build
npm link  # gyo 명령어를 전역으로 사용 가능하게 함
```

### 개발 모드 (자동 빌드)
CLI 코드를 수정하면 자동으로 빌드되어 바로 사용할 수 있습니다:

```bash
# 터미널 1: watch 모드 실행 (코드 수정 시 자동 빌드)
npm run dev

# 터미널 2: gyo 명령어 테스트
cd /path/to/test-project
gyo run
```

### 수동 빌드
```bash
npm run build
```

## 기능

이 폴더에는 `gyo` 프로젝트의 생성, 빌드, 실행 등 전체적인 라이프사이클을 관리하는 Command Line Interface (CLI) 도구가 포함되어 있습니다. TypeScript로 작성되었으며, 사용자가 `gyo` 명령어를 통해 프로젝트와 상호작용할 수 있는 인터페이스를 제공합니다.

### 주요 명령어

- `gyo create`: 새로운 `gyo` 프로젝트를 생성합니다.
- `gyo run`: Android 또는 iOS 플랫폼으로 앱을 실행합니다.
- `gyo build`: 앱을 배포용으로 빌드합니다.
- `gyo clean`: 빌드 캐시 및 임시 파일을 삭제합니다.
- `gyo config`: `gyo` 관련 설정을 확인하고 수정합니다.
- `gyo doctor`: 개발 환경에 필요한 요소들이 올바르게 설정되었는지 확인합니다.

## 앞으로 추가할 기능 (Todo List)

- [ ] `gyo test` 명령어 추가 (단위 및 통합 테스트 프레임워크 연동)
- [ ] `gyo lint` 명령어 추가 (프로젝트 전체의 코드 스타일 및 정적 분석 기능)
- [ ] 각 명령어에 대한 상세 도움말 기능 강화 (`gyo create --help`)
- [ ] 더 나은 오류 처리 및 사용자 피드백 메시지 개선
- [ ] 플러그인 시스템을 도입하여 CLI 기능의 확장성 제공
- [ ] 자동 업데이트 기능 추가 (`gyo upgrade`)