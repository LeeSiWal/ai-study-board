# AI 스터디 협업 플랫폼 전체 설계

> 최초 작성: 2026-07-26
> 상태: 초안 (와이어프레임/화면 설계 추가 예정)

## 1. 제품 정의

서비스는 여러 사용자가 하나의 스터디 공간에 참여해 다음 작업을 함께 수행하는 플랫폼이다.

- 공동 문서 작성
- 실시간 화이트보드
- 자료 업로드와 정리
- 댓글과 토론
- AI 기반 요약·질문·퀴즈 생성
- 각 사용자의 개인 AI 모델 연결
- 각 사용자의 개인 MCP 연결
- AI 결과를 공동 작업물에 반영
- 변경 이력과 출처 추적

서비스의 기본 단위는 **워크스페이스**다.

```
워크스페이스
 ├─ 멤버
 ├─ 페이지
 │   ├─ 문서
 │   ├─ 화이트보드
 │   ├─ 파일
 │   ├─ 링크
 │   └─ AI 생성 결과
 ├─ 댓글
 ├─ AI 대화
 ├─ 공유 자료
 ├─ 자동화
 └─ 활동 기록
```

---

## 2. 핵심 사용자 흐름

### 공동 학습 흐름

```
사용자 로그인
 → 워크스페이스 참여
 → 공동 문서 또는 화이트보드 열기
 → 여러 사용자가 동시에 편집
 → 자료 업로드
 → 자료를 바탕으로 AI에게 질문
 → AI가 요약·수정안·퀴즈 생성
 → 사용자가 결과 검토
 → 승인한 결과를 공동 문서에 반영
```

### 개인 AI 연결 흐름

```
사용자 설정
 → AI 공급자 연결
 → 사용할 모델 선택
 → 기본 모델 지정
 → 워크스페이스에서 개인 AI 호출
```

### MCP 연결 흐름

```
사용자 설정
 → MCP 서버 연결
 → 도구 목록 조회
 → 도구별 사용 권한 설정
 → AI가 도구 실행 요청
 → 사용자 승인
 → MCP 도구 실행
 → 실행 결과와 감사 로그 저장
```

---

## 3. 가장 중요한 설계 원칙

### 3.1 협업 상태와 일반 데이터베이스 상태를 분리한다

공동 문서 내용과 화이트보드 요소는 일반적인 CRUD 데이터와 성격이 다르다.

**일반 데이터**

- 사용자
- 워크스페이스
- 권한
- 문서 제목
- 폴더 구조
- 댓글
- AI 연결 정보
- 활동 기록

**실시간 협업 데이터**

- 현재 문서 내용
- 화이트보드 요소
- 사용자 커서
- 선택 영역
- 접속 상태
- 동시 편집 변경분

따라서 다음처럼 분리한다.

```
일반 업무 데이터
 → PostgreSQL
실시간 협업 상태
 → CRDT 문서 + WebSocket
접속 상태와 단기 메시지
 → Redis
파일
 → Object Storage
검색과 임베딩
 → PostgreSQL 검색 + Vector Index
```

### 3.2 문서 본문을 REST API로 계속 저장하지 않는다

공동 문서 편집 중 다음처럼 처리하면 안 된다.

```
타이핑
 → PUT /documents/1
 → 데이터베이스 전체 본문 교체
```

여러 사람이 동시에 편집하면 마지막 요청이 앞선 변경을 덮어쓸 수 있다.

대신 문서 자체를 CRDT 문서로 관리한다.

Yjs는 여러 클라이언트가 동시에 공유 타입을 수정해도 변경을 자동 병합하는 CRDT 기반 협업 프레임워크다. 문서 편집뿐 아니라 배열, 맵, 텍스트 같은 공유 자료구조도 제공한다.

```
사용자 A 변경 ─┐
               ├─ CRDT 병합 → 동일한 최종 상태
사용자 B 변경 ─┘
```

### 3.3 AI는 문서의 절대 관리자여서는 안 된다

AI가 공동 문서를 직접 수정하는 구조는 위험하다. 권장 흐름은 다음과 같다.

```
AI가 현재 문서 읽기
 → 수정안 생성
 → 변경 비교 화면
 → 사용자 승인
 → CRDT 트랜잭션으로 반영
 → AI 변경 이력 저장
```

다만 반복적이고 위험도가 낮은 작업은 워크스페이스 정책에 따라 자동 적용할 수 있다.

| 구분 | 대상 |
|---|---|
| 자동 허용 가능 | 맞춤법 교정, 제목 형식 통일, 문서 하단 요약 생성 |
| 승인 필수 | 기존 문장 삭제, 대량 내용 변경, 외부 MCP 도구 실행, 파일 생성·수정, 외부 서비스에 데이터 전송 |

