# 03. 구현·검증 반복 절차

> 이 문서는 `02-verification.md`가 반환한 검증 판정 이후의 구현·수정·재검증 절차를 소유한다. 원본 등록·보호 경계·충돌 원칙은 [`01-ssot.md`](01-ssot.md), 검증 단계와 판정은 [`02-verification.md`](02-verification.md)가 소유한다.

## 1. 책임과 입력

`03-loop`는 다음 입력을 받아 다음 행동을 하나로 결정한다.

- 작업 계약인 GitHub Issue
- Issue의 종료 조건·변경 범위·최대 구현 루프 횟수
- 현재 branch와 PR
- 이전 loop 상태
- `npm run verify`가 반환한 `02`의 판정

가능한 결과는 다음 셋이다.

```text
다음 시도에서 수정
완료(PASSED)
사람 판단 대기(NEEDS_HUMAN)
```

이 문서는 제품 요구사항, 재고·아키텍처 규칙, Protected 승인 알고리즘, 검증 단계의 내부 판정을 복제하지 않는다.

## 2. 작업 시작 전 계약 확인

구현을 시작하기 전에 다음을 확인한다.

1. GitHub Issue가 이번 작업의 계약인지 확인한다.
2. Issue의 종료 조건·변경 범위·변경 금지 범위를 읽는다.
3. Issue의 `구현 루프 최대 횟수`를 읽는다.
4. 현재 branch가 `main`이 아닌 Issue 작업 branch인지 확인한다.
5. 관련 SSOT와 Issue가 충돌하지 않는지 확인한다.
6. 이전 시도와 `NEEDS_HUMAN` 대기 상태를 복구한다.

계약·최대 횟수·이전 상태를 읽을 수 없거나 서로 맞지 않으면 구현하지 않고 `NEEDS_HUMAN`으로 둔다.

## 3. Issue별 최대 횟수

- 실제 상한은 Issue에 기록된 `구현 루프 최대 횟수`다.
- SSOT의 기본값은 **3회**다.
- Issue 템플릿의 허용값은 `1`, `2`, `3`, `4`, `5`다.
- Issue에 값이 없거나 허용되지 않은 값이면 기본값을 추측하지 않고 사람에게 확인한다.
- 시도 번호는 1부터 시작하며 감소하지 않는다.

## 4. 시도의 정의와 집계

한 번의 시도는 다음 전체 묶음이다.

```text
Issue 계약·현재 상태 확인
→ Issue 범위 안에서 구현 또는 수정
→ 로컬 npm run verify 1회 완료
→ 02의 판정 분류
```

- 구현 또는 실패 원인 수정 후 검증을 시작할 때 새 `attempt_id`를 만든다.
- 같은 변경 상태·같은 `attempt_id`에서 검증을 다시 실행하는 것은 새 시도가 아니다.
- PASS와 일반 FAIL 모두 검증이 끝나면 해당 시도 1회를 사용한 것으로 기록한다.
- 단순한 명령 재실행·로그 확인·환경 재현은 같은 시도에 포함한다.
- CI 실행, AI 검토, 사람 검증, 승인 대기는 로컬 구현 시도 횟수에 포함하지 않는다.

권장 기록 형식:

```text
Attempt-Id: issue-<번호>-<증가번호>
Attempt-No: <사용 횟수>/<최대 횟수>
Issue: #<번호>
Branch: <branch>
PR: #<번호 또는 없음>
Source-Head: <검증 대상 SHA>
Verify: npm run verify
Result: PASS | GENERAL_FAILURE | NEEDS_HUMAN
Failed-Stage: <단계 또는 없음>
Consumes-Attempt: yes | no
Next-Action: <다음 행동>
```

## 5. `02` 판정 이후 절차

### 5.1 PASS

1. Issue 종료 조건을 모두 다시 확인한다.
2. 필요한 사람 확인 사항이 있으면 사람 검증 대기로 둔다.
3. 완료 보고에 마지막 `attempt_id`, 사용 횟수/최대 횟수, 검증 SHA를 기록한다.
4. 커밋·push·PR·merge는 사람의 요청과 저장소 규칙에 따른다.

### 5.2 일반 검증 실패

Types, Lint, Architecture Check, Test, Build 또는 Issue 기계 검증이 실패하고 AI가 Issue 범위 안에서 원인을 수정할 수 있으면:

```text
실패 단계·결과 기록
→ 현재 attempt 종료(1회 소진)
→ 남은 횟수 확인
→ 남은 횟수가 있으면 다음 attempt 생성
→ 범위 안에서 수정
→ npm run verify
```

최대 횟수까지 해결하지 못하면 추가 자동 수정을 중단하고 `NEEDS_HUMAN`으로 둔다.

### 5.3 사람 판단 필요

다음은 일반 실패로 재시도하지 않는다.

- SSOT와 Issue 또는 SSOT끼리 충돌
- Protected 경로 수정 또는 승인·범위 확인 필요
- Issue 범위 밖 수정 필요
- Issue 계약·종료 조건·최대 횟수 누락 또는 모호
- 제품 의미·정책·아키텍처 선택 필요
- 검증 규칙만으로 기대 결과를 판정할 수 없음
- 환경·도구 오류로 판정 결과를 신뢰할 수 없음
- 이전 사람 결정의 적용 범위가 현재 변경과 맞지 않음
- loop 상태가 없거나 손상되었거나 Issue·branch·PR·SHA와 맞지 않음

