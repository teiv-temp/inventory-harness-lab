# 프로젝트 SSOT

> 책임별 원본과 원본 간 판단 원칙을 등록한다. 상세 규칙은 각 책임의 원본에 둔다.

## 0. 책임별 SSOT

| SSOT | 책임 |
|---|---|
| SSOT 1 — 요구사항 | 이 프로그램은 무엇을 해야 하는가 |
| SSOT 2 — 아키텍처 | 어떤 구조와 경계를 지켜야 하는가 |
| SSOT 3 — 하네스 운영 규칙 | 검증과 구현·검증·PR/CI 절차를 어떻게 운영하는가 |
| SSOT 4 — 이번 작업 계약 | 이번 Issue에서 무엇을 바꾸는가 |

현재 등록된 GitHub Issue가 없으면 SSOT 4는 `Issue 미지정`이다. PR·커밋은 Issue를 대체하지 않는다.

## 1. 질문별 원본 라우팅

| 질문 | 최종 판단 원본 |
|---|---|
| 제품 요구사항·범위·완료 기준·재고 도메인 | [`docs/01-requirements.md`](../01-requirements.md) |
| 기술·데이터·트랜잭션·아키텍처 | [`docs/06-architecture.md`](../06-architecture.md) |
| 개별 작업 범위·수용 기준·상태 | 해당 GitHub Issue |
| 검증 실행·판정 | [`02-verification.md`](02-verification.md) |
| 구현·검증 반복·사람 판단·PR/CI 인계 | [`03-loop.md`](03-loop.md) |
| 검증 실행 수단 | [`scripts/verify/`](../../scripts/verify/) |
| 현재 상태·미구현·다음 작업 | [`docs/HANDOVER.md`](../HANDOVER.md) |
| 설치·실행 안내 | [`README.md`](../../README.md) |

## 2. 보호 경계와 권한

Protected 보호 경로는 사람이 소유하는 정책·지침 영역이다.

- `docs/01-requirements.md`
- `docs/06-architecture.md`
- `docs/harness/`
- `AGENTS.md`
- `CLAUDE.md`

애플리케이션 코드와 Issue별 테스트는 Issue 범위 안에서 AI가 수정할 수 있다. 보호 경로를 수정하기 전에는 사람이 대상·범위·사유를 명시하고, AI는 허용된 범위만 수정한다.

```text
Target: <대상>
Scope: <허용 범위>
Reason: <변경 사유>
Requested-By: human
```

요청 기록이 없거나 모호하면 AI는 수정하지 않는다. 이 기록과 보호 경계의 상세 집행은 사람 검토와 `03-loop.md` 절차를 따른다.

## 3. 충돌과 원본 변경

- 참고 문서와 SSOT가 충돌하면 SSOT를 따른다.
- Issue와 SSOT 또는 SSOT끼리 충돌하면 AI가 임의로 선택하지 않는다.
- 충돌 범위의 구현·문서 수정·데이터 변경·완료 선언은 사람 결정 전까지 보류한다.
- 원본에 없는 정책·예외·우선순위를 추측으로 추가하지 않는다.
- 한 책임의 규칙은 해당 원본에만 기록하고 다른 문서에는 복제하지 않는다.
- 충돌의 중단·보고·사람 처분·재개는 [`03-loop.md`](03-loop.md)를 따른다.

## 4. 기본값

유지보수 Issue의 구현 루프 최대 횟수 기본값은 **3회**다. Issue에 작업별 값이 있으면 그 값을 사용하며, 반복 절차와 판정 후속 처리는 [`03-loop.md`](03-loop.md)를 따른다.