---

## 4. 권장 전체 아키텍처

```
┌──────────────────────────────────────────────────┐
│                  Web Application                 │
│                                                  │
│  문서 편집기   화이트보드   자료실   AI 패널     │
│  Presence      댓글         검색     설정        │
└──────────────┬──────────────────┬────────────────┘
               │ HTTPS            │ WebSocket
               ▼                  ▼
┌────────────────────────┐  ┌──────────────────────┐
│ Application API        │  │ Collaboration Engine │
│                        │  │                      │
│ 인증                   │  │ CRDT Room            │
│ 워크스페이스           │  │ 문서 동기화          │
│ 페이지 구조            │  │ 화이트보드 동기화    │
│ 권한                   │  │ Presence             │
│ 댓글                   │  │ Snapshot             │
│ 파일                   │  └──────────┬───────────┘
│ 검색                   │             │
└──────────┬─────────────┘             │
           │                           │
           ▼                           ▼
┌──────────────────────────────────────────────────┐
│                 Data Infrastructure              │
│                                                  │
│ PostgreSQL     Redis     Object Storage          │
│ Metadata       Cache     Files                   │
│ Permissions    Presence  Preview                 │
│ Search         Queue     Snapshot Backup         │
└──────────────────────────────────────────────────┘
           ▲
           │
┌──────────┴───────────────────────────────────────┐
│                  AI Control Plane                │
│                                                  │
│ AI Gateway                                       │
│ Context Builder                                  │
│ Retrieval Engine                                 │
│ Model Router                                     │
│ MCP Gateway                                      │
│ Approval Engine                                  │
│ Audit Log                                        │
└──────────────────────────┬───────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      Remote MCP Servers          User Local Bridge
                                  ├─ Local MCP
                                  ├─ Local AI
                                  └─ Local Files
```

---

## 5. 프론트엔드 애플리케이션

프론트엔드는 React 기반 웹 애플리케이션이 가장 자연스럽다. 이것은 사용자의 기존 선호 때문이 아니라 다음 제품 특성 때문이다.

- 대규모 인터랙티브 UI
- 문서 편집기와 화이트보드 임베딩
- 다양한 실시간 상태
- 패널·모달·드래그 앤 드롭
- 협업 상태 표시
- AI 스트리밍
- 성숙한 편집기·화이트보드 생태계

### 권장 프론트엔드 구성

```
React
TypeScript
Next.js
TanStack Query
Zustand
Tiptap
Yjs
Excalidraw
Tailwind CSS
Radix UI 또는 shadcn/ui
Zod
```

### Next.js를 선택하는 이유

이 서비스는 초기에는 앱 중심이지만 장기적으로 다음 기능이 들어갈 가능성이 높다.

- 공개 스터디 페이지
- 공개 문서
- 초대 링크
- 자료 공유 페이지
- 검색엔진 노출
- 소셜 미리보기
- 서버 측 인증
- 일부 서버 컴포넌트

따라서 단순 SPA보다 Next.js가 전체 제품 구조에 자연스럽다. 다만 실시간 편집기와 화이트보드는 클라이언트 컴포넌트로 동작한다.

---

## 6. 문서 편집기

### 권장 선택

```
Tiptap
ProseMirror
Yjs
```

Tiptap은 ProseMirror 기반의 헤드리스 편집기이며, UI를 제품에 맞게 자유롭게 구성할 수 있다. 공식적으로 Yjs 기반 실시간 협업 구조를 지원한다.

### 문서 블록

**초기 지원 블록**

```
Paragraph
Heading
Bullet List
Numbered List
Task List
Quote
Code Block
Table
Image
File Attachment
Callout
Divider
Math Block
Embed
```

**추후 지원**

```
AI Answer Block
Quiz Block
Flashcard Block
Diagram Block
Whiteboard Embed
Database View
```

### 문서 데이터 구성

문서 하나는 두 영역으로 나눈다.

```
문서 메타데이터
- document_id
- workspace_id
- title
- icon
- parent_id
- created_by
- permissions
- created_at
- updated_at

문서 협업 상태
- Yjs document
- content fragment
- comments fragment
- metadata fragment
```

문서 제목도 협업 대상으로 처리할 수 있지만, 초기에는 일반 데이터로 관리하는 편이 단순하다.

---

## 7. 실시간 협업 엔진

### 권장 선택

```
Yjs
Hocuspocus
WebSocket
Redis
```

Hocuspocus는 Yjs를 위한 WebSocket 협업 백엔드이며 기존 인프라에 통합하거나 자체 운영할 수 있도록 설계되어 있다.

### 역할

