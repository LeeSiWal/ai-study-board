import { PageHeader } from "@/components/layout/page-header";
import { ActivityFeed } from "@/components/prototype/phase-pages";
export default function ActivityPage() { return <><PageHeader title="활동 기록" description="사람, AI와 외부 도구의 변경을 추적합니다." /><main className="flex-1 overflow-y-auto p-6"><div className="mx-auto max-w-4xl"><ActivityFeed /></div></main></>; }
