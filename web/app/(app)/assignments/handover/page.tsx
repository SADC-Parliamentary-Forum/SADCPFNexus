"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { assignmentsApi, tenantUsersApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryStatus } from "@/components/ui/QueryStatus";
import { StatusPill } from "@/components/ui/StatusPill";
import { RegisterMobileCards } from "@/components/ui/RegisterMobileCards";
import { formatDateShort } from "@/lib/utils";

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
    <div className="page-container">
      <ModulePageHeader
        title="Handover pack"
        subtitle="Open work for a departing owner. This is not a surveillance ranking and does not close assignments."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Assignments", href: "/assignments" }, { label: "Handover" }]} />}
        actions={
          docxHref ? (
            <a className="btn-secondary text-sm" data-testid="handover-pack-docx" href={docxHref}>
              Download Word pack
            </a>
          ) : null
        }
      />

      <FormSection title="Owners" description="Choose the departing owner. Incoming owner is optional." icon="swap_horiz">
        <QueryStatus isLoading={usersQuery.isLoading} isError={usersQuery.isError} error="Could not load staff for this tenant." loadingRows={2} />
        {!usersQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="From staff member" htmlFor="handover-from-user" required>
              <select
                id="handover-from-user"
                data-testid="handover-from-user"
                className="form-input w-full"
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
                className="form-input w-full"
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
        ) : null}
      </FormSection>

      <FormSection title="Filter suggestions" icon="filter_alt">
        <form
          className="flex flex-wrap gap-2"
          data-testid="assignment-nl-search"
          onSubmit={(e) => {
            e.preventDefault();
            void suggest.refetch();
          }}
        >
          <input
            className="form-input flex-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter suggestion, e.g. overdue high mine"
            aria-label="Filter suggestion"
          />
          <button type="submit" className="btn-secondary text-sm">
            Suggest filters
          </button>
        </form>
        {suggest.data ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-neutral-600 dark:text-neutral-300">{String(suggest.data.note ?? "Filter suggestions only.")}</p>
            <LabelledRecord value={suggest.data.suggested_filters} />
            <div className="flex flex-wrap gap-2" data-testid="assignment-nl-apply-hrefs">
              {applyHrefs.map((row) => (
                <Link key={row.href} href={row.href} className="btn-secondary text-sm">
                  {row.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Open assignments" icon="assignment">
        {!packParams ? (
          <EmptyState title="Select a departing owner" description="The pack lists open work for that person. It does not close assignments." />
        ) : (
          <>
            <QueryStatus
              isLoading={pack.isLoading}
              isError={pack.isError}
              error="Could not load this handover pack. You may not be authorised for that owner."
            />
            {!pack.isLoading && !pack.isError && open.length === 0 ? (
              <EmptyState title="No open assignments" description="This owner has no open work to hand over." />
            ) : null}
            {!pack.isLoading && !pack.isError && open.length > 0 ? (
              <div data-testid="assignment-handover-pack">
                <RegisterMobileCards
                  items={open}
                  getKey={(row) => String(row.id)}
                  title={(row) => String(row.title)}
                  badge={(row) => <StatusPill value={String(row.status ?? "")} />}
                  fields={(row) => [
                    { label: "Due", value: row.due_date ? formatDateShort(String(row.due_date)) : "—" },
                    { label: "Est. hours", value: String(row.estimated_hours ?? "—") },
                    { label: "Logged hours", value: String(row.logged_hours ?? "—") },
                  ]}
                />
                <div className="table-wrap hidden md:block">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Due</th>
                        <th>Est. hours</th>
                        <th>Logged hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {open.map((row) => (
                        <tr key={String(row.id)}>
                          <td>
                            <Link className="font-medium text-primary" href={`/assignments/${row.id}`}>
                              {String(row.title)}
                            </Link>
                          </td>
                          <td>
                            <StatusPill value={String(row.status ?? "")} />
                          </td>
                          <td>{row.due_date ? formatDateShort(String(row.due_date)) : "—"}</td>
                          <td>{String(row.estimated_hours ?? "—")}</td>
                          <td>{String(row.logged_hours ?? "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div data-testid="assignment-handover-pack" />
            )}
          </>
        )}
      </FormSection>
    </div>
  );
}
