# 아키텍처 — 실제 구현 기준

> 작성일: 2026-08-26 · 기준: **M1~M6 구현 완료 시점의 실제 코드**
> 기획 단계 설계 문서는 [inventory-harness-lab/docs/06-architecture.md](./inventory-harness-lab/docs/06-architecture.md),
> 진행 상황과 다음 할 일은 [inventory-harness-lab/docs/HANDOVER.md](./inventory-harness-lab/docs/HANDOVER.md) 참고.
> 이 문서는 저장소의 실제 소스 코드를 분석해 작성한 **현재 상태의 아키텍처**다.

---

## 1. 이 앱은 무엇인가

풀필먼트 3사와 자사창고에 흩어진 재고를 **유통기한 단위(로트)** 로 관리하고,
오프라인 팝업스토어 반출·정산까지 추적하는 사내 재고관리 앱.
강의·시연용 PoC이지만 상용 제품의 골격(단일 변경 통로 · 불변식 · 트랜잭션 원장)을 갖춘다.

### 도메인을 지탱하는 세 가지 축

| 개념 | 정의 | 코드에서의 위치 |
|---|---|---|
| **로트(Lot)** | 상품 × 거점 × 유통기한. 셋 중 하나라도 다르면 다른 재고다 | `Lot` 모델 + `@@unique([productId, locationId, expiryDate])` |
| **이동 원장(Movement)** | 모든 수량 변화는 `어디 → 어디` 기록으로만 남는다. 재고는 사라지지 않고 이동하며, 한쪽이 외부(null)일 때만 총량이 변한다 | `Movement.fromLocationId / toLocationId` (null = 외부) |
| **배분 전략(Allocation)** | 출고·일일 반영·팝업 반출은 **FEFO**(임박분 먼저), 풀필먼트 발송만 **LEFO**(넉넉분 먼저) | `src/lib/fefo.ts` |

```text
[외부] → 자사창고(OWN) → 배송 중(TRANSIT) → 풀필먼트(FULFILLMENT) → [외부]
              ↓
            팝업(POPUP) → 판매 [외부] / 잔여는 자사창고 복귀
                        ↘ 폐기(DISPOSAL) — 사람이 확정해야만 나간다
```

거점 유형(`LOCATION_TYPES`): `OWN`(자사창고) · `FULFILLMENT`(풀필먼트) · `POPUP`(행사 임시) ·
`TRANSIT`(배송 중, 가상) · `DISPOSAL`(폐기, 가상). 이 중 가용 재고에 포함되는 것은 OWN과 FULFILLMENT뿐이다.

---

## 2. 기술 스택 (package.json 기준)

| 층 | 선택 | 버전 | 비고 |
|---|---|---|---|
| 프레임워크 | Next.js (App Router) | 16.3.1 | 미들웨어가 `middleware.ts` → **`src/proxy.ts`** 로 변경됨 |
| UI | React | 19.2.8 | 서버 컴포넌트 중심. 클라이언트 컴포넌트는 입력 폼만 |
| 언어 | TypeScript | ^5 | |
| DB | SQLite (`prisma/dev.db`) | — | 파일 하나가 전부. 서버 설치 없음 |
| ORM | Prisma (generator `prisma-client`) | 7.9.1 | **드라이버 어댑터 필수**: `@prisma/adapter-better-sqlite3`. 클라이언트는 `@/generated/prisma/client` 에서 import |
| 스타일 | Tailwind CSS | 4 | PostCSS 플러그인 방식 |
| 인증 | 자체 세션 쿠키 | `jose` 6 + `bcryptjs` 3 | NextAuth 미사용 — JWT 서명 쿠키 1장 |
| 테스트 | Vitest | 4.x | 순수 함수 + 실DB 통합 테스트 혼용 |
| 실행 도구 | tsx, dotenv | — | 시드·검증 스크립트 실행 |

**일부러 넣지 않은 것**: REST API 라우트(화면 전용 앱이라 Server Actions로 충분),
클라이언트 상태관리 라이브러리(서버가 유일한 진실), PostgreSQL("받아서 바로 실행" 유지 —
Prisma 덕에 향후 전환 시 애플리케이션 레이어 변경 최소화).

