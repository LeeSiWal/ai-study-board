# 프론트엔드 프로토타입 설계 (Phase 0~3)

> 상태: **작성 중** — 설계 1/3까지 합의. 2/3(데이터 흐름), 3/3(오류 처리·테스트·범위 경계)은 미작성.
> 작성 시작: 2026-07-26
> 기준 문서: [`docs/architecture/overview.md`](../../architecture/overview.md), [`docs/design/ui-spec.md`](../../design/ui-spec.md)

---

## 구현 현황 (2026-07-26)

사용자 지시로 설계 2/3·3/3을 건너뛰고 **Phase 0을 구현했다.** 미결이던 두 질문은 아래처럼 확정했다.

- **블록 ID** — Tiptap 확장 `components/editor/block-id.ts`. 블록마다 `blockId`(UUID)를 부여하고 `appendTransaction`으로 누락·중복을 메운다. 분할 시 상속을 막으려 `keepOnSplit: false`를 쓴다.
- **`content_version`** — 협업 서버가 `onStoreDocument`마다 1씩 올리는 단조 정수(`collab-server/document-storage.ts`). Yjs state vector를 쓰지 않은 이유는 "제안 생성 이후 문서가 바뀌었는가"라는 단일 질문에 정수 비교로 충분하기 때문이다.

### 검증된 것

`npm run verify:collab`이 브라우저 없이 협업 계층을 통과시킨다. 5개 항목 모두 통과.

- 서명된 토큰으로 두 클라이언트 연결
- 양방향 변경 전파
- 두 문서가 동일한 최종 상태로 수렴
- 다른 문서용 토큰 거부 (Room 간 경계)

`POST /api/resources/:id/collaboration-token`은 미인증 시 401을 돌려준다. 타입 체크·lint·프로덕션 빌드 모두 통과.

`npm test`가 jsdom에서 Tiptap을 직접 띄워 편집기 로직을 검증한다. 6개 통과.

- 입력한 블록마다 ID 부여, 문서 내 유일성
- 블록 분할 시 ID 중복 없음 (`keepOnSplit: false`의 실제 효과)
- 편집해도 기존 blockId 유지 — AI 제안이 들고 있는 ID가 유효해야 한다
- 두 편집기 간 Collaboration 병합
- 원격에서 온 블록의 ID를 다시 발급하지 않음

이 테스트는 실제로 회귀를 잡는다. `BlockId` 확장을 빼면 6개 중 5개가 실패한다.

### 검증되지 않은 것

**브라우저에서의 결합은 아직 확인하지 못했다.** Phase 0의 통합 리스크 4개 중 1·2·3번은 걷혔고, 4번(App Router 경계 — SSR 비활성화와 하이드레이션)이 남아 있다. jsdom 테스트는 편집기 로직을 덮지만 Next.js의 렌더 경계는 덮지 못한다.

Playwright 테스트(`tests/e2e/collaboration.spec.ts`)는 작성해 두었으나 실행되지 않는다. Chromium이 시스템 라이브러리를 찾지 못한다. 시스템 브라우저도 없고 `libatk-1.0.so.0`, `libatk-bridge-2.0.so.0`, `libgbm.so.1`, `libasound.so.2`가 모두 빠져 있어 우회할 방법이 없다.

```
error while loading shared libraries: libatk-1.0.so.0
```

해소하려면 관리자 권한이 필요하다.

```
sudo npx playwright install-deps chromium
```

### Phase 1 (앱 프레임)

UI 명세 §29의 Phase 1을 구현했다.

- shadcn/ui(Radix) + 명세 §3 컬러 토큰. shadcn 변수에 매핑해 컴포넌트가 팔레트를 그대로 따른다. 다크 테마는 아직 만들지 않되 토큰으로 정의해 뒀다.
- 3단 셸(§4). 좌 240px / 메인 유동 / 우 360px, 본문 폭 800px 제한. 1024px 아래에서 사이드바가 드로어가 되고, 우측 패널은 오버레이가 된다.
- 사이드바와 페이지 트리(§5). 워크스페이스 드롭다운, 페이지 트리, 하단 메뉴. 아직 화면이 없는 리소스 타입은 링크 대신 비활성으로 두고 이유를 밝힌다(§2).
- 상단 바(§6). 브레드크럼, 저장 상태, 접속자 아바타 스택, 패널 토글.
- 로그인 화면(§8). 필드별 오류, 진행 중 상태, 중복 제출 차단.

편집기의 연결 상태를 `DocumentSession` 컨텍스트로 올렸다. 저장 상태와 접속자를 상단 바와 편집기가 함께 봐야 하는데 둘이 화면에서 떨어져 있기 때문이다.

트리의 현재 페이지는 레이아웃이 알 수 없어(중첩 세그먼트의 param) 클라이언트에서 URL로 읽는다. 펼침은 사용자가 명시적으로 토글한 것만 기억하고 나머지는 현재 페이지의 조상인지로 정한다.

