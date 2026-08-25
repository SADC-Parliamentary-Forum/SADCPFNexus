"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { assignmentsApi, tenantUsersApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { FormField } from "@/components/ui/FormSection";

export default function AssignmentHandoverPage() {
  const me = getStoredUser();
  const [q, setQ] = useState("overdue high mine");
  const [fromUserId, setFromUserId] = useState<string>(me?.id ? String(me.id) : "");
  const [toUserId, setToUserId] = useState("");

  const usersQuery = useQuery({
    queryKey: ["tenant-users", "handover"],
    queryFn: async () => (await tenantUsersApi.list()).data.data ?? [],
  });
  const users = usersQuery.data ?? [];

  const packParams = useMemo(() => {
    const from = Number(fromUserId);
    if (!Number.isFinite(from) || from <= 0) return null;
    const to = Number(toUserId);
    return {
      from_user_id: from,
      ...(Number.isFinite(to) && to > 0 ? { to_user_id: to } : {}),
    };
  }, [fromUserId, toUserId]);

  const pack = useQuery({
    queryKey: ["assignments-handover", packParams],
    enabled: Boolean(packParams),
    queryFn: () => assignmentsApi.handoverPack(packParams!).then((r) => r.data.data),
  });
  const suggest = useQuery({
    queryKey: ["assignments-nl", q],
    queryFn: () => assignmentsApi.nlSearch(q).then((r) => r.data.data),
    enabled: false,
  });

  const open = (pack.data?.open_assignments ?? []) as Array<Record<string, unknown>>;
  const applyHrefs = (suggest.data?.apply_hrefs ?? []) as Array<{ label: string; href: string }>;
  const docxHref = packParams ? assignmentsApi.handoverPackDocxUrl(packParams) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ModulePageHeader
          title="Handover pack"
          subtitle="Open work for a departing owner. This is not a surveillance ranking and does not close assignments."
          breadcrumbs={<PageBreadcrumbs items={[{ label: "Assignments", href: "/assignments" }, { label: "Handover" }]} />}
        />
        {docxHref ? (
          <a className="btn-secondary text-sm" data-testid="handover-pack-docx" href={docxHref}>
            Download Word pack
          </a>
        ) : null}
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2">
        <FormField label="From staff member" htmlFor="handover-from-user">
          <select
            id="handover-from-user"
            data-testid="handover-from-user"
            className="input w-full"
            value={fromUserId}
            onChange={(e) => setFromUserId(e.target.value)}
          >
            <option value="">Select departing owner</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Incoming owner (optional)" htmlFor="handover-to-user">
          <select
            id="handover-to-user"
            data-testid="handover-to-user"
            className="input w-full"
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
          >
            <option value="">No incoming owner</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <form
        className="card flex flex-wrap gap-2 p-4"
        data-testid="assignment-nl-search"
        onSubmit={(e) => {
          e.preventDefault();
          void suggest.refetch();
        }}
      >
        <input className="form-input flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter suggestion, e.g. overdue high mine" />
        <button type="submit" className="btn-secondary text-sm">Suggest filters</button>
      </form>
      {suggest.data && (
        <div className="card space-y-3 p-4 text-sm">
          <p className="text-neutral-600">{String(suggest.data.note ?? "Filter suggestions only.")}</p>
          <LabelledRecord value={suggest.data.suggested_filters} />
          <div className="flex flex-wrap gap-2" data-testid="assignment-nl-apply-hrefs">
            {applyHrefs.map((row) => (
              <Link key={row.href} href={row.href} className="btn-secondary text-sm">
                {row.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {pack.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      <div className="card overflow-x-auto" data-testid="assignment-handover-pack">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="p-2">Title</th>
              <th className="p-2">Status</th>
              <th className="p-2">Due</th>
              <th className="p-2">Est. hours</th>
              <th className="p-2">Logged hours</th>
            </tr>
          </thead>
          <tbody>
            {open.map((row) => (
              <tr key={String(row.id)} className="border-t border-neutral-200">
                <td className="p-2">
                  <Link className="text-primary hover:underline" href={`/assignments/${row.id}`}>
                    {String(row.title)}
                  </Link>
                </td>
                <td className="p-2">{String(row.status)}</td>
                <td className="p-2">{String(row.due_date ?? "—")}</td>
                <td className="p-2">{String(row.estimated_hours ?? "—")}</td>
                <td className="p-2">{String(row.logged_hours ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
