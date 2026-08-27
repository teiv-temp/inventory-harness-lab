# 02. 검증 실행·판정 계약

> 이 문서는 SSOT 3 하네스 운영 규칙 중 검증 실행과 기계 판정을 소유한다. SSOT·보호 경계는 [`01-ssot.md`](01-ssot.md), 판정 이후의 B7/B8 작업 흐름은 [`03-loop.md`](03-loop.md)가 소유한다.

## 1. 단일 진입점과 실행 순서

```bash
npm run verify
```

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

`npm run verify`는 먼저 Protected를 실행하고, 성공한 경우에만 나머지 검증을 실행한다. 한 단계라도 실패하면 뒤 단계는 실행하지 않는다.

## 2. 단계별 판정

| 단계 | 실행 | 성공 판정 | 실패 시 |
|---|---|---|---|
| Protected | `npm run verify:protected` | 보호 정책 통과 | 즉시 종료 |
| Prepare | `scripts/verify.ts` 내부 | 격리 DB 준비 | 이후 미실행 |
| Types | `npm exec tsc -- --noEmit` | 타입 오류 없음 | 이후 미실행 |
| Lint | `npm run lint` | ESLint 오류 없음 | 이후 미실행 |
| Architecture Check | `npm run architecture-check` | 구조 위반 없음 | 이후 미실행 |
| Test | `npm test` | 모든 테스트 통과 | Build 미실행 |
| Build | `npm run build` | production build 성공 | 실패 코드 반환 |

모든 게이트가 성공하면 `PASS`, 단계가 실패하면 `FAIL`, 판정 자체가 불가능하면 사람 판단이 필요한 결과로 반환한다. 결과 이후의 수정·재시도·`NEEDS_HUMAN` 처리는 [`03-loop.md`](03-loop.md)를 따른다.

## 3. Issue 기계 검증

Issue의 종료 조건은 실행 가능한 assertion으로 판정한다. 전용 테스트가 필요한 경우 다음 경로를 사용한다.

```text
tests/issues/issue-{Issue 번호}-{기능명}.test.ts
```

Issue에 대체 판정 방법이 정해져 있으면 그 방법·명령·기대 exit code를 Issue에 기록한다. 테스트는 검증기가 준비한 격리 파일 DB를 사용하며 `prisma/dev.db`를 수정하지 않는다.

## 4. DB 격리

각 실행은 test/build용 별도 파일 DB를 임시 디렉터리에 준비한다.

```text
prisma migrate deploy
prisma generate
tsx prisma/seed.ts
```

`:memory:` SQLite는 사용하지 않으며, 실행 종료 후 임시 디렉터리를 정리한다.

## 5. 로컬과 CI

로컬과 GitHub Actions는 동일한 `npm run verify`를 실행한다. CI는 Pull Request와 `main` 대상 push에서 실행된다. GitHub 저장소의 branch protection과 required check 설정은 저장소 설정으로 별도 관리한다.
