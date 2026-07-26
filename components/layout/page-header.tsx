import Link from "next/link";

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, backHref, action }: PageHeaderProps) {
  return (
    <header className="border-border bg-surface flex min-h-16 items-center gap-4 border-b px-6">
      <div className="min-w-0 flex-1">
        {backHref ? <Link href={backHref} className="text-text-tertiary text-xs hover:underline">← 워크스페이스</Link> : null}
        <h1 className="text-xl font-semibold">{title}</h1>
        {description ? <p className="text-text-secondary mt-0.5 text-xs">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
