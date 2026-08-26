# 프로젝트 SSOT

> 책임별 원본과 충돌 시 보호 규칙만 정의하는 핵심 문서다. 상세 내용은 각 원본에 두며 여기로 복제하지 않는다.

## 0. 책임별 SSOT

| SSOT | 책임 | 원본 |
|---|---|---|
| SSOT 1 — 요구사항 | 이 프로그램은 무엇을 해야 하는가 | [`docs/01-requirements.md`](../01-requirements.md) |
| SSOT 2 — 아키텍처 | 어떤 구조와 경계를 지켜야 하는가 | [`docs/06-architecture.md`](../06-architecture.md) |
| SSOT 3 — 하네스 운영 규칙 | 검증 실패 이후 어떻게 처리하는가 | [`02-verification.md`](02-verification.md) | 검증 실행 계약과 실패 처리의 원본 |
| SSOT 4 — 이번 작업 계약 | 이번 Issue에서 무엇을 바꾸는가 | 해당 [GitHub Issue](https://github.com/teiv-temp/inventory-harness-lab/issues) |

현재 등록된 GitHub Issue가 없으면 SSOT 4는 `Issue 미지정`이다. PR·커밋은 Issue를 대체하지 않는다.

## 1. 질문별 원본 라우팅

| 질문 | 최종 판단 원본 |
|---|---|
| 제품 요구사항·범위·완료 기준·재고 도메인 | [`docs/01-requirements.md`](../01-requirements.md) |
| 기술·데이터·트랜잭션·아키텍처 | [`docs/06-architecture.md`](../06-architecture.md) |
| 개별 작업 범위·수용 기준·상태 | 해당 GitHub Issue |
| 하네스 운영 규칙·검증 실패 처리 | [`02-verification.md`](02-verification.md) |
| 검증 실행 수단 | [`scripts/verify/`](../../scripts/verify/) |
| 현재 상태·미구현·다음 작업 | [`docs/HANDOVER.md`](../HANDOVER.md) |
| 사용자·업무 흐름 | [`docs/02-personas.md`](../02-personas.md), [`docs/03-scenarios.md`](../03-scenarios.md) |
| UI·접근성·반응형 | [`docs/05-design.md`](../05-design.md) |
| 기존 구현 계획·마일스톤 | [`docs/07-plan.md`](../07-plan.md) |
| 설치·실행 안내 | [`README.md`](../../README.md) |

### Protected 보호 경로

Protected는 아래 SSOT 및 에이전트 진입점의 변경을 검사한다.

- `docs/01-requirements.md`
- `docs/06-architecture.md`
- `docs/harness/`
- `AGENTS.md`
- `CLAUDE.md`

### Protected 승인 방법

- 보호 경로를 변경할 때는 GitHub Pull Request를 사용한다.
- Protected는 PR의 변경 범위와 현재 head 커밋을 확인한다.
- PR 작성자가 아닌 사람이 현재 head 커밋에 `APPROVED` 리뷰를 남겨야 통과한다. 작성자 자기 승인은 인정하지 않는다.
- 승인 후 head 커밋이 바뀌면 이전 승인은 유효하지 않으며, 새 head에 대한 승인이 필요하다.
- PR 정보나 리뷰 상태를 확인할 수 없으면 `NEEDS_HUMAN`으로 실패한다(fail-closed).
- 보호 경로 변경이 없으면 사람 승인 없이 통과한다.
- 로컬과 CI는 동일한 보호 경로·base/head·승인 조건을 사용한다. 로컬에서는 현재 브랜치의 GitHub PR 리뷰를 조회하고, CI에서는 이벤트의 PR과 GitHub 리뷰를 조회한다.

승인되지 않은 보호 경로 변경은 `NEEDS_HUMAN` 상태로 중단한다. 사람은 GitHub PR에서 변경 내용을 검토·승인한 후 검증을 다시 실행한다.

라우팅된 원본으로 판단할 수 없을 때만 필요한 보조 자료를 읽는다. 최초부터 모든 문서를 읽지 않는다.

## 2. 충돌 처리와 보호 경계

1. **참고 문서와 SSOT가 충돌하면 SSOT를 우선한다.** 참고 문서·코드 주석·현재 구현·PR·커밋은 SSOT를 덮어쓰지 못한다.
2. **GitHub Issue와 SSOT가 충돌하면 `NEEDS_HUMAN`을 선언하고 사람에게 판단을 요청한다.** Issue 또는 SSOT를 자동으로 우선하지 않는다.
3. **SSOT와 SSOT가 충돌해도 `NEEDS_HUMAN`을 선언하고 사람에게 판단을 요청한다.** AI가 어느 SSOT를 우선할지 결정하지 않는다.
4. **충돌이 발생하면 AI는 자신의 판단대로 행동하지 않는다.** 충돌 범위의 구현·문서 수정·데이터 변경·완료 선언을 중단한다.
5. **사람이 SSOT 수정을 명시적으로 요청하면 요청된 범위 안에서 반영한다.** 요청에 없는 정책·예외·우선순위는 추론해 추가하지 않는다. 요청 자체가 모호하거나 충돌하면 `NEEDS_HUMAN`으로 확인을 요청한다.

`NEEDS_HUMAN` 보고에는 충돌한 원본과 위치, 각 주장, 영향 범위, 사람에게 필요한 결정, 결정 전 보류할 행동을 포함한다.

## 3. 원본 변경 원칙

- 한 책임의 규칙은 해당 SSOT에만 기록한다. 다른 문서에는 복제하지 말고 링크한다.
- 도메인 정책은 SSOT 1, 기술 경계는 SSOT 2, 작업 범위는 SSOT 4가 소유한다.
- SSOT 3(하네스 운영 규칙)은 [`02-verification.md`](02-verification.md)가 소유한다. 기존 계획·테스트 기록을 새 규칙으로 승격하지 않는다.
- 원본이 없거나 충돌이 해소되지 않으면 임의로 보완하지 않고 `NEEDS_HUMAN`, `미정`, `확인 필요` 중 적절한 상태로 보고한다.
- 이 문서는 원본의 상세 요구사항·아키텍처·검증 결과·운영 절차를 소유하지 않는다. 해당 정보는 필요할 때만 원본 또는 부록에서 읽는다.

## 4. 구현 루프 기본값

유지보수 Issue의 `구현 루프 최대 횟수` 기본값은 **3회**다. 구현·검증·수정 반복이 3회 안에 종료 조건을 충족하지 못하면 AI는 반복을 계속하지 않고 `NEEDS_HUMAN` 상태로 전환해 실패 내역과 사람의 판단이 필요한 사항을 보고한다. 사람이 명시적으로 다른 상한을 승인한 경우에만 Issue에 기록된 값을 적용한다.

## 5. 상태 표기

| 상태 | 의미 |
|---|---|
| `NEEDS_HUMAN` | Issue↔SSOT 또는 SSOT↔SSOT 충돌. 사람 판단 전까지 보류 |
| `추후 생성` | 아직 원본·스크립트·절차가 없음 |
| `Issue 미지정` | 작업 계약이 될 Issue가 없음 |
| `미구현` | 요구사항 또는 계획에는 있으나 구현되지 않음 |
| `없음(정상)` | 현재 등록 대상이 없는 정상 상태 |