```
Collaboration Engine
 ├─ WebSocket 연결
 ├─ 문서 Room 관리
 ├─ CRDT Update 중계
 ├─ Awareness 중계
 ├─ 인증
 ├─ 권한 확인
 ├─ 문서 로드
 ├─ 문서 저장
 └─ Snapshot 생성
```

### Room 이름

```
doc:{documentId}
board:{whiteboardId}
```

### Presence 데이터

```json
{
  "userId": "user-123",
  "displayName": "시월",
  "avatarUrl": "...",
  "cursorColor": "...",
  "currentBlockId": "...",
  "selection": {
    "from": 120,
    "to": 145
  }
}
```

Yjs의 Awareness는 사용자 커서, 이름, 온라인 상태처럼 영구 저장할 필요가 없는 일시적 협업 정보를 공유하는 데 적합하다.

### 저장 전략

모든 키 입력을 관계형 데이터베이스에 한 행씩 기록하지 않는다.

```
실시간 Yjs Update
 → 메모리 Room
 → 주기적 Update 저장
 → 일정 시점마다 Snapshot 생성
 → 오래된 Update 압축
```

권장 형태:

```
collaboration_documents
- document_key
- latest_state
- state_version
- updated_at

collaboration_updates
- update_id
- document_key
- update_data
- created_at

document_snapshots
- snapshot_id
- document_key
- snapshot_data
- created_by
- created_at
```

Snapshot 생성 조건 예시:

- 5분마다
- 변경 500회마다
- AI 변경 적용 전
- AI 변경 적용 후
- 사용자가 수동 버전 생성

---

## 8. 화이트보드

### 권장 선택

```
Excalidraw
```

Excalidraw는 React 애플리케이션에 임베딩할 수 있는 화이트보드 도구다. 다만 오픈소스 컴포넌트를 임베딩한다고 실시간 협업 서버가 자동으로 제공되는 것은 아니므로 협업 동기화 계층은 별도로 구성해야 한다.

### 화이트보드 기능

```
자유 그리기
텍스트
도형
화살표
포스트잇
이미지
마인드맵
프레임
댓글 핀
문서 링크
사용자 커서
선택 영역
```

### 데이터 모델

화이트보드는 문서와 별도의 CRDT Room을 사용한다.

```
board:{boardId}
```

공유 상태:

```
elements
files
viewport metadata
comments
linked resources
```

개인 UI 상태는 공유하지 않는다.

```
공유하지 않는 상태
- 현재 선택한 도구
- 개인 줌 비율
- 개인 스크롤 위치
- 열린 패널
```

### AI와 화이트보드

AI가 화이트보드에 직접 자유 그리기를 하기보다는 구조화된 명령을 생성하도록 한다.

```json
{
  "operation": "create_mind_map",
  "root": "Transformer",
  "nodes": [
    "Attention",
    "Encoder",
    "Decoder",
    "Positional Encoding"
  ]
}
```

명령을 검증한 뒤 Excalidraw 요소로 변환한다.

---

## 9. 페이지와 자료 구조

문서·화이트보드·파일을 완전히 별개의 메뉴로 분리하면 사용자가 자료를 찾기 어려워진다. 따라서 Notion처럼 하나의 페이지 트리로 통합한다.

```
RESOURCE
- DOCUMENT
- WHITEBOARD
- FILE
- FOLDER
- LINK
- AI_NOTE
```

### 공통 리소스 모델

```
resources
- id
- workspace_id
- parent_id
- type
- title
- icon
- sort_order
- created_by
- created_at
- updated_at
- archived_at
```

타입별 상세 데이터는 별도 테이블로 분리한다.

```
documents
whiteboards
files
links
```

이를 통해 다음 구조가 가능하다.

```
AI 스터디
 ├─ 1주차
 │   ├─ 강의 정리
 │   ├─ 브레인스토밍 보드
 │   └─ 논문.pdf
 ├─ 2주차
 │   ├─ 발표 자료
 │   └─ 참고 링크
 └─ 최종 프로젝트
```

---

## 10. 파일과 자료 처리

### 업로드 흐름

```
파일 업로드 요청
 → 업로드 URL 발급
 → Object Storage에 직접 업로드
 → 업로드 완료 이벤트
 → 파일 검사
 → 텍스트 추출
 → 미리보기 생성
 → 문단·페이지 분할
 → 검색 색인
 → 임베딩 생성
```

### 저장소

```
Object Storage
- 원본 파일
- 미리보기 이미지
- 변환된 문서
- 썸네일
- 내보내기 결과
```

### 지원 형식

**초기**

```
PDF
TXT
Markdown
이미지
소스 코드
URL
```

**추후**

```
DOCX
PPTX
XLSX
오디오
동영상 자막
```

### 자료 상태

```
UPLOADING
SCANNING
PROCESSING
READY
FAILED
QUARANTINED
```

---

