# 검증 실행 수단

이 디렉터리는 저장소의 검증 실행 수단을 둔다.

- 현재 통합 진입점: [`../verify.ts`](../verify.ts)
- 실행 명령: `npm run verify`
- 실행 순서: Prepare → Types → Lint → Architecture Check → Test → Build

세부 검증 규칙과 검증 실패 후 처리 절차는 하네스 운영 규칙(SSOT 3)이 생성될 때 정의한다.

관련 기준: [`docs/harness/ssot.md`](../../docs/harness/ssot.md)
