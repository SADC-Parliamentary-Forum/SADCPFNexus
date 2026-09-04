"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { procurementWorkbenchApi } from "@/lib/api";

type InboxRow = {
  id: number;
  from_email: string;
  subject: string | null;
  received_at: string | null;
  status: string;
  intake_id: number | null;
};

export default function ProcurementInboxPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["procurement", "inbox"],
    queryFn: () => procurementWorkbenchApi.inbox().then((r) => r.data),
  });
  const payload = data as {
    data?: { data?: InboxRow[] };
    imap_configured?: boolean;
    note?: string | null;
  };
  const rows = payload?.data?.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Procurement Inbox"
        subtitle="IMAP is not configured. Upload remains the live invoice intake path."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Procurement", href: "/procurement" }, { label: "Inbox" }]} />}
      />
      {payload?.note && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{payload.note}</p>
      )}
      {isLoading && <p className="text-sm text-neutral-500">Loading inbox…</p>}
      {isError && <p className="text-sm text-rose-700">Could not load the procurement inbox.</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-neutral-500">No forwarded invoices. IMAP is not configured — upload a PDF or DOCX from Create from Invoice / Quote.</p>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{row.subject || "Supplier document"}</p>
              <p className="text-neutral-600">{row.from_email} · {row.status}</p>
            </div>
            {row.intake_id ? (
              <Link href={`/procurement/from-document?intake=${row.intake_id}`} className="btn-secondary text-xs">Review</Link>
            ) : (
              <span className="text-xs uppercase text-neutral-400">{row.status}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
