# 검증 실행 수단

이 디렉터리는 저장소의 검증 실행 수단과 Protected 판정 보조 모듈을 둔다.

- 현재 통합 진입점: [`../verify.ts`](../verify.ts)
- 실행 명령: `npm run verify`
- 실행 순서: Protected → Prepare → Types → Lint → Architecture Check → Test → Build
- Protected 진입점: [`../verify-protected.ts`](../verify-protected.ts)

Protected의 보호 경로·사람 소유 영역·승인 원칙은 [`01-ssot.md`](../../docs/harness/01-ssot.md)가 소유한다. 이 디렉터리의 코드는 해당 정책을 기계적으로 판정하며, 승인 불가·범위 불일치·정보 조회 실패를 자동 통과시키지 않는다.

관련 실행 계약: [`02-verification.md`](../../docs/harness/02-verification.md)

사람의 명시적 지시는 AI의 수정 허용 범위를 정할 뿐 최종 CI 승인으로 대체되지 않는다. 보호 경로 변경을 통과시키려면 사람이 직접 남긴 현재 head의 승인 리뷰와 `Protected-Scope: ...` 범위가 필요하다.
```text
Protected-Scope: docs/01-requirements.md,docs/harness/02-verification.md
Reason: 사람의 승인 사유
```

AI와 CI는 승인 기록을 생성하거나 수정해서는 안 된다.