## 11. 검색과 RAG

AI 검색과 일반 사용자의 검색을 동일한 검색 계층 위에 구축한다.

### 검색 유형

```
키워드 검색
의미 기반 검색
파일명 검색
태그 검색
작성자 검색
페이지 범위 검색
워크스페이스 범위 검색
```

### 권장 구조

```
PostgreSQL Full Text Search
        +
Vector Search
        +
Metadata Filter
```

초기에는 PostgreSQL과 pgvector만으로 충분하다. 규모가 커지면 검색 엔진을 별도로 분리한다 (OpenSearch 또는 전용 벡터 데이터베이스).

### 검색 결과 단위

```
검색 결과
- resource_id
- chunk_id
- document_title
- page_number
- block_id
- text
- score
- permission
```

AI 답변에는 항상 출처를 포함한다.

```
답변 내용
출처
- attention-is-all-you-need.pdf, 3페이지
- 2주차 정리, "Self-Attention" 문단
```

---

## 12. AI Control Plane

AI 기능을 일반 API 내부에 흩어놓지 않고 별도의 제어 계층으로 관리한다.

```
AI Control Plane
 ├─ AI Gateway
 ├─ Model Registry
 ├─ Model Router
 ├─ Context Builder
 ├─ Retrieval Engine
 ├─ Prompt Registry
 ├─ Tool Executor
 ├─ Approval Engine
 ├─ Usage Meter
 └─ Audit Logger
```

### AI Gateway

모든 모델 호출은 AI Gateway를 거친다.

역할:

```
사용자 모델 선택
API 키 조회
모델별 요청 형식 변환
스트리밍 통일
재시도
시간 제한
토큰 사용량 측정
오류 표준화
```

### 모델 연결 유형

```
서비스 제공 모델
사용자 개인 API 키
사용자 지정 OpenAI 호환 서버
사용자 로컬 모델
워크스페이스 공유 모델
```

### 사용자 AI 연결

```
ai_connections
- id
- owner_user_id
- provider
- connection_type
- encrypted_credentials
- endpoint
- default_model
- status
- created_at
```

API 키는 암호화하여 저장하고 복호화는 AI Gateway 내부에서만 수행한다.

---

## 13. AI 실행 구조

### AI Run

AI 호출 하나를 실행 단위로 관리한다.

```
ai_runs
- id
- workspace_id
- requested_by
- resource_id
- model_connection_id
- model_name
- operation_type
- status
- input_tokens
- output_tokens
- started_at
- completed_at
```

상태:

```
QUEUED
RUNNING
WAITING_APPROVAL
COMPLETED
FAILED
CANCELLED
```

### 실행 흐름

```
사용자 요청
 → 권한 확인
 → 현재 문서 Snapshot 생성
 → Context Builder
 → 자료 검색
 → 모델 실행
 → 필요 시 MCP 도구 요청
 → 승인 대기
 → 결과 생성
 → 제안 저장
 → 사용자에게 스트리밍
```

---

## 14. AI 문서 편집

AI는 단순 문자열 전체를 반환하면 안 된다. 구조화된 변경 제안을 생성한다.

```json
{
  "documentId": "doc-123",
  "baseVersion": 42,
  "operations": [
    {
      "type": "replace_block",
      "blockId": "block-7",
      "content": "수정된 문장"
    },
    {
      "type": "insert_after",
      "blockId": "block-10",
      "content": "새로운 요약 문단"
    }
  ]
}
```

### 충돌 처리

AI가 제안을 생성하는 동안 사람이 문서를 수정할 수 있다. 따라서 `baseVersion`을 확인한다.

```
현재 버전 = AI 기준 버전
 → 바로 Diff 표시
현재 버전 ≠ AI 기준 버전
 → 재기준화
 → 충돌 표시
 → 사용자가 선택
```

### 반영 방식

```
제안 승인
 → AI 변경용 Yjs Transaction 실행
 → transaction origin = ai-proposal:{proposalId}
 → Snapshot 생성
 → 활동 이력 저장
```

이렇게 하면 AI 변경도 일반 사용자의 변경처럼 공동 편집 흐름에 포함된다.

---

## 15. MCP 아키텍처

MCP는 AI 모델이 외부 데이터와 도구에 연결되는 표준화된 인터페이스다. 공식 사양은 도구와 데이터 접근이 강력한 만큼 보안과 신뢰 경계를 명시적으로 다뤄야 한다고 강조한다.

**이 플랫폼은 MCP를 양방향으로 쓴다.** 두 방향은 이름만 같을 뿐 서로 다른 시스템이므로 섞지 않는다.