---

## 3. 전체 구조 — 요청 하나가 흘러가는 길

API 라우트 없이 **Next.js 서버 안에서 화면과 로직이 직결**되는 구조다.

```text
브라우저
   │  GET /outbound
   ▼
src/proxy.ts (미들웨어, Next.js 16)
   │  세션 쿠키 JWT 검증만 한다 (DB 접근 없음 → lib/session.ts만 import)
   │  미로그인 → /login 리다이렉트
   ▼
Server Component (src/app/**/page.tsx)          ← 읽기(R)
   │  lib/inventory.ts · lib/popup.ts 의 조회 함수로 데이터 수집
   │  조회 결과를 그대로 props로 내려 클라이언트 폼에 전달
   ▼
Client Component (src/components/*.tsx)         ← 입력(UI 상태는 useState뿐)
   │  FEFO/LEFO 미리보기를 lib/fefo.ts의 순수 함수 planAllocation()으로 계산
   ▼
Server Action (src/actions/*.ts)                ← 쓰기(W)
   │  requireUser()로 세션+DB 이중 검증
   ▼
도메인 로직 (src/lib/*.ts) — db.$transaction() 안에서 실행
   ├─ fefo.allocateLots()      저장 직전 현재 재고로 배분 재계산
   ├─ stock.applyMovement()    ★재고 변경의 유일한 통로 (Lot 갱신 + Movement 기록)
   └─ popup.settlePopupTx()    정산 역산 계산
   ▼
Prisma Client (@/generated/prisma) ── better-sqlite3 어댑터 ──► SQLite 파일
```

핵심 규칙: **React 컴포넌트는 Prisma를 모른다.** 읽기는 `lib`의 조회 함수를 통해서만,
쓰기는 Server Action → 도메인 함수를 통해서만 일어난다.

---

## 4. 디렉터리 구조 (실제 코드 기준)

```text
inventory-poc/
├── prisma/
│   ├── schema.prisma        데이터 모델 9개 (아래 §5)
│   ├── seed.ts              목업 데이터 — 앱과 같은 함수(applyMovement·allocateLots)를
│   │                        사건 시간순으로 통과시켜 만든다 (§7 원칙 ⑤)
│   └── migrations/
├── scripts/
│   ├── ensure-db.ts         DB 파일 없으면 migrate + seed 자동 실행 (npm run dev 가 호출)
│   ├── snapshot.ts          거점별 재고 스냅샷 — 이동 전후 총량 확인용
│   ├── verify-m1.ts         시드 상태 검증
│   └── verify-headline.ts   홈 목록 대표 로트 회귀 검증
├── src/
│   ├── proxy.ts             ★ 미들웨어(Next.js 16). 로그인 게이트. JWT만 검증
│   ├── app/                 화면 14개 (아래 §6.2)
│   ├── actions/             Server Actions 6파일 (§6.3)
│   ├── lib/                 도메인 로직 + 인프라 (§6.4)
│   ├── components/          UI 컴포넌트 ~22개 (§6.5)
│   └── generated/prisma/    Prisma 생성물 (커밋하지 않음)
├── tests/
│   ├── fefo.test.ts            FEFO 5 + LEFO 3 (순수 함수)
│   ├── stock-invariant.test.ts 재고 불변식 6 (실DB 트랜잭션)
│   ├── popup-settle.test.ts    팝업 정산 5 (실DB)
│   └── helpers.ts              공유 DB 헬퍼 (totalStock · ids · lotQty)
├── docs/                    기획 문서 01~07 + HANDOVER
├── .env.example             SESSION_SECRET 템플릿
├── prisma.config.ts         Prisma 7 설정 (DATABASE_URL은 .env 에서 읽음)
└── package.json             스크립트 (§10)
```

---

## 5. 데이터 모델 — 9개 모델

`prisma/schema.prisma` 한 장이 설계도 전부다. SQLite 특성상 상태값은 문자열로 저장되므로
`src/lib/constants.ts`의 `as const` 객체 + 파생 타입이 1차 방어선 역할을 한다.