검증은 인증 쿠키를 받아 서버 렌더 결과를 확인하는 방식으로 했다. 페이지 트리, 브레드크럼, 저장 상태, 패널 버튼이 모두 나오고, GUEST(소연)로 접근하면 읽기 전용 안내가 뜨며 토큰이 `view`·`comment`만 담는다. **패널 열고 닫기처럼 JS가 필요한 상호작용은 여전히 미검증이다.**

### 환경 메모

- Node v20.20.2. `@hocuspocus/server@4.x`는 Node ≥22를 요구하므로 server·provider 모두 **v3.4.4로 고정**했다. Node를 22로 올리면 v4로 갈 수 있다.
- 포트 3000이 다른 프로세스에 잡혀 있어 개발 서버가 3003으로 뜬다. Playwright는 3100을 쓴다.
- Node 20에는 전역 `WebSocket`이 없어 `scripts/verify-collab.ts`가 `ws`를 폴리필한다. 브라우저에는 필요 없다.

---

## 다음 세션 이어가기

**다음 행동:** 위 "검증되지 않은 것"을 먼저 해소한다. 시스템 라이브러리를 설치하고 `npm run test:e2e`를 돌려 Tiptap+Yjs 결합을 확인한 뒤, Phase 1(앱 프레임)로 넘어간다.

설계 2/3·3/3은 미작성 상태다. Phase 2~3(AI 제안)에 들어가기 전에는 아래 내용을 정리해야 한다.

### 설계 2/3에서 결정할 것 — 데이터 흐름

작성해야 할 흐름은 세 가지다.

1. **협업 토큰 흐름** — 클라이언트 → `POST /api/resources/:id/collaboration-token` → Auth.js 세션 확인 → 권한 판정 → 짧은 만료 서명 토큰 → `HocuspocusProvider` → `onAuthenticate` 검증 → 연결 context에 permissions 주입
2. **Yjs 저장 흐름** — `onStoreDocument` 디바운스 저장, Snapshot 생성 조건(5분 / 변경 500회 / AI 적용 전후 / 수동), 제목은 REST·본문은 CRDT로 분리
3. **AI 제안 생애주기** — `ai_runs` 생성 → Snapshot → Context Builder → Gateway → 구조화 제안(`baseVersion` 포함) → Diff 화면 → 승인 → Yjs Transaction(`origin = ai-proposal:{id}`) → Snapshot → 활동 기록

미결이던 블록 ID와 `content_version`은 위 "구현 현황"에서 확정했다. 남은 것은 세 흐름을 문서로 정리하는 일이다.

### 설계 3/3에서 결정할 것 — 오류 처리·테스트·범위 경계

- UI 명세 §25의 8가지 상태(정상 / 최초 로딩 / 부분 로딩 / 빈 / 오류 / 권한 없음 / 오프라인 / 재연결)를 어느 컴포넌트 층에서 다룰지
- 권한 없는 작업의 비활성화 + 툴팁 처리 방식 (§2)
- Vitest 대상 목록과 Playwright 시나리오 목록 확정
- "준비 중" 스텁으로 둘 화면 확정 (화이트보드, 자료 상세, 통합 검색, 개인 AI, MCP)

## 목표

UI 명세 §29의 Phase 1~3(앱 프레임 / 공동 문서 / AI·댓글)을 구현한다. 백엔드는 인메모리로 대체하되, 실시간 협업과 권한 경계는 진짜로 동작시킨다.

검증 대상은 아키텍처 §25의 가설 1~3이다.

1. 여러 사용자가 정말 같은 문서를 동시에 편집하는가
2. AI가 별도 채팅보다 문서 안에서 작동할 때 더 유용한가
3. 사용자들이 AI 수정 제안을 실제로 승인해 사용하는가

## 확정된 결정

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| 1 | 진행 방식 | 계획 승인 후 구현 | 빈 폴더 상태에서 구조 확정 비용이 가장 쌈 |
| 2 | MVP 범위 | UI 명세 기준 (댓글·버전 기록 포함) | 화면 설계가 이미 그 전제로 짜여 레이아웃 재작업이 없음 |
| 3 | 저장소 | 단일 Next.js 앱 | 지금은 프론트 프로토타입만 필요. 백엔드 분리 시 `apps/web`으로 이동 |
| 4 | 협업 | 진짜 Yjs + 로컬 Hocuspocus 서버 | 가설 1 검증에 필수. 통합 리스크를 가장 이른 시점에 노출 |
| 5 | 데이터 계층 | Next.js Route Handler + 인메모리 스토어 | §21 REST 명세를 실물로 구현. §17 협업 토큰 검증이 진짜로 동작 |
| 6 | AI | AI Gateway 뒤에 목·진짜 어댑터 병행 | 목은 §28의 충돌 시나리오를 결정적으로 재현, 진짜는 가설 2 검증 |
| 7 | UI 키트 | shadcn/ui + Tailwind | §24 컴포넌트 목록과 1:1 대응, §26 접근성이 Radix에서 기본 제공 |
| 8 | 인증 | Auth.js (Credentials + Google 자리) | 탭마다 다른 사용자 로그인이 자연스럽게 해결 |
| 9 | 테스트 | Vitest(순수 로직) + Playwright(핵심 흐름) | 2-컨텍스트 동시 편집 자동 검증은 Playwright만 가능 |
| 10 | 구현 순서 | 리스크 우선 (Phase 0 선행) | 통합 리스크 4겹을 가장 싼 값에 걷어냄 |