| | 나가는 방향 (§15.1~15.3) | 들어오는 방향 (§15.4) |
|---|---|---|
| 역할 | 플랫폼이 MCP **클라이언트** | 플랫폼이 MCP **서버** |
| 흐름 | 워크스페이스 안의 AI가 GitHub 같은 외부 도구를 호출 | Claude Desktop·Claude Code 같은 외부 AI가 이 워크스페이스에 붙어 문서를 읽고 수정을 제안 |
| 경계를 지키는 곳 | MCP Gateway (§16) | MCP Server Surface (§16.5) |
| 사용자 화면 | 외부 MCP 서버를 **등록** | 이 워크스페이스의 접속 정보를 **발급** |

두 방향 모두 §3.3의 원칙을 따른다. AI는 문서의 절대 관리자가 아니다. 나가는 방향에서는 도구 실행에 승인이 필요하고, 들어오는 방향에서는 쓰기가 곧바로 반영되지 않고 제안이 된다.

### 15.1 원격 MCP

```
AI Control Plane
 → MCP Gateway
 → Streamable HTTP
 → Remote MCP Server
```

Streamable HTTP는 HTTP POST와 선택적 SSE 스트리밍을 사용하는 원격 MCP 전송 방식이다.

### 15.2 로컬 MCP

```
Cloud Platform
 → 암호화된 장기 연결
 → User Local Bridge
 → stdio MCP Server
```

브라우저나 중앙 서버는 사용자 PC의 stdio 프로세스에 직접 접근할 수 없다. 따라서 별도의 로컬 브리지 프로그램이 필요하다.

```
Local Bridge
 ├─ 로그인
 ├─ 장치 등록
 ├─ 중앙 서버 연결
 ├─ MCP 프로세스 실행
 ├─ stdio 메시지 중계
 ├─ 사용자 승인
 └─ 로컬 로그
```

로컬 브리지는 중앙 서버로 아웃바운드 연결을 생성한다.

```
사용자 PC에서 포트 개방   X
사용자 PC → 중앙 서버 연결   O
```

### 15.4 들어오는 MCP — 워크스페이스를 외부 AI에 연결

위 세 절과 방향이 반대다. 여기서는 **이 플랫폼이 MCP 서버**이고, 사용자의 AI 도구가 클라이언트다.

```
Claude Desktop / Claude Code / 기타 MCP 클라이언트
 → Streamable HTTP
 → MCP Server Surface
 → 권한 판정
 → 워크스페이스 데이터
```

목적은 사용자가 이미 쓰는 AI 도구에서 스터디 자료를 꺼내 쓰는 것이다. 문서를 복사해 붙여넣지 않고, AI가 직접 페이지 트리를 훑고 필요한 문서를 읽는다.

#### 노출하는 도구

| 도구 | 성격 | 설명 |
|---|---|---|
| `list_pages` | 읽기 | 워크스페이스 페이지 트리 |
| `read_page` | 읽기 | 문서 본문을 블록 단위로. 각 블록에 `blockId` 포함 |
| `search_pages` | 읽기 | 제목·본문 검색 |
| `propose_edit` | 쓰기 | 수정 **제안**을 만든다. 문서를 바꾸지 않는다 |

#### 쓰기는 제안으로만

외부 AI가 문서를 직접 바꾸지 않는다. §3.3의 원칙이 연결 출처와 무관하게 적용되기 때문이다. 오히려 외부 AI는 워크스페이스 정책의 바깥에 있으므로 더 엄격해야 한다.

```
외부 AI가 propose_edit 호출
 → blockId 기반 operation으로 저장
 → 워크스페이스 멤버가 UI에서 Diff 확인
 → 승인
 → CRDT 트랜잭션으로 반영
```

이 경로는 §14의 AI 제안과 **완전히 같다**. 제안을 만든 주체가 워크스페이스 안의 AI인지 밖의 AI인지만 다르다. 문서를 바꾸는 통로를 하나로 유지하면 승인·이력·복구가 한 곳에 모인다.

`read_page`가 `blockId`를 함께 돌려주는 이유가 여기 있다. 그게 없으면 외부 AI는 대상을 지목할 수 없어 "문서 끝에 붙이기"밖에 못 한다.

#### 인증

MCP 클라이언트는 브라우저 세션 쿠키를 쓸 수 없다. 사용자가 설정 화면에서 **접속 토큰**을 발급받아 클라이언트 설정에 넣는다.

```
mcp_access_tokens
- id
- owner_user_id
- workspace_id
- name
- token_hash
- scopes
- last_used_at
- expires_at
- revoked_at
```

토큰은 발급 시 한 번만 보여주고 해시만 저장한다. 권한은 토큰 소유자의 워크스페이스 권한을 넘지 못한다. 토큰이 유출돼도 그 사용자가 할 수 있는 일 이상은 불가능하다.

#### 감사

