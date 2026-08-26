# 02. 검증 실행 계약

> 이 문서는 현재 하네스 골격의 **검증 실행 방법과 단계 계약**을 기록한다. 제품 요구사항은 [`docs/01-requirements.md`](../01-requirements.md), 기술·데이터 경계는 [`docs/06-architecture.md`](../06-architecture.md), SSOT와 보호 정책은 [`ssot.md`](ssot.md)의 책임이다. 이 문서는 해당 규칙을 복제하지 않는다.

## 1. 목적과 범위

검증의 단일 진입점은 다음 명령이다.

```bash
npm run verify
```

이 명령은 기존 로컬 개발 DB를 사용하지 않고, 실행마다 동일한 migration과 seed로 격리된 SQLite DB를 준비한 뒤 정적 검사·테스트·빌드를 순서대로 실행한다. 어느 단계라도 실패하면 이후 단계를 실행하지 않고 실패 코드로 종료한다.

이 문서가 다루는 범위는 다음과 같다.

- 검증 단계의 순서와 각 단계의 진입점
- 로컬 검증 DB 격리와 정리
- GitHub Actions 실행 조건
- 실패 시 중단 동작
- 현재 하네스 골격의 비보장 영역

검증 규칙 자체와 검증 실패 이후의 운영 절차는 SSOT 3이 생성될 때 별도로 정의한다.

## 2. 전체 실행 순서

`npm run verify`는 다음 순서를 보장한다.

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

`Protected`가 먼저 실행되며, 보호 경로 변경이 승인되지 않았거나 승인 상태를 확인할 수 없으면 `NEEDS_HUMAN`으로 종료한다. Protected 성공 후에만 `scripts/verify.ts`가 시작된다.

## 3. 단계별 실행 계약

| 단계 | 실행 진입점 | 책임 | 실패 시 |
|---|---|---|---|
| Protected | `npm run verify:protected` → `scripts/verify-protected.ts` | SSOT 보호 경로 변경과 승인 상태 확인 | 즉시 종료 |
| Prepare | `scripts/verify.ts` 내부 `prepare()` | 임시 DB에 migration·Prisma generate·seed 적용 | 이후 단계 미실행 |
| Types | `npm exec tsc -- --noEmit` | TypeScript 타입 검사 | Lint 이하 미실행 |
| Lint | `npm run lint` | ESLint 검사 | Architecture Check 이하 미실행 |
| Architecture Check | `npm run architecture-check` | 재고 변경 단일 통로의 정적 검사 | Test 이하 미실행 |
| Test | `npm test` | Vitest 자동 테스트 | Build 미실행 |
| Prepare | `scripts/verify.ts` 내부 `prepare()` | 별도 빌드 DB에 동일한 초기 상태 준비 | Build 미실행 |
| Build | `npm run build` | Prisma generate 및 Next.js production build | 실패 코드 반환 |

각 단계는 기존 npm script 또는 기존 도구를 재사용한다. `verify`가 개별 검증 규칙을 새로 정의하거나 기존 도메인 정책을 대신 소유하지 않는다.

## 4. Prepare와 DB 격리

### 4.1 개발 DB 보호

검증은 개발·시연용 `prisma/dev.db`를 수정하거나 삭제하지 않는다. `.env`에 기존 `DATABASE_URL`이 있더라도 `verify`의 하위 프로세스에는 실행별 임시 DB URL을 전달한다.

`:memory:` SQLite는 사용하지 않는다. 테스트가 여러 Prisma 연결을 사용하므로 파일 기반 DB가 동일한 연결 간 상태를 공유할 수 있다.

### 4.2 실행별 DB

`scripts/verify.ts`는 운영체제의 임시 디렉터리 아래 실행별 디렉터리를 만들고, 다음 두 DB를 분리한다.

```text
<temporary>/inventory-verify-<run>/test/verify.db
<temporary>/inventory-verify-<run>/build/verify.db
```

각 DB에는 동일하게 다음을 적용한다.

```text
prisma migrate deploy
prisma generate
tsx prisma/seed.ts
```

Test와 Build가 같은 DB를 공유하지 않으므로 한 단계의 데이터 변경이 다른 단계에 영향을 주지 않는다. 실행이 성공하거나 실패해도 임시 디렉터리는 정리한다.

### 4.3 환경 전달