```text
User ──< Movement >── Product
          │ │            │
Location ─┘ └─ Transfer ──< TransferLine
   ▲ ▲              │           │
Popup ┘(전용거점)    └───────────┘ (transferId)
   └──< PopupPlan (반출서 = 계획, 재고 안 움직임)
```

| 모델 | 역할 | 핵심 제약·필드 |
|---|---|---|
| **User** | 사내 사용자. 모든 기록의 주체 | `role`(MEMBER\|ADMIN), movements / transfers 송수신 관계 |
| **Product** | 상품(SKU) | `sku` unique, `unit`(기본 `개`), `expiryAlertDays`(품목별 임박 기준일, 기본 60) |
| **Location** | 거점. 팝업은 행사마다 하나씩 생긴다 | `type`(5종), `lastReflectedAt`(풀필먼트 마지막 반영일 = 숫자 신뢰도) |
| **Lot** | ★ 재고의 최소 단위 = 상품 × 거점 × 유통기한 | `@@unique([productId, locationId, expiryDate])`, FEFO 조회용 `@@index([locationId, expiryDate])` |
| **Movement** | ★ 이동 원장 — 이력의 진실 | `quantity`는 **항상 양수**(방향은 from/to가 표현), `from/to` null=외부, `reversalOfId` 자기참조(취소=상쇄), 인덱스 `(createdAt)`, `(productId, createdAt)` |
| **Transfer** | 거점 간 이동 (발송→도착 확인 2단계) | `status`: SENT → RECEIVED (+CANCELLED), 발송/수신자 각각 기록 |
| **TransferLine** | 이동 명세 (SKU × 유통기한) | `sentQty` vs `receivedQty?` — 불일치분은 도착 시 ADJUST 기록으로 정산 |
| **Popup** | 여러 번 반출되고 마지막에 정산되는 행사 | `locationId` unique(팝업 전용 거점), `sourceLocationId`, `status`: PREP → ACTIVE → SETTLING → CLOSED |
| **PopupPlan** | 반출서 = 계획. **재고를 움직이지 않는다** | `@@unique([popupId, productId])` |

### Movement.from/to 의미 체계 (이해의 핵심)

| from | to | 뜻 | 총 재고 |
|---|---|---|---|
| `null` | 거점 | 외부에서 들어옴 (입고·반품) | 증가 |
| 거점 | `null` | 외부로 나감 (판매·시식·폐기 확정) | 감소 |
| 거점 | 거점 | 내부 이동 (발송·복귀) | **변화 없음** |

---

## 6. 계층별 설명

### 6.1 `src/proxy.ts` — 로그인 게이트 (Next.js 16 미들웨어)

- 쿠키 `inv_session`의 JWT를 `lib/session.ts`의 `verifyToken()`으로만 검증한다.
- **여기서 Prisma를 import하면 안 된다** (엣지 실행 환경). 그래서 DB 검증 없는 가벼운
  `session.ts`와, 서버 액션용 무거운 `auth.ts`가 분리돼 있다.
- 미로그인 → `/login`, 로그인 상태에서 `/login` 접근 → `/`.

### 6.2 `src/app/` — 화면 14개 (Server Components)

모든 데이터 화면은 `export const dynamic = 'force-dynamic'` — 재고는 실시간 데이터이므로
정적 생성을 쓰지 않는다. 조회 로직은 페이지에 두지 않고 `lib/inventory.ts`·`lib/popup.ts`에 위임한다.