들어오는 호출도 §18의 `audit_logs`에 남긴다. `actor_type`은 `mcp_client`이고, 어떤 토큰이 무엇을 읽고 어떤 제안을 만들었는지 기록한다.

---

## 16. MCP Gateway

AI가 MCP 서버를 직접 호출하지 않는다.

```
AI
 ↓
MCP Gateway
 ↓
정책 검사
 ↓
승인 검사
 ↓
MCP 호출
```

### Gateway 책임

```
연결 소유자 확인
워크스페이스 범위 확인
도구 목록 필터링
입력 스키마 검증
민감 데이터 탐지
승인 필요 여부 확인
호출 횟수 제한
실행 시간 제한
결과 크기 제한
감사 로그
```

### 연결 공유 범위

```
PRIVATE
WORKSPACE
ORGANIZATION
SYSTEM
TEMPORARY
```

**기본값은 반드시 PRIVATE다.**

### 도구 정책

```
DENY
ALLOW
REQUIRE_APPROVAL
```

예시:

```
GitHub MCP
 ├─ repository.read       ALLOW
 ├─ issue.read            ALLOW
 ├─ issue.create          REQUIRE_APPROVAL
 ├─ repository.write      REQUIRE_APPROVAL
 └─ repository.delete     DENY
```

### 승인 화면

```
AI가 외부 도구를 실행하려고 합니다.
연결: 개인 GitHub
도구: issue.create
대상: ai-study/project
내용: 4주차 과제 이슈 생성
[이번만 허용]
[이 도구 항상 허용]
[거절]
```

### 16.5 MCP Server Surface — 들어오는 방향의 경계

§16의 Gateway가 나가는 호출을 지키듯, 들어오는 호출은 Server Surface가 지킨다. 이름이 다른 이유는 막아야 할 것이 다르기 때문이다. Gateway는 *우리 사용자의 자격 증명이 외부로 새는 것*을 막고, Server Surface는 *외부 클라이언트가 권한 밖의 데이터를 가져가는 것*을 막는다.

```
MCP 클라이언트 요청
 ↓
토큰 검증 (해시 대조, 만료·폐기 확인)
 ↓
소유자의 워크스페이스 권한 판정
 ↓
리소스별 권한 필터링
 ↓
도구 실행
 ↓
감사 로그
```

책임:

```
토큰 유효성과 범위 확인
소유자 권한을 넘지 않는지 확인
리소스 목록을 권한으로 걸러내기
쓰기 도구는 제안만 생성
호출 빈도 제한
응답 크기 제한
감사 로그
```

권한 판정은 §17의 함수를 그대로 쓴다. 별도 경로를 만들면 두 곳이 어긋나고, 어긋나는 쪽이 대개 새는 쪽이 된다.

**신뢰 등급.** 외부 MCP 클라이언트가 보낸 지시문은 §23의 Prompt Injection 방어에서 "외부 도구 결과"와 같은 등급이다. 사용자 요청보다 낮다.

---

## 17. 인증과 권한

### 인증

지원 범위:

```
이메일 로그인
소셜 로그인
Passkey
OAuth 연결
장치 인증
```

세션은 HttpOnly, Secure Cookie를 사용한다.

### 워크스페이스 역할

```
OWNER
ADMIN
MEMBER
GUEST
```

역할만으로 모든 권한을 결정하지 않는다. 자원별 권한을 추가한다.

```
VIEW
COMMENT
EDIT
MANAGE
```

### 권한 판정

```
워크스페이스 멤버 여부
        +
역할
        +
자원별 권한
        +
공유 링크 정책
        +
MCP 연결 소유권
```

### 단기 협업 토큰

WebSocket 연결에는 일반 로그인 자격 증명을 URL에 그대로 넣지 않는다.

```
클라이언트
 → 협업 토큰 요청
 → API가 문서 권한 확인
 → 짧은 만료 시간의 서명 토큰 발급
 → Collaboration Server 접속
 → 토큰 검증
```

토큰 내용:

```json
{
  "userId": "user-123",
  "workspaceId": "workspace-1",
  "resourceId": "doc-7",
  "permissions": ["view", "edit"],
  "expiresAt": 1750000000
}
```

---

## 18. 데이터베이스 핵심 모델

