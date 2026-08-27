# 02. 검증 실행·판정 계약

> 이 문서는 SSOT 3 — 하네스 운영 규칙 중 기계 검증의 실행 순서와 판정을 소유한다. 원본·보호 경계는 [`01-ssot.md`](01-ssot.md), 판정 이후 하나의 작업 단위와 반복 절차는 [`03-loop.md`](03-loop.md)가 소유한다.

## 1. 목적과 단일 진입점

검증의 단일 진입점은 다음 명령이다.

```bash
npm run verify
```

검증은 기존 개발 DB를 사용하지 않고 실행별 격리 파일 DB를 준비한 뒤, 정적 검사·테스트·빌드를 순서대로 실행한다. 어느 단계라도 실패하면 이후 단계를 실행하지 않고 실패 코드로 종료한다.

## 2. 실행 순서

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

`npm run verify`는 `verify:protected`를 먼저 실행하고, 성공한 경우에만 `scripts/verify.ts`를 실행한다. Protected 또는 후속 단계의 결과를 받은 뒤 수정·재검증·사람 판단으로 전환하는 절차는 [`03-loop.md`](03-loop.md)를 따른다.

## 3. 단계별 판정

| 단계 | 실행 진입점 | 판정 | 실패 시 |
|---|---|---|---|
| Protected | `npm run verify:protected` | `01-ssot.md`의 보호 정책에 따른 변경·승인 확인 | 즉시 종료, `NEEDS_HUMAN` |
| Prepare | `scripts/verify.ts` 내부 | 격리 test DB 준비 | 이후 단계 미실행 |
| Types | `npm exec tsc -- --noEmit` | TypeScript 타입 검사 | 이후 단계 미실행 |
| Lint | `npm run lint` | ESLint 검사 | 이후 단계 미실행 |
| Architecture Check | `npm run architecture-check` | 재고 변경 단일 통로 정적 검사 | 이후 단계 미실행 |
| Test | `npm test` | Vitest와 Issue 기계 검증 통과 | Build 미실행 |
| Prepare | `scripts/verify.ts` 내부 | 별도 build DB 준비 | Build 미실행 |
| Build | `npm run build` | production build 성공 | 실패 코드 반환 |

이 문서는 위 단계가 무엇을 판정하는지만 정한다. 실패 원인 수정, 다음 시도, 사람 판단 요청, 완료·중단 보고는 `03-loop.md`의 책임이다.

## 4. Issue 기계 검증

각 유지보수 Issue의 종료 조건은 실행 가능한 assertion으로 판정할 수 있어야 한다.

```text
tests/issues/issue-{Issue 번호}-{기능명}.test.ts
```

- Issue에 테스트 파일이 요구되면 해당 파일은 `Test` 단계에서 공통 테스트와 함께 실행한다.
- 테스트는 종료 조건의 기대값·수치·상태를 assertion으로 판정해야 한다.
- Issue에 테스트 파일을 둘 수 없는 작업은 Issue에 대체 판정 방법, 실행 명령, 기대 exit code를 명시한다.
- 테스트는 개발·시연용 `prisma/dev.db`가 아닌 검증 실행기가 준비한 격리 파일 DB를 사용한다.

## 5. DB 격리

검증은 `prisma/dev.db`를 수정하거나 삭제하지 않는다. 실행별 임시 디렉터리 아래 test/build DB를 분리하고 각각 다음을 적용한다.

```text
prisma migrate deploy
prisma generate
tsx prisma/seed.ts
```

`:memory:` SQLite는 사용하지 않는다. Test와 Build는 서로 다른 DB를 사용하며, 실행이 끝나면 임시 디렉터리를 정리한다.

## 6. 로컬과 GitHub Actions

### 로컬

저장소 루트에서 `npm run verify`를 실행한다. Protected가 필요한 변경인데 PR·승인·범위를 확인할 수 없으면 자동 통과시키지 않는다.

### GitHub Actions

`.github/workflows/verify.yml`은 모든 Pull Request와 `main` 대상 push에서 다음을 실행한다.

1. 전체 Git 이력 checkout
2. Node.js 20 설정
3. `npm ci`
4. `npm run verify`

CI는 로컬과 같은 `npm run verify`를 사용해야 하며, Protected의 구체적인 보호 경계·승인 규칙은 `01-ssot.md`를 따른다.

## 7. 실패 처리

- 하위 명령의 non-zero 종료 코드는 상위 실행기로 전달한다.
- 앞 단계가 실패하면 뒤 단계는 실행하지 않는다.
- 판정할 수 없는 환경·도구 오류도 자동 통과시키지 않는다.
- Protected 승인 부족, 원본 충돌, 범위 판단 불가는 `NEEDS_HUMAN`으로 보고한다.
- 검증 판정 이후의 수정·반복·사람 개입·PR/CI 전환은 [`03-loop.md`](03-loop.md)를 따른다.