| 경로 | 화면 | 사용하는 조회 함수 |
|---|---|---|
| `/login` | 로그인 (useActionState) | — |
| `/` | 홈: 검색 · 재고 목록 · 오늘 할 일 배너 · 거점 필터 · ＋FAB | `getStockRows` `getSummary` `getTodos` `getExpiryCounts` `getLocations` |
| `/products/[id]` | 상품 상세 — 로트 카드 | `getProductDetail` |
| `/inbound` | 입고 (유통기한 키패드, 다중 기한) | db 직접조회 + `formatDate` |
| `/outbound` | 출고 (FEFO 자동 배분) | db 직접조회 |
| `/transfers` `/new` `/[id]` | 배송 중 목록 · 발송 · 도착 확인 | db 직접조회 |
| `/fulfillment` `/[locationId]` | 풀필먼트 목록 · 일일 반영 시트 | `getFulfillmentLocations` `getFulfillmentSheet` |
| `/popups` `/new` `/[id]` `/[id]/settle` | 팝업 목록 · 생성 · 진행/리포트 · 정산 | `getPopupList` `getPopupDetail` `popupReport` |

### 6.3 `src/actions/` — Server Actions 6파일 (쓰기의 관문)

모두 `'use server'`. 공통 패턴: **`requireUser()` → 입력 검증 → `db.$transaction()` 안에서
도메인 함수 호출 → `revalidatePath()`**. 세션 만료는 예외 대신 `SaveResult { ok:false, error }`
반환으로 화면에 메시지를 보여준다.

| 파일 | 액션 | 하는 일 |
|---|---|---|
| `auth.ts` | `login` `logout` | bcryptjs 비교 → jose JWT 서명 → 쿠키 발급/파기 |
| `inbound.ts` | `saveInbound` | 한 상품에 유통기한 다른 줄 여러 개를 한 번에 입고 (외부→거점) |
| `outbound.ts` | `saveOutbound` | FEFO 배분 후 출고. 수동 로트 선택 시 사유+메모 필수 |
| `transfer.ts` | `sendTransfer` `receiveTransfer` | 자사창고→TRANSIT(LEFO), TRANSIT→도착지(실수량, 차이는 ADJUST) |
| `fulfillment.ts` | `saveFulfillmentReflection` | 어제 출고분을 FEFO로 차감. 출고 0건이어도 저장 가능(lastReflectedAt 갱신이 목적) |
| `popup.ts` | `createPopup` `shipOutPopup` `settlePopup` `unsettlePopup` | 전용 거점 생성 → 반출(FEFO) ×n → 정산 확정 → 되돌리기 |

### 6.4 `src/lib/` — 도메인 로직 + 인프라

| 파일 | 역할 |
|---|---|
| **`stock.ts`** ★ | **`applyMovement()` — 재고 수량을 바꾸는 유일한 통로.** ①출발지 차감(음수 금지, 부족 시 `InsufficientStockError`) ②도착지 upsert(같은 로트면 합쳐짐) ③Movement 기록 — 셋이 한 트랜잭션. `reverseMovement()`는 삭제가 아니라 방향을 뒤집은 상쇄 기록(중복 취소 방지 포함) |
| **`fefo.ts`** ★ | `planAllocation()` — **순수 함수**(클라 미리보기와 서버가 같은 결과). FEFO/LEFO를 정렬 방향 하나(`dir = ±1`)로 처리. `allocateLots()`는 저장 직전 DB 현재 재고로 재계산하는 서버 전용 래퍼 |
| **`popup.ts`** ★ | 반출 누계 집계(`tallyPopup`), 정산 역산(`settlePopupTx` — 잔여·시식으로 판매량 계산, 시식은 상품 단위·FEFO), 되돌리기(`unsettlePopupTx`). 액션과 테스트가 같은 함수를 쓴다 |
| `inventory.ts` | 화면용 조회 전담: 홈 목록·요약·할 일·상품 상세·풀필먼트 시트 |
| `session.ts` | JWT 서명/검증 (`jose`). DB 미사용 — proxy에서도 안전 |
| `auth.ts` | `requireUser()` — 세션 + **DB 사용자 존재 검증**. 시드 리셋 등으로 사용자가 사라졌으면 쿠키를 지우고 `SessionExpiredError` |
| `constants.ts` | 거점·이동·사유·상태 코드 (`as const` + 라벨 맵). `TRANSIT_DELAY_DAYS=7`, `DEFAULT_EXPIRY_ALERT_DAYS=60` |
| `date.ts` | 유통기한은 시각 없는 날짜 — 반드시 `dateOnly()`(UTC 자정 고정) 통과 |
| `expiry.ts` | EXPIRED / SOON / OK 판정 |
| `db.ts` | PrismaClient 싱글턴 (globalThis 캐싱). better-sqlite3 어댑터 |

