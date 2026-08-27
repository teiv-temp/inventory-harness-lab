# 03. 구현·검증·PR/CI 반복 절차

> 이 문서는 SSOT 3 하네스 운영 규칙 중 하나의 Issue 작업 단위와 그 결과의 PR/CI 인계를 정의한다. 검증 실행·판정은 [`02-verification.md`](02-verification.md), 원본·보호 경계는 [`01-ssot.md`](01-ssot.md)가 소유한다.

## 1. 전체 흐름

```text
Issue 계약 확인
  ↓
이전 상태·TRY 확인
  ↓
구현 / 수정
  ↓
Local: npm run verify
  ↓
02 판정
  ├─ PASS → Issue 종료 조건 확인
  │            ├─ 미충족 → 다음 TRY
  │            └─ 충족 → 완료 코멘트 → PR
  ├─ 일반 FAIL → TRY 1회 소진 → 남으면 수정 후 다음 TRY
  └─ 판정 불능/사람 판단 → NEEDS_HUMAN → 결정 전 정지

PR 생성 또는 커밋 push
  ↓
CI: 동일한 npm run verify
  ├─ PASS → 이 절차 종료, 다음 단계로 인계
  ├─ 로컬에서 동일 FAIL 재현 → 기존 구현·검증 루프로 복귀
  └─ 로컬에서 재현 불가 → NEEDS_HUMAN
```

## 2. 작업 시작

구현 전에 GitHub Issue(SSOT 4)의 배경·범위·종료 조건·기계 검증·변경 금지 범위·`구현 루프 최대 횟수`를 확인한다. 관련 SSOT와 충돌하거나 이전 `NEEDS_HUMAN`이 해소되지 않았거나 상태를 복구할 수 없으면 구현하지 않는다.

## 3. TRY와 횟수

- 실제 상한은 Issue의 `구현 루프 최대 횟수`다.
- Issue 값이 없으면 저장소 기본값 3회를 적용하고 그 사실을 기록한다.
- 한 TRY는 `구현 또는 수정 → Local npm run verify → 02 판정`이다.
- 같은 변경 상태의 verify 재실행은 새 TRY가 아니다.
- 일반 FAIL은 TRY 1회를 소진하고, 남은 횟수가 있으면 원인을 수정해 다음 TRY로 간다.
- 최대 횟수까지 해결하지 못하면 `NEEDS_HUMAN`으로 멈춘다.
- CI 실행·재실행과 CI 실패의 로컬 재현은 TRY에 포함하지 않는다.

## 4. 02 판정 후 행동

| 판정 | 다음 행동 | TRY |
|---|---|---:|
| PASS + 종료 조건 충족 | 완료 기록 | 종료 |
| PASS + 종료 조건 미충족 | 조건을 수정하고 다음 TRY | 소진 |
| 일반 FAIL | 원인 수정 후 다음 TRY | 소진 |
| 판정 불능·사람 판단 필요 | `NEEDS_HUMAN` | 미소진 |

02의 검증 기준과 exit code는 이 문서에서 다시 정의하지 않는다.

## 5. NEEDS_HUMAN

다음은 자동 반복하지 않는다.

- Issue·SSOT 또는 SSOT 간 충돌
- 정보·재현 조건·종료 조건 부족
- 보호 경로·정책 변경 판단 필요
- Issue 범위 밖 변경 필요
- 제품 의미·정책·아키텍처 선택 필요
- 검증 결과를 신뢰할 수 없음
- 이전 기록을 복구할 수 없음
- 최대 TRY 도달

상태를 Issue 코멘트에 남기고, 사람 결정 전에는 코드·테스트 수정, 검증 재실행, 범위 확대, TRY 초기화, commit·push·PR 생성을 하지 않는다.

사람에게 다음 세 가지 처분을 제시한다.

```text
1. 정보·기준 보완 후 TRY 1부터 재실행
2. 수정 불필요로 판단하고 PR 없이 Issue 종료
3. 판단 보류
```

처분 기록에는 결정자·시각·내용·적용 범위·재개 단계 또는 종료를 포함한다.

## 6. Issue 코멘트 기록

시도 시작·검증 결과·중단·사람 처분은 기존 기록을 지우거나 덮어쓰지 않고 누적한다.

```text
<!-- harness-loop: local -->
Loop: local
Issue: #<번호>
Try: <현재>/<최대>
Phase: implementation | verification | human-decision | complete
Branch: <branch>
Commit: <검증 대상 SHA>
Verify: npm run verify
Result: PASS | FAIL | NEEDS_HUMAN
Failed-Stage: <단계 또는 없음>
Consumes-Try: yes | no
Reason: <결과·중단·결정 사유>
Next: <다음 행동 또는 질문>
```

잘못된 전제에서 작성한 테스트는 회귀 기준에 편입하지 않고 사람에게 유지·수정·제거를 묻는다.

## 7. 세션·에이전트 인계

새 세션은 최신 Issue 기록을 읽고 다음을 복구한다.

```text
Issue·종료 조건
최대 TRY·사용 TRY
현재 Phase와 마지막 TRY
Branch·Commit
마지막 Verify 결과·실패 단계
NEEDS_HUMAN 사유
사람 처분·적용 범위·재개 단계
다음 허용 행동
```

기록이 없거나 Issue·branch·commit과 맞지 않거나 사람 판단이 해소되지 않았으면 새 TRY를 시작하지 않고 `NEEDS_HUMAN`으로 둔다. 현재 저장소에는 이 기록을 자동 생성·검증하는 실행기가 없으므로 기록이 없을 때 횟수를 추측하지 않는다.

## 8. PR 진입과 CI 복귀

로컬 반복은 다음 조건을 모두 만족하면 PR로 인계한다.

```text
마지막 Local Verify PASS
+ Issue 종료 조건 전부 충족
+ Issue 완료 코멘트 작성
→ PR 생성
```

PR 생성 또는 PR 커밋 push 후 CI는 `npm run verify`를 실행한다. CI 실행·재실행은 TRY에 포함하지 않는다.

```text
CI FAIL
├─ 로컬에서 동일 실패 재현
│  → 기존 구현·검증 루프로 복귀
│  → 원인 수정 후 다음 Local TRY
└─ 로컬에서 재현되지 않음
   → NEEDS_HUMAN
   → 원인 추측·자동 수정·TRY 증가 금지
```

CI PASS 이후의 별도 승인·Review·merge 절차는 이 문서에서 확정하지 않는다.

## 9. B7 종료

```text
Local Verify PASS
→ Issue 종료 조건 확인
→ 완료 코멘트 기록
→ 로컬 작업 단위 종료
```

또는 사람 판단 필요·최대 TRY 도달·상태 복구 불가 시 `NEEDS_HUMAN`으로 종료한다.
