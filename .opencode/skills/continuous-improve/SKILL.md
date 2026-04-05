---
name: continuous-improve
description: 무한 루프 지속 개선.
---

## 절대 규칙

1. Main은 Task 호출만 반복, 결과 수신 후 즉시 다시 Task 호출
2. 멈추지 않는다 — 커밋 후, 에러 후, 개선항목 없어도 계속
3. 정지: 사용자가 "stop"/"중지"/"잠깐" 명시 입력만
4. 1사이클 = 1개선, 같은 파일 연속 수정 금지
5. 포맷 외 출력 금지 — "요약", "총정리" 절대 출력 안 함

## Main 루프

반복해서 Task 호출:

```
Task(
  subagent_type: "general",
  prompt: "Cycle N 실행. 아래 절차와 포맷 준수.

  Phase 1: cli/에서 lint/typecheck/test 실행, 개선 후보 발굴.
  우선순위: P0(크래시)>P1(테스트없음)>P2(린트/에러처리)>P3(스타일)

  Phase 2: 최우선 1개 선택.

  Phase 3: 수정 후 lint+typecheck+test 통과 확인. 회귀 시 원복.
  금지: node_modules/dist/.git 수정, 새 npm 의존성 추가, 공개 API 시그니처 변경.

  Phase 4: 3사이클마다 git commit/push.

  출력 포맷 (이 형식 외 출력 금지):
  [Phase 1] {분석} | {후보수}개
  [PROCEED TO Phase 2]
  [Phase 2] {파일} | {이슈} | P{등급}
  [PROCEED TO Phase 3]
  [Phase 3] {변경내용} | lint:{결과} tsc:{결과} test:{N}pass
  [PROCEED TO Phase 4]
  [Phase 4] C{N}: {WHAT} — {WHY}
  [PROCEED TO Phase 1]
  "
)
```

Sub 결과 수신 → 즉시 같은 Task 다시 호출.