### 6.5 `src/components/` — UI 컴포넌트 ~22개

- **표시**: `Qty`(단위 표시), `StatusBadge`(`Badge`·`ExpiryBadge` — 색만으로 상태를 말하지 않고
  글자를 함께 쓴다), `StockRow`, `LotCard`, `SettlementSentence`(정산 확인 문장)
- **입력**: `QtyInput`, `ExpiryKeypad`(유통기한 6자리), `BulkInputRow`(반영·반출·정산 공용 다건 입력),
  `SearchHeader`, `FilterSegment`, `ActionFab`(＋ 버튼 = 모든 생성 동작의 입구)
- **폼(Server Action 호출)**: `InboundForm` `OutboundForm` `TransferForm` `ReceiveForm`
  `PopupCreateForm` `FulfillmentSheet` `PopupShipOut` `SettleForm` `UnsettleButton` `PopupReport`

폼 컴포넌트는 클라이언트에서 `planAllocation()`으로 배분 **미리보기**를 보여주고,
서버는 저장 직전 `allocateLots()`로 **재계산**한다 — 사용자가 본 것과 실제 저장이 어긋나지 않게.

---

## 7. 지켜지고 있는 핵심 설계 원칙

1. **재고 변경의 통로는 하나뿐이다** — `applyMovement()` 외에는 어디서도 `lot.update()`를
   직접 호출하지 않는다. 수량 변경과 이력 기록이 같은 트랜잭션에서 함께 성공하거나 함께 롤백된다.
   새 기능도 반드시 이 함수를 거쳐야 한다.
2. **취소는 삭제가 아니라 상쇄다** — `reverseMovement()`가 방향을 뒤집은 Movement를 추가한다
   (`reversalOfId`로 원본 연결). 원본은 영원히 남고, 중복 취소는 차단된다. 팝업 정산 되돌리기가 이 함수를 재사용한다.
3. **배분 전략은 하나의 순수 함수로 통일** — FEFO/LEFO 모두 `planAllocation(lots, qty, strategy)` 하나.
   클라이언트 미리보기와 서버 저장 계산이 같은 코드를 쓴다(불일치 불가능).
   저장 직전에는 `allocateLots()`로 DB 최신 재고 기준 재계산한다.
4. **발송만 LEFO** — 풀필먼트는 도착 3~5일 + 판매 대기라 임박분을 보내면 팔리기 전에 만료된다.
   나머지(출고·반영·팝업 반출·시식)는 전부 FEFO다.
5. **시드도 앱과 같은 함수를 통과한다** — `prisma/seed.ts`는 로트를 손으로 만들지 않고
   사건을 시간순으로 `applyMovement` + `allocateLots`에 흘려보낸다. 규칙을 바꿔도 시드가 자동으로 따라온다.
6. **세션은 2중 검증** — 미들웨어(proxy)는 JWT만, Server Action의 `requireUser()`는 DB까지 확인해
   유령 사용자 쿠키를 정리한다.
7. **수량은 정수, 단위는 화면의 것** — DB `quantity`는 정수. 단위는 `Product.unit`에 한 번 두고
   `<Qty>`/`<QtyInput>` 컴포넌트에서만 붙인다.
8. **유통기한은 시각 없는 날짜** — 모든 날짜 저장은 `lib/date.ts`의 `dateOnly()`(UTC 자정)를 통과한다.

---

## 8. 주요 비즈니스 흐름

### 입고 → 출고
```text
saveInbound:  [외부] ──INBOUND──► 자사창고 Lot 생성/합산 (유통기한별 여러 줄)
saveOutbound: planAllocation(FEFO) 미리보기 → allocateLots 재계산
              → applyMovement(자사창고 ──OUTBOUND──► [외부])  사유: 판매·시식·파손·분실…
```

