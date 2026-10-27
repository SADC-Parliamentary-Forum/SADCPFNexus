"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { actionQueueApi, type ActionQueueItem } from "@/lib/api";
import { moduleLink } from "@/lib/recordLinks";
import { useFormatDate } from "@/lib/useFormatDate";
import { EmptyState } from "@/components/ui/EmptyState";

const KIND_LABEL: Record<ActionQueueItem["kind"], string> = {
  approval: "Approval",
  correction: "Returned to you",
  assignment: "Assignment",
  lifecycle: "Onboarding / separation",
  correspondence: "Correspondence",
};

const ACTION_LABEL: Record<string, string> = {
  approve: "Approve", recommend: "Recommend", certify: "Certify", authorise: "Authorise", sign: "Sign",
  verify: "Verify", acknowledge: "Acknowledge", resubmit: "Correct & resubmit", accept: "Accept",
  complete: "Complete", respond: "Respond",
};

export function itemHref(item: ActionQueueItem): string {
  if (item.path) return item.path;
  return item.record_id ? moduleLink(item.module).href(item.record_id) : "/approvals";
}

/** Everything currently waiting on the signed-in user, overdue first. */
export function ActionQueuePanel({ limit }: { limit?: number }) {
  const { fmt } = useFormatDate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["me", "action-queue"],
    queryFn: () => actionQueueApi.list().then((r) => r.data),
    staleTime: 30_000,
  });

  const items = limit ? (data?.data ?? []).slice(0, limit) : data?.data ?? [];
  const unavailable = Object.entries(data?.sources ?? {}).filter(([, s]) => s === "unavailable").map(([k]) => k);

  return (
    <section className="card p-0 overflow-hidden" aria-labelledby="action-queue-title">
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
        <div>
          <h2 id="action-queue-title" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Needs my action</h2>
          <p className="text-xs text-neutral-500">
            {data ? `${data.counts.total} item(s)${data.counts.overdue ? ` · ${data.counts.overdue} overdue` : ""}` : "Approvals, returned requests, assignments and tasks waiting on you."}
          </p>
        </div>
        <button type="button" onClick={() => refetch()} className="btn-secondary text-xs py-1 px-2" aria-label="Refresh action queue">
          <span className="material-symbols-outlined text-[16px]">refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />)}</div>
      ) : isError ? (
        <div className="px-5 py-4 text-sm text-red-700" role="alert">
          Could not load your action queue.{" "}
          <button type="button" className="underline" onClick={() => refetch()}>Try again</button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="task_alt" title="Nothing is waiting on you" description="Approvals, returned requests and assigned tasks will appear here." />
      ) : (
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={itemHref(item)} className="flex items-start gap-3 px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <span className="material-symbols-outlined mt-0.5 text-[20px] text-primary">
                  {item.kind === "approval" || item.kind === "correction" ? moduleLink(item.module).icon : item.kind === "assignment" ? "task_alt" : item.kind === "lifecycle" ? "badge" : "mail"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.title}</p>
                  <p className="text-xs text-neutral-500">
                    {KIND_LABEL[item.kind]}
                    {item.reference ? ` · ${item.reference}` : ""}
                    {item.due_at ? ` · due ${fmt(item.due_at)}` : ""}
                  </p>
                  {item.blocker ? <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">{item.blocker}</p> : null}
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                  <span className="badge-primary text-[11px]">{ACTION_LABEL[item.action] ?? item.action}</span>
                  {item.overdue ? <span className="badge-danger text-[11px]">Overdue</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {unavailable.length > 0 ? (
        <p className="border-t border-neutral-100 px-5 py-2 text-xs text-neutral-500">
          Some sources could not be loaded ({unavailable.join(", ")}); items from them may be missing.
        </p>
      ) : null}
    </section>
  );
}
