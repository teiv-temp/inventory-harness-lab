# SSOT 부록 — 증적·갭 인벤토리

> 일상적인 판단에는 읽지 않는다. 최초 기준·후속 변경·검증 증적·원본 부재·문서화 갭을 확인할 때만 참조한다. 핵심 책임과 충돌 정책은 [`ssot.md`](ssot.md)에 있다.

## 1. 최초 문서 기준

최초 문서 기준 커밋은 [`0072af9`](https://github.com/teiv-temp/inventory-harness-lab/commit/0072af9683a55557d07c466fa3a0fb33a979ac5b)다.

- 일시: 2026-08-18 23:13:01 +09:00
- 메시지: `재고관리 PoC 초기 커밋 — M1~M6 구현 + 기획 문서`
- 당시 문서: `README.md`, `docs/01-requirements.md`~`docs/07-plan.md`, `docs/HANDOVER.md`
- 최초 기준의 아키텍처 함수명: `cancelMovement()`
- 최초 기준의 팝업 브라우저 검증: 미완료

최초 원본 후보:

| 영역 | 원본 후보 |
|---|---|
| 요구사항·범위·DoD | [`docs/01-requirements.md`](../01-requirements.md) |
| 사용자·업무 흐름 | [`docs/02-personas.md`](../02-personas.md), [`docs/03-scenarios.md`](../03-scenarios.md) |
| UX·디자인 | [`docs/05-design.md`](../05-design.md), [`mockups/final.html`](../../mockups/final.html) |
| 아키텍처·기술·도메인 | [`docs/06-architecture.md`](../06-architecture.md) |
| 검증 기준·계획 | `docs/01-requirements.md`의 DoD, [`docs/07-plan.md`](../07-plan.md) |
| 당시 구현·검증 상태 | [`docs/HANDOVER.md`](../HANDOVER.md) |
| 실행 안내 | [`README.md`](../../README.md) |

## 2. 후속 변경

- `c4aa0b9` (2026-08-19): `HANDOVER.md`에 팝업 정산 브라우저 검증 결과와 스크린샷 추가
  - 누적 반출 160개, 잔여 42개, 시식 5개, 판매 113개, 소진율 74%
- `31f1161` (2026-08-19): `docs/06-architecture.md`의 `cancelMovement()`를 `reverseMovement()`로 명칭 정정
- `abc4bb8` (2026-08-26): 문서 변경 없이 시드 데이터만 변경

후속 변경은 최초 문서 기준을 소급해 바꾸지 않는다.

## 3. 검증 증적과 당시 공백

최초 `HANDOVER.md` 기준:

- M1~M6 완료, M7 미완료
- `/expiry`, `/history`, `/settings` 미구현 또는 404
- 재고 조정 미완료
- 팝업 정산 브라우저 클릭 검증 미완료
- 한글 IME·긴 상품명·동시 출고·전체 QA 미검증

`docs/07-plan.md`에는 다음 검증 계획이 있었으나, 최초 기준에서 모든 항목의 완료 증적은 확인되지 않는다.

- FEFO·LEFO와 다중 로트 분할
- 과잉 출고 롤백 및 총재고 불변
- 팝업 누적 정산·시식 한도·상쇄 후 원복
- 모바일 390px·PC 1280px·44px 터치 영역
- 한글 IME·긴 상품명·잘못된 수량/날짜·0 로트
- 두 브라우저 동시 출고·WAL·서버 재시작

## 4. 원본이 없는 영역과 문서화 갭

### 외부 업무 원자료

- 사용자 인터뷰·현장 관찰
- 현행 재고 시트·업무 매뉴얼·팝업 정산 양식
- 실제 풀필먼트 업체명·계약·SLA·담당자
- 법규·감사 근거
- 요구사항·디자인·아키텍처 승인자와 승인 기록

### 하네스 운영·운영 런북

- 검증 실패 이후의 공통 처리 절차
- 백업·복구 명령, 주기, 보존, 무결성 확인, WAL 처리
- 배포·롤백·환경변수·비밀 관리
- 장애 대응·모니터링·알림·RTO/RPO
- 계정 발급·회수·비밀번호 재설정·권한 운영
- 감사 로그·개인정보·데이터 보존·정정 절차
- 풀필먼트·팝업 현장 SOP

### 검증·결정 관리

- 모든 DoD·QA 항목의 실행 결과와 승인 증적을 모은 단일 기록
- M7 전체 완료 결과
- 검증 환경·실행자·시각·재현 절차
- 결정 로그(ADR)
- 문서 상태·승인·버전 레지스트리
- 공통 용어집·정책 레지스트리

### 최초 기준의 내부 주의점

- `docs/01-requirements.md`는 `Phase 1 확정 대기`로 표시되어 있으나 `HANDOVER.md`는 M1~M6 진행 상태를 기록한다.
- `docs/06-architecture.md`의 일부 예정 파일명·구조가 최초 구현 산출물과 다르다.
- README의 실행 안내는 운영 런북이나 백업·복구 절차를 대체하지 않는다.
- 풀필먼트 API, CSV, 바코드·QR, 오프라인/PWA, 팝업 판매 건별 기록, 발주·원가·매출 정산, 세분화된 권한, 다국어, 외부 알림, 원격 배포는 최초 범위에서 제외된 항목이다. 이는 문서 공백이 아니라 명시적 Out of Scope다.