### 풀필먼트 발송 → 도착 확인 (Transfer 2단계)
```text
sendTransfer:    자사창고 ──TRANSFER──► TRANSIT 가상거점   (LEFO 배분!)
                 Transfer(SENT) + TransferLine 생성 — 도착 전까지 가용에서 빠짐
receiveTransfer: TRANSIT ──TRANSFER──► 풀필먼트             (실제 받은 수량으로)
                 receivedQty ≠ sentQty 면 차이만큼 ADJUST 기록 추가
```

### 풀필먼트 일일 반영
```text
saveFulfillmentReflection: "어제 이 거점에서 실제로 나간 수량"을 입력받아
                           FEFO로 로트 차감 (ADJUST/COUNT_DIFF). 출고 0건이어도 저장 가능 →
                           lastReflectedAt 갱신 → 홈 '할 일' 배너에서 사라진다
```

### 팝업 (여러 번 반출 → 마지막 정산)
```text
createPopup:   Popup(PREP) + 팝업 전용 Location + PopupPlan(반출서=계획, 재고 안 움직임)
shipOutPopup:  자사창고 ──POPUP_OUT──► 팝업거점 (FEFO) ×여러 번, ACTIVE
settlePopup:   로트별 잔여 입력 + 시식 입력(상품 단위) → 누적 반출 − 잔여 − 시식 = 판매 역산
               판매분 POPUP_OUT([외부]) / 잔여분 POPUP_IN(원거점 복귀, 유통기한 보존) → CLOSED
unsettlePopup: settlePopupTx가 남긴 기록들을 reverseMovement로 전부 상쇄 → ACTIVE 복원
```

---

## 9. 인증 아키텍처

```text
login 액션      bcrypt.compare → jose SignJWT({ id, name }) → 쿠키 inv_session (7일, HttpOnly)
proxy.ts        verifyToken()만 — 서명·만료 확인. DB 접근 없음 (엣지 제약)
requireUser()   세션 파싱 + db.user.findUnique 로 실존 검증
                → 없으면 destroySession() 후 SessionExpiredError
액션 반환       세션 오류는 throw 대신 SaveResult{ok:false}로 → 화면 메시지
```

---

## 10. 개발 · 운영 명령어

| 명령 | 내용 |
|---|---|
| `npm run dev` | `ensure-db`(DB 없으면 migrate+seed) 후 `next dev` → localhost:3000 |
| `npm run seed` / `seed:reset` | 목업 데이터 재주입 / DB 파일 삭제 후 완전 초기화 (ID 1번부터 재부여) |
| `npm test` | Vitest — 순수 함수(fefo) + 실DB(불변식·정산) 19개 |
| `npm run build` | `prisma generate && next build` |
| `npm run db:studio` | 브라우저로 SQLite 열기 (:5555) |

테스트는 `prisma/dev.db`를 그대로 공유하므로, 새 테스트도 **자기가 만든 데이터만 앞뒤로 지우는** 관례를 따른다.

---

## 11. 현재 구현 상태와 한계

- **완료(M1~M6)**: 로그인 · 홈 · 상품 상세 · 입고 · 출고(FEFO) · 발송→도착(LEFO) · 일일 반영 · 팝업 반출→정산→되돌리기
- **미구현(M7)**: `/expiry`(임박·폐기 확정), `/history`(이력·취소 UI), `/settings`,
  재고 조정(실사). 다만 `reverseMovement()` 등 백엔드 함수는 이미 준비돼 있어 화면 작업만 남았다.
- **동시성**: SQLite WAL + 트랜잭션으로 소규모(2~3명) 동시성 커버. 충돌 시 재시도는 앱 레벨 과제로 남음.
- **외부 연동**: 풀필먼트사 API 연동은 Out of Scope — 현재는 '일일 반영' 수치 입력으로 대체한다.

> 수정 가이드: 재고 로직을 고칠 때는 §7 원칙 1~3이 깨지지 않는지 먼저 확인하고,
> 새 화면은 §6.2처럼 조회를 lib로, 저장을 actions로 위임하는 기존 패턴을 따른다.