```
users
- id
- email
- display_name
- avatar_url
- status
- created_at

workspaces
- id
- name
- description
- owner_user_id
- visibility
- created_at

workspace_members
- workspace_id
- user_id
- role
- status
- joined_at

resources
- id
- workspace_id
- parent_id
- type
- title
- sort_order
- created_by
- created_at
- updated_at
- archived_at

documents
- resource_id
- collaboration_key
- plain_text_cache
- latest_snapshot_id
- content_version

whiteboards
- resource_id
- collaboration_key
- latest_snapshot_id
- thumbnail_url

files
- resource_id
- object_key
- original_name
- mime_type
- size
- processing_status
- uploaded_by

comments
- id
- resource_id
- parent_comment_id
- block_reference
- author_user_id
- content
- resolved_at
- created_at

ai_connections
- id
- owner_user_id
- provider
- endpoint
- encrypted_credentials
- default_model
- status

mcp_connections
- id
- owner_user_id
- name
- transport
- endpoint
- encrypted_credentials
- sharing_scope
- status

mcp_tool_policies
- id
- connection_id
- workspace_id
- tool_name
- policy

ai_runs
- id
- workspace_id
- resource_id
- requested_by
- connection_id
- operation_type
- status
- started_at
- completed_at

ai_proposals
- id
- ai_run_id
- resource_id
- base_version
- operations_json
- status
- approved_by
- applied_at

audit_logs
- id
- workspace_id
- actor_type
- actor_id
- action
- target_type
- target_id
- metadata
- created_at
```

---

## 19. 백엔드 기술 선택

### 자연스러운 선택

```
TypeScript
Node.js
NestJS 또는 경량 모듈형 프레임워크
PostgreSQL
Redis
Object Storage
```

이 선택은 프론트와 언어를 통일하기 위해서만이 아니다. 이 제품의 중심 기능이 다음과 밀접하기 때문이다.

- WebSocket
- Yjs
- Hocuspocus
- AI 스트리밍
- MCP TypeScript SDK
- 이벤트 기반 처리
- JSON 스키마
- 실시간 협업

### 서비스 구성

초기에는 다음 네 개의 실행 단위가 적절하다.

```
Web Application
Application API
Collaboration Engine
Background Worker
```

AI와 MCP는 초기에는 Application API 내부 모듈로 시작한다. 규모가 커질 때 분리한다.

```
AI Control Plane
MCP Gateway
Search Service
Document Processing Service
```

### 처음부터 마이크로서비스를 쓰지 않는 이유

이 서비스는 기능 경계가 많지만 초기에는 데이터 일관성이 더 중요하다. 처음부터 서비스별 데이터베이스를 나누면 다음 문제가 생긴다.

```
권한 동기화
사용자 ID 전달
트랜잭션 경계
분산 추적
배포 복잡도
로컬 개발 복잡도
```

따라서 초기에는 **모듈형 모놀리스 + 별도 협업 서버**가 가장 자연스럽다.

```
Application API
 ├─ Auth Module
 ├─ Workspace Module
 ├─ Resource Module
 ├─ File Module
 ├─ Search Module
 ├─ AI Module
 ├─ MCP Module
 └─ Audit Module

Collaboration Engine
 └─ 별도 실행
```

협업 엔진만 별도로 두는 이유는 연결 수명, 메모리 상태, WebSocket 확장 방식이 일반 API와 다르기 때문이다.

---

## 20. 모노레포 구조

```
ai-study/
├─ apps/
│  ├─ web/
│  ├─ api/
│  ├─ collaboration/
│  ├─ worker/
│  └─ local-bridge/
│
├─ packages/
│  ├─ ui/
│  ├─ domain/
│  ├─ contracts/
│  ├─ validation/
│  ├─ collaboration-schema/
│  ├─ ai-schema/
│  └─ mcp-policy/
│
├─ infrastructure/
│  ├─ docker/
│  ├─ kubernetes/
│  ├─ migrations/
│  └─ observability/
│
└─ docs/
   ├─ architecture/
   ├─ api/
   ├─ threat-model/
   └─ adr/
```

### 공통 계약

프론트와 서버는 타입 구현을 직접 공유하기보다 외부 계약을 공유한다.

```
REST Schema
WebSocket Event Schema
AI Proposal Schema
MCP Policy Schema
```

Zod 또는 JSON Schema를 단일 소스로 사용한다.

---

## 21. API 영역

### 인증

```
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/session
```

### 워크스페이스

```
GET   /workspaces
POST  /workspaces
GET   /workspaces/:id
PATCH /workspaces/:id
POST  /workspaces/:id/invitations
GET   /workspaces/:id/members
```

### 리소스

```
GET    /workspaces/:id/resources
POST   /workspaces/:id/resources
PATCH  /resources/:id
DELETE /resources/:id
POST   /resources/:id/move
```

### 공동 편집

```
POST /resources/:id/collaboration-token
GET  /resources/:id/snapshots
POST /resources/:id/snapshots
POST /resources/:id/restore
```

실제 본문 변경은 REST가 아니라 WebSocket과 CRDT로 처리한다.

### AI

```
POST /ai/runs
GET  /ai/runs/:id
POST /ai/runs/:id/cancel
GET  /resources/:id/proposals
POST /proposals/:id/approve
POST /proposals/:id/reject
```

