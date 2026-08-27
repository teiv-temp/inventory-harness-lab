# 검증 실행 계약

> 이 문서는 검증의 실행 순서와 실패 처리를 소유한다. Protected의 보호 경계와 승인 원칙은 [`01-ssot.md`](01-ssot.md)가 소유한다.

## 1. 단일 진입점과 순서

검증의 단일 진입점은 다음 명령이다.

```bash
npm run verify
```

실행 순서는 다음과 같다.

```text
Protected
→ Prepare (test DB)
→ Types
→ Lint
→ Architecture Check
→ Test
→ Prepare (build DB)
→ Build
```

`npm run verify`는 `verify:protected`를 먼저 실행하고, 성공한 경우에만 `scripts/verify.ts`를 실행한다. Protected 또는 뒤 단계가 실패하면 이후 단계는 실행하지 않는다.

## 2. Protected 실행 계약

Protected는 [`01-ssot.md`](01-ssot.md)의 보호 경계와 사람 승인 정책을 기계적으로 판정한다. 구현 진입점은 [`scripts/verify-protected.ts`](../../scripts/verify-protected.ts)다.

- 보호 경로 변경이 없으면 GitHub 조회 없이 통과한다.
- 보호 경로 변경이 있으면 선택된 `base`와 `source head`의 커밋 diff만을 검사한다. staged 또는 working-tree 변경은 CI 판정에 섞지 않는다.
- Pull Request 이벤트에서는 event payload의 `pull_request.base.sha`, `pull_request.head.sha`, `pull_request.number`를 사용한다. `GITHUB_SHA`가 가리킬 수 있는 synthetic merge 커밋을 source head로 사용하지 않는다.
- PR 리뷰는 event payload에 의존하지 않고 GitHub에서 다시 조회한다.
- PR이 열려 있고 base/head가 일치하며, 현재 source head에 연결된 사람 승인과 `Protected-Scope: ...` 범위가 실제 보호 변경을 포함해야 통과한다.
- 승인 리뷰의 최신 상태가 아니거나, 승인자가 PR 작성자·봇·앱·AI·자동화 계정이거나, 범위·commit·신원 정보를 확인할 수 없으면 실패한다.
- 사람의 명시적 지시는 수정 허용 범위이고 최종 CI 승인과 다르다. 사람이 직접 남긴 승인 리뷰만 최종 승인 기록이다. AI와 CI는 승인 기록을 생성·수정·대체하지 않는다.
- 승인 범위 밖 변경, 승인 누락, 오래된 head, 조회·파싱 실패는 모두 `NEEDS_HUMAN`으로 fail-closed 처리한다.
- `main`에 push되었다는 사실만으로 보호 경로 변경을 우회하지 않는다. post-merge push에서 승인 증거를 확인할 수 없으면 실패한다.

로컬과 CI는 같은 보호 경로 정규화, committed diff, PR/head, 리뷰 상태 규칙을 사용한다. 로컬은 열린 PR을 명확히 찾지 못하면 보호 변경을 자동 통과시키지 않는다.

승인 리뷰의 예시는 다음과 같다.

```text
Protected-Scope: docs/harness/02-verification.md,docs/harness/01-ssot.md
Reason: 보호정책 실행 계약을 사람의 요청 범위에서 정리
```

리뷰 본문·PR 본문·라벨·커밋 메시지는 사람이 직접 남긴 승인이라는 사실을 단독으로 증명하지 않는다. 범위는 기계 판정을 위한 보조 정보이며, 사람 계정 지정과 리뷰 상태·commit 검증은 GitHub 권한 설정과 함께 적용한다.

## 3. 단계별 실행 계약

| 단계 | 실행 진입점 | 책임 | 실패 시 |
|---|---|---|---|
| Protected | `npm run verify:protected` | 보호 경로·현재 head·사람 승인 범위 확인 | 즉시 종료, `NEEDS_HUMAN` |
| Prepare | `scripts/verify.ts` 내부 | 격리 test DB에 migration·generate·seed 적용 | 이후 단계 미실행 |
| Types | `npm exec tsc -- --noEmit` | TypeScript 타입 검사 | 이후 단계 미실행 |
| Lint | `npm run lint` | ESLint 검사 | 이후 단계 미실행 |
| Architecture Check | `npm run architecture-check` | 재고 변경 단일 통로 정적 검사 | 이후 단계 미실행 |
| Test | `npm test` | Vitest 자동 테스트 | Build 미실행 |
| Prepare | `scripts/verify.ts` 내부 | 별도 build DB 준비 | Build 미실행 |
| Build | `npm run build` | production build | 실패 코드 반환 |

## 4. 실패 처리

- 하위 명령의 non-zero 종료 코드는 상위 실행기로 전달한다.
- 앞 단계가 실패하면 뒤 단계는 실행하지 않는다.
- Protected의 PR·리뷰·범위·commit·신원 확인 실패는 자동 통과시키지 않고 `NEEDS_HUMAN`으로 보고한다.
- 검증 규칙으로 판단할 수 없거나 원본 간 충돌이 있으면 임의 수정하지 않고 사람에게 판단을 요청한다.
- 일반 구현 검증 실패는 원인을 수정한 뒤 다시 실행할 수 있지만, 보호 승인 부족과 SSOT 충돌은 자동 반복하지 않는다.
- `scripts/verify.ts`는 `finally`에서 실행별 임시 DB를 정리한다.

## 5. DB 격리

검증은 개발·시연용 `prisma/dev.db`를 수정하거나 삭제하지 않는다. 실행별 임시 디렉터리 아래 test/build용 파일 DB를 따로 만들고 다음을 적용한다.

```text
prisma migrate deploy
prisma generate
tsx prisma/seed.ts
```

`:memory:` SQLite는 사용하지 않는다. Test와 Build는 서로 다른 DB를 사용하며 실행 종료 시 임시 디렉터리를 정리한다.

## 6. GitHub Actions

`.github/workflows/verify.yml`은 모든 Pull Request와 `main` 대상 push에서 실행한다.

1. 전체 Git 이력을 checkout한다.
2. Node.js 20을 설정한다.
3. `npm ci`를 실행한다.
4. `SESSION_SECRET`과 PR의 base/head/number를 Protected에 전달한다.
5. `npm run verify`를 실행한다.

CI는 source head를 검증하고, PR event의 synthetic merge SHA를 승인 기준으로 사용하지 않는다. GitHub 저장소의 required check 설정 여부 자체는 저장소 설정이며 이 문서는 자동으로 보장하지 않는다.
