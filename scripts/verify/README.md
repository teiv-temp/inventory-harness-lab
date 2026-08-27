# 검증 실행 수단

이 디렉터리는 검증 실행 보조 코드를 둔다.

- 통합 명령: `npm run verify`
- 실행 순서와 판정: [`docs/harness/02-verification.md`](../../docs/harness/02-verification.md)
- 판정 이후 작업 단위·반복 절차: [`docs/harness/03-loop.md`](../../docs/harness/03-loop.md)
- Protected 정책 원본: [`docs/harness/01-ssot.md`](../../docs/harness/01-ssot.md)
- Protected 진입점: [`../verify-protected.ts`](../verify-protected.ts)
- 전체 검증 실행기: [`../verify.ts`](../verify.ts)

이 디렉터리의 코드는 문서에 정의된 검증을 실행한다. 작업 수정·재시도·사람 판단 절차를 이 README에서 다시 정의하지 않는다.