### 결정 10 보충 — Phase 0

명세 Phase 1~3 앞에 스타일 없는 수직 슬라이스를 하나 둔다. 시드 사용자로 로그인해 고정 문서 하나를 두 탭에서 동시 편집하고 커서가 보이는 데까지만 만든다.

이 단계에서 아래 통합 리스크 4개가 한꺼번에 드러난다.

1. Tiptap + Yjs 협업 확장
2. Hocuspocus 서버의 문서 Room·Snapshot
3. Auth.js 세션 → 협업 토큰 발급 → `onAuthenticate` 검증
4. App Router와 클라이언트 전용 편집기의 경계 (SSR 비활성화, 하이드레이션)

Playwright 2-컨텍스트 테스트도 이 시점에 처음 붙인다.

---

## 설계 1/3 — 실행 구조와 디렉터리

### 실행 프로세스

프로세스는 두 개다. Next.js 앱(3000)과 Hocuspocus 협업 서버(1234). `npm run dev`가 `concurrently`로 둘을 함께 띄운다.

저장소는 단일 앱이지만 협업 서버만 별도 프로세스로 둔다. 아키텍처 §19가 협업 엔진을 분리한 이유(연결 수명과 메모리 상태가 일반 API와 다름)를 프로토타입 단계에서도 지키기 위해서다.

협업 서버는 TypeScript로 쓰고 `tsx`로 실행한다. 그래야 `lib/contracts`의 협업 토큰 Zod 스키마를 앱과 공유할 수 있다. 토큰을 발급하는 쪽과 검증하는 쪽이 같은 스키마를 보는 것이 §17 경계의 핵심이다.

### 디렉터리

```
ai-study-board/
├─ app/
│  ├─ (auth)/login, signup, onboarding
│  ├─ (app)/w/[workspaceId]/          # 홈, doc, board, file, search, settings, activity
│  └─ api/                            # Route Handlers = 아키텍처 §21
├─ components/
│  ├─ ui/                             # shadcn/ui
│  ├─ layout/                         # 사이드바, 상단 바, 우측 패널 셸
│  ├─ editor/                         # Tiptap + Yjs (클라이언트 전용)
│  ├─ ai/                             # AI 패널, 제안 Diff
│  └─ comments/, version/
├─ lib/
│  ├─ store/                          # 인메모리 데이터          ← 경계 2
│  ├─ auth/                           # Auth.js 설정, 권한 판정
│  ├─ collab/                         # 협업 토큰, Yjs 프로바이더  ← 경계 1
│  ├─ ai/                             # AI Gateway + 어댑터 2개    ← 경계 3
│  └─ contracts/                      # Zod 스키마 (앱·협업서버 공유)
├─ collab-server/                     # Hocuspocus
├─ tests/unit/, tests/e2e/
└─ docs/
```

### 네 경계와의 대응

아키텍처가 지키라고 한 네 경계 중 셋이 `lib/` 아래 별도 디렉터리로 강제된다.

| 경계 | 위치 |
|---|---|
| 실시간 협업 상태 | `lib/collab/`, `collab-server/` |
| 일반 업무 데이터 | `lib/store/`, `app/api/` |
| AI 실행 | `lib/ai/` |
| 외부 MCP 실행 | 이번 범위 없음 |

넷째인 MCP는 Phase 5라 코드를 두지 않고, `/settings/mcp` 화면만 "준비 중" 스텁으로 둔다.

---

## 남은 작업

- [ ] 설계 2/3 — 데이터 흐름 (협업 토큰 발급부터 Yjs 저장까지, AI 제안의 생애주기)
- [ ] 설계 3/3 — 오류 처리, 테스트 전략, 범위 경계(스텁 처리 대상)
- [ ] 스펙 자체 검토 (플레이스홀더 / 내부 모순 / 범위 / 모호성)
- [ ] 사용자 스펙 리뷰
- [ ] `superpowers:writing-plans`로 구현 계획 작성

## 미결 사항

- git 저장소가 아직 초기화되지 않았다. 설계 문서 커밋 전에 `git init`이 필요하다.
- 실제 Anthropic 어댑터가 사용할 모델 ID는 계획 단계에서 `claude-api` 스킬로 확인해 확정한다.