이때 `Consumes-Attempt: no`로 기록하고 즉시 `NEEDS_HUMAN`으로 중단한다. 사람 결정 전에는 코드 수정·추가 검증·범위 확대·카운터 초기화를 하지 않는다.

## 6. 상태 전이

```text
NOT_STARTED
→ IN_PROGRESS(attempt 1..N)
→ VERIFYING
→ PASSED
```

일반 실패:

```text
VERIFYING → FAILED (attempt consumed)
FAILED → IN_PROGRESS (next attempt)
FAILED(attempt N) → NEEDS_HUMAN
```

사람 개입:

```text
IN_PROGRESS/VERIFYING → NEEDS_HUMAN (attempt not consumed)
NEEDS_HUMAN → HUMAN_DECIDED
HUMAN_DECIDED → IN_PROGRESS (사람이 허용한 행동)
```

불변식:

- `PASSED`와 `NEEDS_HUMAN`은 자동 반복의 종료 상태다.
- `attempts`는 감소하지 않는다.
- 같은 `attempt_id`는 두 번 집계하지 않는다.
- `NEEDS_HUMAN`에서 사람의 결정 없이 재개할 수 없다.
- 사람 결정만으로 카운터를 초기화하지 않는다.
- 새 요구사항이나 범위 변경은 Issue 계약을 먼저 갱신한다.

## 7. 사람 판단 보고

`NEEDS_HUMAN`으로 중단할 때 다음을 남긴다.

- 상태와 사유
- Issue 번호·제목·계약
- branch·PR·현재 SHA
- 현재 시도·최대 시도·남은 횟수
- 실패 단계 또는 판단이 필요한 원본과 위치
- 충돌하거나 불명확한 주장
- 영향 범위
- 사람이 답할 단일 질문
- 결정 전 금지 행동
- 결정 후 재개할 단계
- `Consumes-Attempt: yes/no`

사람이 결정하면 결정 내용·적용 범위·결정자·시각을 작업 상태와 Issue/PR 기록에 남긴 뒤 재개한다. AI가 사람의 결정을 대신 기록하거나 `NEEDS_HUMAN`을 해제하지 않는다.

## 8. 세션·에이전트 전환

새 세션은 구현 전에 Issue/PR의 이전 작업 기록 또는 동등한 상태 기록을 읽고 다음을 확인한다.

- Issue와 최대 횟수
- branch·PR
- 사용한 attempts와 현재 `attempt_id`
- 상태와 phase
- 마지막 검증 SHA·결과·실패 단계
- pending human decision
- 사람 결정의 적용 범위
- 다음에 허용된 행동

상태가 없으면 작업을 시작하지 않고 `NEEDS_HUMAN`으로 보류한다. 상태가 손상되었거나 Issue·branch·PR·SHA가 맞지 않아도 동일하다. 상태 기록은 AI가 attempts를 낮추거나 사람 대기를 해제할 수 없도록 사람·CI 기록과 함께 대조해야 한다.

## 9. PR·CI·사람 검증

로컬에서 다음을 모두 만족해야 PR 단계로 이동한다.

1. 마지막 로컬 `npm run verify` PASS
2. Issue 종료 조건 모두 충족
3. 필요한 완료 보고 기록

PR 이후:

- CI PASS 후 저장소가 정한 AI 검토를 수행하되 AI 검토는 경고이며 사람 검증을 대체하지 않는다.
- CI FAIL이 로컬에서 같은 원인으로 재현되면 기존 attempts를 이어서 일반 실패 절차로 돌아간다.
- CI FAIL이 로컬에서 재현되지 않으면 추측하지 않고 `NEEDS_HUMAN`으로 둔다.
- 사람 검증 반려가 기존 계약의 수정이면 명시된 다음 attempt로 진행한다.
- 사람 검증 반려가 요구사항·범위 변경이면 Issue 계약과 필요한 SSOT를 먼저 갱신한다.
- 반려 의미가 모호하면 질문하고 답변 전 구현하지 않는다.
- 사람 검증 통과와 merge는 사람의 책임이다.

## 10. 완료·중단

완료는 다음을 모두 만족할 때다.

- 02의 검증 PASS
- Issue 종료 조건 충족
- 필요한 사람 검증 기록 완료
- attempts와 마지막 검증 SHA 기록

다음은 자동 중단이다.

- 사람 판단 필요
- 최대 attempts 도달
- 상태 또는 작업 계약 복구 불가

## 11. 현재 구현 상태

현재 저장소에는 이 절차를 자동으로 실행하거나 시도 횟수를 영속 저장하는 `loop` CLI가 없다. 이 문서는 사람과 AI가 작업 단위를 동일하게 이해하고 기록하기 위한 운영 원본이다. 상태 저장과 자동 집계가 필요해지면 이 문서의 절차와 기록 형식을 먼저 검토한 뒤 별도 구현한다.

자동 상태 기록이 없으므로 새 세션에서 이전 작업을 복구할 때는 Issue·PR 기록과 인계 기록을 확인한다. 이전 상태를 확인할 수 없으면 새 시도를 시작하지 않고 `NEEDS_HUMAN`으로 둔다.

상태 기록이 도입되더라도 사람의 Protected 승인 기록을 대체할 수 없다.
