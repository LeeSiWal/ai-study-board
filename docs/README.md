# AI 스터디 협업 플랫폼 — 문서 색인

2026-07-26 기준 프론트엔드 프로토타입 Phase 0~3을 구현했다.

```bash
npm run dev            # Next.js 앱 + 협업 서버
npm run verify:collab  # 브라우저 없이 협업 계층 검증
npm run test:e2e       # Playwright 브라우저 통합 테스트
```

## 문서

| 문서 | 내용 | 상태 |
|---|---|---|
| [architecture/overview.md](architecture/overview.md) | 제품 정의부터 데이터 모델·보안·MVP 단계까지 전체 아키텍처 설계 (26개 절) | 확정 |
| [design/ui-spec.md](design/ui-spec.md) | 화면 구조와 상호작용 기준 명세. 컬러 토큰, 3단 레이아웃, 라우트 표, Phase 1~5 우선순위 (32개 절) | 확정 |
| [superpowers/specs/2026-07-26-frontend-prototype-design.md](superpowers/specs/2026-07-26-frontend-prototype-design.md) | 프로토타입 구현 설계. 확정된 결정 10개와 설계 1/3 | **작성 중** |

## 지금 이어서 할 일

프로토타입 설계 문서의 [구현 현황](superpowers/specs/2026-07-26-frontend-prototype-design.md#구현-현황-2026-07-26) 절부터 읽으면 된다.

Phase 1~3 프로토타입 범위는 완료했다. 현재 공동
문서에는 제목 편집, 기본 블록 편집, 슬래시 메뉴, 선택 툴바, 저장 상태,
접속자와 협업 커서, 할 일 목록과 표가 구현되어 있다. AI 패널은 스트리밍,
현재 문서 컨텍스트, Diff·승인·충돌·실행 취소 흐름을 제공하고 댓글은 블록
연결, 답글, 해결 상태를 제공한다.

## 설계에서 가장 중요한 원칙

아키텍처 전체를 관통하는 제약은 네 가지 경계를 섞지 않는 것이다.

1. 실시간 협업 상태 (Yjs CRDT + WebSocket)
2. 일반 업무 데이터 (PostgreSQL, 프로토타입에서는 인메모리)
3. AI 실행 (AI Control Plane)
4. 외부 MCP 실행 (MCP Gateway)

여기서 파생되는 두 가지 위반 조건이 있다.

- 문서 본문을 REST `PUT`으로 저장하지 않는다.
- AI는 문서를 직접 수정하지 않고 제안 → 승인 → CRDT 트랜잭션으로만 반영한다.
