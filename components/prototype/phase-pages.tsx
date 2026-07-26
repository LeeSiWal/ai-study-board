"use client";

import {
  ArrowRight,
  Bot,
  Check,
  Circle,
  FileText,
  Hand,
  Image,
  Link2,
  MousePointer2,
  Search,
  Send,
  Square,
  StickyNote,
  Upload,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Resource, User, WorkspaceMember, WorkspaceRole } from "@/lib/store/types";

export function MembersManager({
  users,
  members,
}: {
  users: User[];
  members: WorkspaceMember[];
}) {
  const [rows, setRows] = useState(() => members.map((member) => ({
    ...member,
    user: users.find((user) => user.id === member.userId)!,
  })));
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");

  return (
    <div className="space-y-4">
      <form className="flex gap-2 rounded-xl border bg-surface p-4" onSubmit={(event) => {
        event.preventDefault();
        if (!email.includes("@")) return setNotice("올바른 이메일을 입력해 주세요.");
        setNotice(`${email}로 MEMBER 초대를 보냈습니다.`);
        setEmail("");
      }}>
        <Input aria-label="초대 이메일" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="이메일로 멤버 초대" />
        <Button type="submit"><Send className="size-4" /> 초대</Button>
      </form>
      <p aria-live="polite" className="text-success text-xs">{notice}</p>
      <div className="overflow-hidden rounded-xl border bg-surface">
        {rows.map(({ user, role }) => (
          <div key={user.id} className="border-border flex items-center gap-3 border-b p-4 last:border-0">
            <span className="flex size-9 items-center justify-center rounded-full text-white" style={{ background: user.cursorColor }}>{user.displayName[0]}</span>
            <div className="min-w-0 flex-1"><p className="font-medium">{user.displayName}</p><p className="text-text-secondary text-xs">{user.email}</p></div>
            <span className="text-success text-xs">활성</span>
            <select
              aria-label={`${user.displayName} 역할`}
              value={role}
              disabled={role === "OWNER"}
              onChange={(event) => setRows((current) => current.map((row) => row.userId === user.id ? { ...row, role: event.target.value as WorkspaceRole } : row))}
              className="rounded-md border bg-surface px-2 py-1.5 text-xs"
            >
              {["ADMIN", "MEMBER", "GUEST"].map((item) => <option key={item}>{item}</option>)}
              {role === "OWNER" ? <option>OWNER</option> : null}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceSettings() {
  const [name, setName] = useState("AI 논문 스터디");
  const [description, setDescription] = useState("매주 논문 한 편을 함께 읽고 정리합니다.");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border bg-surface p-5">
        <h2 className="font-semibold">일반</h2>
        <label className="block text-xs">워크스페이스 이름<Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block text-xs">설명<Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <Button onClick={() => setSaved(true)}>변경사항 저장</Button>
        {saved ? <span className="text-success ml-2 text-xs">저장했습니다.</span> : null}
      </section>
      <section className="space-y-3 rounded-xl border bg-surface p-5">
        <h2 className="font-semibold">AI 정책</h2>
        <Toggle label="워크스페이스에서 AI 사용 허용" checked={aiEnabled} onChange={setAiEnabled} />
        <Toggle label="맞춤법과 제목 형식 자동 적용" checked={true} />
        <p className="text-text-secondary text-xs">삭제, 대량 수정, 외부 도구 사용은 항상 승인이 필요합니다.</p>
      </section>
      <section className="border-danger/30 rounded-xl border bg-surface p-5">
        <h2 className="text-danger font-semibold">위험 구역</h2>
        <p className="text-text-secondary my-2 text-xs">보관과 삭제는 재확인 후 수행되며 프로토타입에서는 실행되지 않습니다.</p>
        <Button variant="destructive" disabled>워크스페이스 삭제</Button>
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange?: (value: boolean) => void }) {
  return <label className="flex items-center justify-between text-sm">{label}<input type="checkbox" checked={checked} onChange={(e) => onChange?.(e.target.checked)} /></label>;
}

export function SearchPage({ workspaceId, resources }: { workspaceId: string; resources: Resource[] }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => resources.filter((resource) => resource.title.toLowerCase().includes(query.toLowerCase())), [query, resources]);
  const segment = (type: Resource["type"]) => type === "DOCUMENT" ? "doc" : type === "WHITEBOARD" ? "board" : type === "FILE" ? "file" : null;
  return (
    <div className="space-y-4">
      <div className="relative"><Search className="text-text-tertiary absolute top-3 left-3 size-4" /><Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 pl-9" placeholder="페이지, 자료 또는 내용을 검색하세요" /></div>
      <div className="rounded-xl border bg-surface p-2">
        {!results.length ? <p className="text-text-secondary p-8 text-center">“{query}”와 일치하는 결과가 없습니다.</p> : results.map((resource) => {
          const route = segment(resource.type);
          const content = <><FileText className="text-text-tertiary size-4" /><div><p>{resource.title}</p><p className="text-text-tertiary text-xs">{resource.type} · AI 논문 스터디</p></div><ArrowRight className="ml-auto size-4" /></>;
          return route ? <Link key={resource.id} href={`/w/${workspaceId}/${route}/${resource.id}`} className="hover:bg-surface-subtle flex items-center gap-3 rounded-lg p-3">{content}</Link> : <div key={resource.id} className="flex items-center gap-3 p-3 opacity-60">{content}</div>;
        })}</div>
    </div>
  );
}

const BOARD_TOOLS = [
  ["선택", MousePointer2], ["손", Hand], ["사각형", Square], ["원", Circle], ["포스트잇", StickyNote], ["이미지", Image],
] as const;

export function Whiteboard({ title }: { title: string }) {
  const [tool, setTool] = useState("선택");
  const [notes, setNotes] = useState([{ id: 1, text: "Self-Attention", x: 32, y: 28 }]);
  return (
    <div className="relative min-h-[calc(100vh-8rem)] overflow-hidden rounded-xl border bg-[radial-gradient(#dfe3e8_1px,transparent_1px)] [background-size:20px_20px]">
      <div className="absolute top-3 left-3 z-10 flex gap-1 rounded-xl border bg-surface p-1 shadow">
        {BOARD_TOOLS.map(([label, Icon]) => <Button key={label} size="icon" variant={tool === label ? "secondary" : "ghost"} aria-label={label} onClick={() => {
          setTool(label);
          if (label === "포스트잇") setNotes((items) => [...items, { id: Date.now(), text: "새 메모", x: 180 + items.length * 20, y: 120 }]);
        }}><Icon className="size-4" /></Button>)}
      </div>
      <p className="text-text-tertiary absolute top-4 right-4 text-xs">{title} · 도구: {tool} · 100%</p>
      {notes.map((note) => <div key={note.id} style={{ left: note.x, top: note.y }} className="absolute w-40 rounded-md border border-amber-300 bg-amber-100 p-4 shadow-sm"><textarea aria-label="포스트잇 내용" value={note.text} onChange={(e) => setNotes((items) => items.map((item) => item.id === note.id ? { ...item, text: e.target.value } : item))} className="h-20 w-full resize-none bg-transparent outline-none" /></div>)}
      <div className="absolute right-5 bottom-5 flex -space-x-2"><span className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-primary text-white">시</span><span className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-success text-white">민</span></div>
    </div>
  );
}

export function FileDetail({ title }: { title: string }) {
  const [status, setStatus] = useState<"PROCESSING" | "READY" | "FAILED">("PROCESSING");
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="flex min-h-120 items-center justify-center rounded-xl border bg-surface-subtle">
        {status === "READY" ? <div className="max-w-lg space-y-4 bg-white p-10 shadow"><h2 className="text-xl font-semibold">Attention Is All You Need</h2><p className="leading-7">The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...</p></div> : <div className="text-center"><Upload className="mx-auto mb-3 size-8" /><p>{status === "FAILED" ? "텍스트 추출에 실패했습니다." : "텍스트를 추출하고 검색을 준비하고 있습니다."}</p></div>}
      </div>
      <aside className="space-y-4 rounded-xl border bg-surface p-4">
        <h2 className="font-semibold">{title}</h2><p className="text-text-secondary text-xs">PDF · 2.1MB · 현우</p>
        <p className={status === "READY" ? "text-success" : status === "FAILED" ? "text-danger" : "text-warning"}>{status}</p>
        {status === "PROCESSING" ? <Button className="w-full" onClick={() => setStatus("READY")}>처리 완료 시연</Button> : null}
        {status === "FAILED" ? <Button className="w-full" onClick={() => setStatus("PROCESSING")}>다시 처리</Button> : null}
        <Button variant="outline" className="w-full"><Bot className="size-4" /> 이 자료에 질문</Button>
        <Button variant="ghost" className="w-full"><Link2 className="size-4" /> 링크 복사</Button>
      </aside>
    </div>
  );
}

export function AiConnections() {
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-surface p-5">
        <div className="flex items-center gap-3"><Bot className="size-6" /><div className="flex-1"><h2 className="font-semibold">{connected ? "개인 OpenAI 호환 서버" : "서비스 제공 기본 모델"}</h2><p className="text-text-secondary text-xs">{connected ? "sk-•••••••• · gpt-compatible" : "Study AI · 연결됨"}</p></div><span className="text-success text-xs">정상</span></div>
      </div>
      <section className="space-y-3 rounded-xl border bg-surface p-5"><h2 className="font-semibold">연결 추가</h2><Input placeholder="OpenAI 호환 서버 URL" /><Input type="password" placeholder="API 키 (저장 후 다시 표시하지 않음)" /><p className="text-text-secondary text-xs">이 키는 개인 연결이며 워크스페이스에 자동 공유되지 않습니다.</p><Button variant="outline" onClick={() => { setTesting(true); setTimeout(() => { setTesting(false); setConnected(true); }, 500); }}>{testing ? "연결 확인 중…" : "연결 테스트 및 저장"}</Button></section>
    </div>
  );
}

export function McpConnections() {
  const [connected, setConnected] = useState(false);
  const [approval, setApproval] = useState(false);
  const [log, setLog] = useState("");
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border bg-surface p-5"><h2 className="font-semibold">MCP 연결</h2><Input placeholder="서버 이름" defaultValue="GitHub MCP" /><Input placeholder="HTTPS endpoint" defaultValue="https://mcp.example.com" /><p className="text-text-secondary text-xs">기본 공유 범위: PRIVATE</p><Button onClick={() => setConnected(true)}>{connected ? <><Check className="size-4" /> 연결됨</> : "연결 테스트"}</Button></section>
      {connected ? <section className="rounded-xl border bg-surface p-5"><h2 className="font-semibold">사용 가능한 도구</h2><div className="mt-3 flex items-center gap-3"><Wrench className="size-5" /><div className="flex-1"><p>issue.create</p><p className="text-text-secondary text-xs">저장소에 새 이슈를 만듭니다.</p></div><select className="rounded border p-2 text-xs" defaultValue="ask"><option value="deny">허용 안 함</option><option value="ask">실행 전 승인</option><option value="allow">항상 허용</option></select><Button size="sm" onClick={() => setApproval(true)}>실행 시연</Button></div></section> : null}
      {approval ? <div role="dialog" aria-label="MCP 실행 승인" className="rounded-xl border-2 border-primary bg-surface p-5 shadow-lg"><h2 className="font-semibold">MCP 실행 승인</h2><p className="my-3 text-sm">GitHub MCP의 <strong>issue.create</strong>가 제목과 설명을 외부 서비스로 전송합니다.</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setApproval(false)}>거절</Button><Button onClick={() => { setApproval(false); setLog("이번 실행을 승인했고 issue.create가 완료되었습니다."); }}>이번만 허용</Button></div></div> : null}
      {log ? <p className="text-success text-sm">{log}</p> : null}
    </div>
  );
}