### MCP

```
GET   /mcp/connections
POST  /mcp/connections
POST  /mcp/connections/:id/discover
GET   /mcp/connections/:id/tools
PATCH /mcp/connections/:id/policies
POST  /mcp/approvals/:id/approve
POST  /mcp/approvals/:id/reject
```

---

## 22. 이벤트 구조

비동기 작업은 이벤트 기반으로 연결한다.

```
file.uploaded
file.processing.started
file.processing.completed
resource.created
document.snapshot.created
ai.run.started
ai.tool.approval.required
ai.run.completed
mcp.tool.executed
```

초기에는 Redis 기반 Queue를 사용할 수 있다. 규모가 커지고 이벤트 재처리가 중요해지면 Kafka나 별도 메시지 브로커를 검토한다.

---

## 23. 보안 설계

### 주요 위험

```
다른 사용자의 AI 키 노출
개인 MCP 무단 사용
AI를 통한 권한 우회
Prompt Injection
악성 파일 업로드
공유 문서 데이터 유출
WebSocket 권한 우회
AI의 대량 문서 파괴
```

### 대응

```
API 키 암호화
MCP 연결 기본 비공개
도구별 승인 정책
문서별 접근 권한
AI 입력과 도구 결과 분리
파일 검사
짧은 만료 협업 토큰
AI 변경 Diff 승인
Snapshot과 복구
감사 로그
Rate Limit
```

### Prompt Injection 방어

업로드 자료의 지시문을 시스템 지시로 취급하면 안 된다. 신뢰 우선순위:

```
시스템 정책
> 사용자 요청
> 워크스페이스 정책
> 검색된 자료
> 외부 도구 결과
```

검색된 자료와 MCP 결과에는 낮은 신뢰 등급을 부여한다.

---

## 24. MVP 재정의

전체 설계는 넓지만 첫 구현은 작아야 한다.

### MVP 1

```
로그인
워크스페이스
멤버 초대
공동 문서
실시간 커서
문서 자동 저장
기본 Snapshot
서비스 제공 AI 한 종류
문서 요약
AI 수정 제안
승인 후 적용
```

### MVP 2

```
화이트보드
파일 업로드
PDF 텍스트 추출
워크스페이스 검색
자료 기반 AI 질문
출처 표시
```

### MVP 3

```
사용자 개인 AI 연결
원격 MCP
도구별 승인
MCP 실행 감사 로그
```

### MVP 4

```
로컬 브리지
stdio MCP
로컬 AI
로컬 파일 접근
워크스페이스 자동화
```

---

## 25. MVP에서 반드시 검증할 가설

기술 구현보다 다음을 먼저 검증해야 한다.

1. 여러 사용자가 정말 같은 문서를 동시에 편집하는가?
2. AI가 별도 채팅보다 문서 안에서 작동할 때 더 유용한가?
3. 사용자들이 AI 수정 제안을 실제로 승인해 사용하는가?
4. 개인 AI 연결에 대한 수요가 있는가?
5. MCP 연결이 학습 활동을 실질적으로 개선하는가?

초기 사용 지표:

```
워크스페이스 생성 수
주간 공동 편집 문서 수
문서당 동시 접속자 수
AI 요청 수
AI 제안 승인율
AI 제안 부분 승인율
자료 출처 클릭률
MCP 도구 승인율
```

---

## 26. 최종 권장 구조

**클라이언트**

```
React
Next.js
Tiptap
Excalidraw
Yjs
TanStack Query
Zustand
```

**애플리케이션 서버**

```
TypeScript 기반 모듈형 API
PostgreSQL
Redis
Object Storage
```

**협업 서버**

```
Hocuspocus
Yjs
WebSocket
Redis 기반 확장
```

**AI**

```
AI Gateway
Context Builder
Retrieval Engine
Model Router
Proposal Engine
```

**MCP**

```
MCP Gateway
Remote MCP
Local Bridge
Tool Policy
Approval Engine
Audit Log
```

### 전체 핵심

```
워크스페이스
      │
      ├─ 실시간 공동 문서
      ├─ 실시간 화이트보드
      ├─ 자료와 검색
      ├─ 사용자별 AI
      └─ 사용자별 MCP
              │
              ▼
       권한·승인·감사 계층
```

이 설계에서 가장 중요한 것은 특정 프레임워크가 아니다. 핵심은 다음 **네 가지 경계**를 유지하는 것이다.

```
실시간 협업 상태
일반 업무 데이터
AI 실행
외부 MCP 실행
```

이 네 영역을 섞지 않으면 초기에는 단순하게 만들 수 있고, 사용자가 늘어난 뒤에도 자연스럽게 분리하고 확장할 수 있다.