`DATABASE_URL`은 셸 전역을 변경하지 않고 각 하위 프로세스의 환경으로 전달한다. Windows에서는 `npm.cmd`와 `npx.cmd`를 사용하며, DB 파일 삭제는 Node `fs` API로 처리한다.

## 5. Protected

Protected의 목적은 [`ssot.md`](ssot.md)가 지정한 보호 경로에 승인되지 않은 변경이 들어가는 것을 막는 것이다. 현재 구현 진입점은 [`scripts/verify-protected.ts`](../../scripts/verify-protected.ts)다.

현재 검사 대상 보호 경로:

- `docs/01-requirements.md`
- `docs/06-architecture.md`
- `docs/harness/`
- `AGENTS.md`
- `CLAUDE.md`

승인 방법은 SSOT에 정의된 GitHub Pull Request 승인이다.

- 보호 경로 변경이 없으면 승인 없이 통과한다.
- 보호 경로 변경이 있으면 PR이 열려 있어야 한다.
- PR 작성자가 아닌 사람의 현재 head 커밋에 대한 `APPROVED` 리뷰가 필요하다.
- 승인 후 head 커밋이 바뀌면 다시 승인해야 한다.
- PR 또는 리뷰 상태를 확인할 수 없으면 통과시키지 않고 `NEEDS_HUMAN`으로 실패한다.

Protected는 변경 범위 계산과 승인 상태 확인만 담당한다. 도메인 테스트, 타입 검사, 린트, 빌드는 후속 단계가 담당한다.

## 6. Architecture Check

[`scripts/architecture-check.ts`](../../scripts/architecture-check.ts)는 `src` 아래 production TypeScript/TSX를 TypeScript AST로 검사한다.

- `src/lib/stock.ts`만 `lot`·`movement` mutation 허용 파일이다.
- `create`, `createMany`, `update`, `updateMany`, `upsert`, `delete`, `deleteMany` 직접 호출을 검사한다.
- 테스트·선언 파일·`src/generated`는 제외한다.
- 조회 호출과 주석·문자열은 검사하지 않는다.
- 위반 시 파일·행·열과 `applyMovement()` 사용 안내를 출력하고 실패한다.

이 검사는 정적 패턴 기반이므로 별칭, 동적/계산된 접근, raw SQL 등 모든 우회 경로를 보장하지 않는다.

## 7. 로컬과 GitHub Actions

### 로컬

저장소 루트에서 다음을 실행한다.

```bash
npm run verify
```

실행마다 격리된 test/build DB가 생성되고 종료 후 정리된다. 개발 서버와 개발 DB는 이 검증에 사용하지 않는다.

### GitHub Actions

`.github/workflows/verify.yml`은 다음 이벤트에서 실행된다.

- 모든 Pull Request 이벤트
- `main` 브랜치에 대한 push

Actions는 다음을 수행한다.

1. 전체 Git 이력 checkout (`fetch-depth: 0`)
2. Node.js 20 설정
3. `npm ci`
4. 테스트용 `SESSION_SECRET`을 설정하고 `npm run verify`

CI에서는 `verify-protected.ts`가 PR 이벤트의 승인 상태 또는 `main` push의 반영 상태를 확인한 뒤, 통합 검증을 실행한다.

## 8. 실패 처리

현재 실행기는 fail-fast 방식이다.

- 하위 명령의 non-zero 종료 코드는 상위 실행기로 전달된다.
- 앞 단계가 실패하면 뒤 단계는 실행하지 않는다.
- `finally`에서 임시 검증 DB를 정리한다.
- Protected 실패 시 Types·Lint·Architecture Check·Test·Build는 실행하지 않는다.
- 보호 경로 승인 실패는 `NEEDS_HUMAN`으로 표시한다.

## 9. 현재 한계와 비보장

이 문서는 현재 하네스 골격의 실행 계약만 기록하며 다음을 보장한다고 주장하지 않는다.

- SSOT 3 하네스 운영 규칙의 완성
- 검증 실패 후 재탐색·수정·재검증 절차
- 브라우저 기반 전체 QA
- 외부 서비스·풀필먼트 API 검증
- 세분화된 권한 운영 검증
- Protected의 동적·별칭·raw SQL 우회 경로 전부 탐지
- GitHub 저장소의 branch protection 필수 체크 설정

Protected 승인 정책과 보호 경로의 권위는 [`ssot.md`](ssot.md)를 따른다. 구현과 문서가 다르면 차이를 숨기지 않고 보고한다.