export function ActivityFeed() {
  const [filter, setFilter] = useState("전체");
  const events = [
    ["사용자", "민지가 “Self-Attention 정리”를 수정했습니다.", "5분 전"],
    ["AI", "Study AI의 제안 1개를 시월이 승인했습니다.", "12분 전"],
    ["MCP", "GitHub MCP가 issue.create를 실행했습니다.", "1시간 전"],
    ["사용자", "현우가 Attention Is All You Need.pdf를 업로드했습니다.", "어제"],
  ];
  const visible = events.filter(([type]) => filter === "전체" || filter === type);
  return <div className="space-y-4"><div className="flex gap-2">{["전체", "사용자", "AI", "MCP"].map((item) => <Button key={item} size="sm" variant={filter === item ? "secondary" : "outline"} onClick={() => setFilter(item)}>{item}</Button>)}</div><div className="rounded-xl border bg-surface">{visible.map(([type, text, time]) => <div key={text} className="flex gap-3 border-b p-4 last:border-0"><span className="bg-surface-subtle flex size-9 items-center justify-center rounded-full">{type === "AI" ? <Bot className="size-4" /> : type === "MCP" ? <Wrench className="size-4" /> : <Users className="size-4" />}</span><div className="flex-1"><p>{text}</p><p className="text-text-tertiary mt-1 text-xs">{time} · 권한 결정 및 관련 버전 보기</p></div></div>)}</div></div>;
}
