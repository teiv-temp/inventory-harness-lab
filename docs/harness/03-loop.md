# 03. 구현·검증·PR/CI 반복 절차

> 이 문서는 SSOT 3 하네스 운영 규칙 중 하나의 Issue 작업 단위와 PR·CI 연결을 정의한다. 검증 실행·판정은 [`02-verification.md`](02-verification.md), 원본·보호 경계는 [`01-ssot.md`](01-ssot.md)가 소유한다.

## 1. 전체 흐름

```text
Issue 계약·원본 확인
  ↓
TRY 시작 → 구현/수정 → Local: npm run verify
  ↓
02 판정
  ├─ PASS → Issue 종료 조건 확인
  │           ├─ 미충족 → 다음 TRY
  │           └─ 충족 → 완료 코멘트 → PR
  ├─ 일반 FAIL → TRY 소진 → 남으면 다음 TRY
  └─ 판정 불능/사람 판단 → NEEDS_HUMAN

PR 생성/커밋 push → CI: npm run verify
  ├─ PASS → 독립 LLM Review → 사람 판단
  ├─ FAIL + 로컬 재현 → 로컬 구현·검증 루프 복귀
  └─ FAIL + 로컬 미재현 → NEEDS_HUMAN
```

## 2. 로컬 구현·검증 루프

### 작업 시작

GitHub Issue(SSOT 4)의 배경·범위·종료 조건·기계 검증·변경 금지 범위·`구현 루프 최대 횟수`와 관련 원본을 확인한다. 계약이 없거나 모호하거나 충돌하면 구현하지 않고 `NEEDS_HUMAN`으로 기록한다.

### TRY 집계

- Issue의 `구현 루프 최대 횟수`를 작업별 상한으로 사용한다.
- 값이 없으면 저장소 기본값 3회를 적용하고 첫 기록에 명시한다.
- 한 TRY는 `구현 또는 수정 → Local npm run verify → 02 판정`이다.
- 같은 변경 상태의 verify 재실행은 새 TRY가 아니다.
- 일반 FAIL은 TRY를 소진하고, 남은 횟수가 있으면 원인 수정 후 다음 TRY로 간다.
- 최대 횟수까지 해결하지 못하면 `NEEDS_HUMAN`으로 멈춘다.
- CI 실행·재실행과 LLM Review는 로컬 TRY에 포함하지 않는다.

### 판정별 행동

| 02 판정 | 다음 행동 | TRY |
|---|---|---:|
| PASS + 종료 조건 충족 | 완료 코멘트 기록 후 다음 단계 PR 진입 | 종료 |
| PASS + 종료 조건 미충족 | 부족한 조건 수정 | 소진 |
| 일반 FAIL | 원인 수정 후 재검증 | 소진 |
| 판정 불능/사람 판단 | `NEEDS_HUMAN` | 미소진 |

## 3. `NEEDS_HUMAN`과 사람 개입

다음은 자동 반복하지 않는다.

- Issue와 SSOT 또는 SSOT끼리 충돌
- 정보·재현 조건·종료 조건 부족
- 보호 경로·정책 변경 판단 필요
- Issue 범위 밖 변경 필요
- 제품·정책·아키텍처 의미를 사람이 결정해야 함
- 검증 결과를 신뢰할 수 없음
- 이전 기록을 복구할 수 없음
- 최대 TRY 도달

상태를 Issue에 기록하고 사람 결정 전에는 코드·테스트 수정, 검증 재실행, 범위 확대, TRY 초기화, commit·push·PR을 하지 않는다.

사람에게 다음 처분을 제시한다.

```text
1. 정보·기준 보완 후 TRY 1부터 재실행
2. 수정 불필요로 판단하고 PR 없이 Issue 종료
3. 판단 보류
```

결정에는 결정자·시각·내용·적용 범위·재개 단계 또는 종료를 포함한다. 잘못된 전제에서 만든 테스트는 회귀 기준에 편입하지 않고 사람에게 유지·수정·제거를 요청한다.

## 4. Issue 기록과 세션 인계

시도 시작·검증 결과·중단·사람 처분은 기존 코멘트를 수정·삭제·덮어쓰지 않고 Issue에 누적한다.

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

새 세션은 최신 누적 기록에서 Issue·종료 조건·최대/사용 TRY·현재 단계·branch/commit·마지막 판정·실패 단계·사람 결정·다음 행동을 복구한다. 기록이 없거나 불일치하면 새 TRY를 시작하지 않고 `NEEDS_HUMAN`으로 둔다. 현재 저장소에는 이를 자동 생성·검증하는 실행기가 없으므로 없는 횟수를 추측하지 않는다.

## 5. PR 진입과 CI

로컬 로컬 루프가 다음 세 조건을 모두 만족할 때 PR로 인계한다.

```text
마지막 Local Verify PASS
+ Issue 종료 조건 전부 충족
+ Issue 완료 코멘트 작성
→ PR 생성
```

PR 생성 또는 PR 브랜치에 커밋을 push하면 GitHub Actions가 CI에서 `npm run verify`를 실행한다. CI 실행·재실행은 로컬 TRY에 포함하지 않는다.

```text
CI FAIL
├─ 로컬에서 동일 실패 재현
│  → 기존 로컬 구현·검증 루프로 복귀
│  → 원인 수정 후 다음 Local TRY
└─ 로컬에서 재현되지 않음
   → NEEDS_HUMAN
   → 원인 추측·자동 수정·TRY 증가 금지
```

CI PASS 후에는 현재 프로젝트에서 별도로 확정된 LLM Review 실행 경로가 있을 때만 독립 검토를 진행한다. LLM Review는 의견이며 사람의 판단·승인·merge를 대신하지 않는다. 다음 단계 이후의 상세 승인·반려·merge와 Skill 재사용은 이 문서에서 확정하지 않는다.

## 6. 종료

```text
로컬: Local Verify PASS + Issue 종료 조건 + 완료 코멘트
→ 다음 단계: PR → CI
→ CI PASS: 다음 단계로 인계
→ CI 재현 FAIL: 로컬 복귀
→ CI 비재현 FAIL: NEEDS_HUMAN
```
