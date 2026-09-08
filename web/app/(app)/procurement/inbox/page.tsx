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
  const configured = Boolean(payload?.imap_configured);
  const note = payload?.note?.trim() || null;
  const subtitle = note
    ?? (configured
      ? "Unread PDF, Word, or image attachments from the designated procurement mailbox are ingested for review. They are never auto-confirmed."
      : "IMAP is not configured. Upload remains the live invoice intake path.");
  const emptyCopy = configured
    ? "No invoice attachments yet. Forward supplier documents to the designated procurement mailbox, then review them here before confirming."
    : (note ?? "No forwarded invoices. IMAP is not configured — upload a PDF or DOCX from Create from Invoice / Quote.");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Procurement Inbox"
        subtitle={subtitle}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Procurement", href: "/procurement" }, { label: "Inbox" }]} />}
      />
      <p className="text-sm text-neutral-600">
        System Admins configure the designated invoice mailbox under{" "}
        <Link href="/admin/email" className="text-primary hover:underline">Admin → Email</Link>.
        Attachments become intakes for review and are never auto-confirmed.
      </p>
      {note && (
        <p className={`rounded-lg border px-4 py-3 text-sm ${configured ? "border-sky-200 bg-sky-50 text-sky-950" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{note}</p>
      )}
      {isLoading && <p className="text-sm text-neutral-500">Loading inbox…</p>}
      {isError && <p className="text-sm text-rose-700">Could not load the procurement inbox.</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-neutral-500">{emptyCopy}</p>
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
