# 02. 검증 실행·판정 계약

> 이 문서는 SSOT 3 하네스 운영 규칙 중 검증 실행과 기계 판정을 소유한다. SSOT와 보호 경계는 [`01-ssot.md`](01-ssot.md), 판정 이후 반복과 PR/CI 인계는 [`03-loop.md`](03-loop.md)가 소유한다.

## 1. 단일 진입점과 순서

```bash
npm run verify
```

검증은 기존 개발 DB를 사용하지 않고 실행별 격리 파일 DB를 준비한 뒤 다음 순서로 실행한다. 어느 단계라도 실패하면 이후 단계를 실행하지 않고 종료한다.

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

`npm run verify`는 `verify:protected`를 먼저 실행하고, 성공한 경우에만 `scripts/verify.ts`를 실행한다. 판정 이후의 수정·반복·사람 판단은 `03-loop.md`를 따른다.

## 2. 단계별 판정

| 단계 | 실행 | 성공 판정 | 실패 시 |
|---|---|---|---|
| Protected | `npm run verify:protected` | 보호 정책 통과 | 즉시 종료 |
| Prepare | `scripts/verify.ts` | 격리 DB 준비 | 이후 미실행 |
| Types | `npm exec tsc -- --noEmit` | 타입 오류 없음 | 이후 미실행 |
| Lint | `npm run lint` | ESLint 오류 없음 | 이후 미실행 |
| Architecture Check | `npm run architecture-check` | 구조 위반 없음 | 이후 미실행 |
| Test | `npm test` | 모든 테스트 통과 | Build 미실행 |
| Build | `npm run build` | production build 성공 | 실패 코드 반환 |

판정 결과는 `PASS`, 일반 `FAIL`, 판정 불능으로 구분한다. 판정 불능이나 사람 판단이 필요한 결과는 `03-loop.md`의 `NEEDS_HUMAN` 절차로 전달한다.

## 3. Issue 기계 검증

Issue 종료 조건은 실행 가능한 assertion으로 판정할 수 있어야 한다. 전용 테스트가 필요한 경우 Issue 번호를 포함한 다음 경로를 사용한다.

```text
tests/issues/issue-{Issue 번호}-{기능명}.test.ts
```

Issue에 테스트를 둘 수 없는 작업은 대체 판정 방법·실행 명령·기대 exit code를 Issue에 기록한다. 테스트는 검증 실행기가 준비한 격리 파일 DB를 사용하며 `prisma/dev.db`를 수정하지 않는다.

## 4. DB 격리

각 실행은 test/build용 별도 파일 DB를 임시 디렉터리에 만들고 다음을 적용한다.

```text
prisma migrate deploy
prisma generate
tsx prisma/seed.ts
```

`:memory:` SQLite는 사용하지 않으며, 실행 종료 후 임시 디렉터리를 정리한다.

## 5. 로컬과 CI

로컬과 GitHub Actions 모두 `npm run verify`를 사용한다. CI workflow는 Pull Request와 `main` 대상 push에서 실행되며, checkout·의존성 설치 후 동일한 검증을 수행한다. GitHub 저장소의 required check 설정은 별도 저장소 설정이다.

## 6. 실패 처리

- 하위 명령의 non-zero 종료 코드는 상위 실행기로 전달한다.
- 앞 단계가 실패하면 뒤 단계는 실행하지 않는다.
- 환경·도구 오류로 판정할 수 없으면 통과시키지 않는다.
- 검증 판정 이후의 수정·반복·PR/CI 인계는 [`03-loop.md`](03-loop.md)를 따른다.
