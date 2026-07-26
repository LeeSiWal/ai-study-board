import type {
  DocumentMeta,
  Resource,
  User,
  Workspace,
  WorkspaceMember,
} from "./types";

/**
 * 시드 데이터.
 *
 * UI 명세 §28 "목 데이터 기준"을 그대로 옮겼다.
 * 워크스페이스는 `AI 논문 스터디`, 멤버 6명, 페이지 트리도 명세와 같다.
 */

/** 프로토타입 공용 비밀번호. 모든 시드 사용자가 같은 값을 쓴다. */
export const SEED_PASSWORD = "study1234";

export const SEED_USERS: User[] = [
  {
    id: "user-siwol",
    email: "siwol@example.com",
    displayName: "시월",
    password: SEED_PASSWORD,
    cursorColor: "#4F67E8",
  },
  {
    id: "user-minji",
    email: "minji@example.com",
    displayName: "민지",
    password: SEED_PASSWORD,
    cursorColor: "#218A61",
  },
  {
    id: "user-hyunwoo",
    email: "hyunwoo@example.com",
    displayName: "현우",
    password: SEED_PASSWORD,
    cursorColor: "#B7791F",
  },
  {
    id: "user-jieun",
    email: "jieun@example.com",
    displayName: "지은",
    password: SEED_PASSWORD,
    cursorColor: "#C94343",
  },
  {
    id: "user-taeho",
    email: "taeho@example.com",
    displayName: "태호",
    password: SEED_PASSWORD,
    cursorColor: "#6756D8",
  },
  {
    id: "user-soyeon",
    email: "soyeon@example.com",
    displayName: "소연",
    password: SEED_PASSWORD,
    cursorColor: "#0E7C8A",
  },
];

export const SEED_WORKSPACE: Workspace = {
  id: "workspace-ai-papers",
  name: "AI 논문 스터디",
  description: "매주 논문 한 편을 함께 읽고 정리합니다.",
  ownerUserId: "user-siwol",
};

export const SEED_MEMBERS: WorkspaceMember[] = [
  { workspaceId: SEED_WORKSPACE.id, userId: "user-siwol", role: "OWNER" },
  { workspaceId: SEED_WORKSPACE.id, userId: "user-minji", role: "ADMIN" },
  { workspaceId: SEED_WORKSPACE.id, userId: "user-hyunwoo", role: "MEMBER" },
  { workspaceId: SEED_WORKSPACE.id, userId: "user-jieun", role: "MEMBER" },
  { workspaceId: SEED_WORKSPACE.id, userId: "user-taeho", role: "MEMBER" },
  { workspaceId: SEED_WORKSPACE.id, userId: "user-soyeon", role: "GUEST" },
];

/**
 * 페이지 트리 (UI 명세 §28)
 *
 * AI 논문 스터디
 * ├─ 공지와 일정
 * ├─ 1주차
 * │  ├─ Transformer 개요
 * │  ├─ Attention Is All You Need.pdf
 * │  └─ 토론 화이트보드
 * ├─ 2주차
 * │  ├─ Self-Attention 정리
 * │  └─ 예상 질문
 * └─ 최종 프로젝트
 */
export const SEED_RESOURCES: Resource[] = [
  {
    id: "res-notice",
    workspaceId: SEED_WORKSPACE.id,
    parentId: null,
    type: "DOCUMENT",
    title: "공지와 일정",
    icon: "📌",
    sortOrder: 0,
    createdBy: "user-siwol",
  },
  {
    id: "res-week1",
    workspaceId: SEED_WORKSPACE.id,
    parentId: null,
    type: "FOLDER",
    title: "1주차",
    icon: null,
    sortOrder: 1,
    createdBy: "user-siwol",
  },
  {
    id: "res-transformer-overview",
    workspaceId: SEED_WORKSPACE.id,
    parentId: "res-week1",
    type: "DOCUMENT",
    title: "Transformer 개요",
    icon: null,
    sortOrder: 0,
    createdBy: "user-minji",
  },
  {
    id: "res-attention-pdf",
    workspaceId: SEED_WORKSPACE.id,
    parentId: "res-week1",
    type: "FILE",
    title: "Attention Is All You Need.pdf",
    icon: null,
    sortOrder: 1,
    createdBy: "user-hyunwoo",
  },
  {
    id: "res-week1-board",
    workspaceId: SEED_WORKSPACE.id,
    parentId: "res-week1",
    type: "WHITEBOARD",
    title: "토론 화이트보드",
    icon: null,
    sortOrder: 2,
    createdBy: "user-hyunwoo",
  },
  {
    id: "res-week2",
    workspaceId: SEED_WORKSPACE.id,
    parentId: null,
    type: "FOLDER",
    title: "2주차",
    icon: null,
    sortOrder: 2,
    createdBy: "user-siwol",
  },
  {
    id: "res-self-attention",
    workspaceId: SEED_WORKSPACE.id,
    parentId: "res-week2",
    type: "DOCUMENT",
    title: "Self-Attention 정리",
    icon: null,
    sortOrder: 0,
    createdBy: "user-siwol",
  },
  {
    id: "res-expected-questions",
    workspaceId: SEED_WORKSPACE.id,
    parentId: "res-week2",
    type: "DOCUMENT",
    title: "예상 질문",
    icon: null,
    sortOrder: 1,
    createdBy: "user-minji",
  },
  {
    id: "res-final-project",
    workspaceId: SEED_WORKSPACE.id,
    parentId: null,
    type: "FOLDER",
    title: "최종 프로젝트",
    icon: null,
    sortOrder: 3,
    createdBy: "user-siwol",
  },
];

/** Phase 0에서 동시 편집을 시연하는 문서 (UI 명세 §28의 "현재 문서") */
export const DEMO_DOCUMENT_ID = "res-self-attention";

export const SEED_DOCUMENTS: DocumentMeta[] = SEED_RESOURCES.filter(
  (resource) => resource.type === "DOCUMENT",
).map((resource) => ({
  resourceId: resource.id,
  collaborationKey: `doc:${resource.id}`,
}));
