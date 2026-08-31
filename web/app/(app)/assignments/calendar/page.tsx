"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { cn } from "@/lib/utils";

function localIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthBounds(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: localIso(from),
    to: localIso(to),
    label: from.toLocaleString("en-GB", { month: "long", year: "numeric" }),
    year: from.getFullYear(),
    month: from.getMonth(),
  };
}

export default function AssignmentsCalendarPage() {
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState(() => new Date());
  const [scope, setScope] = useState<"mine" | "team" | "register">("mine");
  const [icsText, setIcsText] = useState("");
  const [icsBusy, setIcsBusy] = useState(false);
  const [icsResult, setIcsResult] = useState<Record<string, unknown> | null>(null);
  const [icsError, setIcsError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const bounds = useMemo(() => monthBounds(cursor), [cursor]);
  const todayIso = localIso(new Date());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["assignments-calendar", bounds.from, bounds.to, scope],
    queryFn: () => assignmentsApi.calendar({ from: bounds.from, to: bounds.to, scope }).then((r) => r.data),
  });

  const { data: feed } = useQuery({
    queryKey: ["assignments-calendar-feed"],
    queryFn: () => assignmentsApi.calendarFeed().then((r) => r.data.data),
    staleTime: 60_000,
  });

  const rotate = useMutation({
    mutationFn: () => assignmentsApi.rotateCalendarFeed().then((r) => r.data.data),
    onSuccess: (next) => {
      queryClient.setQueryData(["assignments-calendar-feed"], next);
      setRevealed(false);
      setCopied(false);
    },
  });

  const items = (data?.data ?? []) as Array<{
    id: number;
    title?: string;
    status?: string;
    priority?: string;
    due_date?: string;
    assigned_to?: string | null;
  }>;

  const byDay = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const day = item.due_date?.slice(0, 10);
      if (!day) continue;
      const list = map.get(day) ?? [];
      list.push(item);
      map.set(day, list);
    }
    return map;
  }, [items]);

  const firstDow = new Date(bounds.year, bounds.month, 1).getDay();
  const daysInMonth = new Date(bounds.year, bounds.month + 1, 0).getDate();
  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, key: `pad-${i}` });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `d-${d}` });

  const downloadIcs = async () => {
    const res = await assignmentsApi.calendarIcs({ from: bounds.from, to: bounds.to, scope });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "assignments.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copySubscribeUrl = async () => {
    if (!feed?.subscribe_url) return;
    await navigator.clipboard.writeText(feed.subscribe_url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const regenerateSubscribeUrl = () => {
    if (
      !window.confirm(
        "Regenerate this subscribe URL? Existing calendar subscriptions will stop working until they are updated with the new URL.",
      )
    ) {
      return;
    }
    rotate.mutate();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Assignment Calendar"
        subtitle={`Due dates for ${bounds.label}. Download ICS with your session, or subscribe in Google Calendar / Outlook with a private feed URL.`}
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Assignments", href: "/assignments" }, { label: "Calendar" }]} />
        }
        actions={
          <>
            <select
              className="form-input w-36"
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
              aria-label="Calendar scope"
            >
              <option value="mine">Mine</option>
              <option value="team">Team</option>
              <option value="register">Register</option>
            </select>
            <Link href="/assignments/capacity" className="btn-secondary text-sm">
              Capacity
            </Link>
            <Link href="/assignments/workload" className="btn-secondary text-sm">
              Workload
            </Link>
            <button type="button" className="btn-secondary text-sm" onClick={() => void downloadIcs()}>
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download ICS
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              Previous
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setCursor(new Date())}>
              This month
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              Next
            </button>
          </>
        }
      />

      {isLoading && (
        <div className="card space-y-3 p-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          <span className="flex-1">Failed to load assignment calendar.</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      )}

      {feed ? (
        <div className="card space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Subscribe in a calendar app</h2>
              <p className="mt-1 max-w-2xl text-xs text-neutral-500">
                {feed.google_credentials_present
                  ? "Google Calendar credentials are present. ICS subscribe remains available as a secret URL — calendar apps cannot send your login token."
                  : "Google credentials are not configured. Add this URL in Google Calendar or Outlook (Add by URL). This is not live two-way sync."}
              </p>
            </div>
            <span className="badge-muted text-[11px] uppercase tracking-wide">Secret URL</span>
          </div>
          <p className="text-xs text-neutral-600">{feed.instructions}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type={revealed ? "text" : "password"}
              readOnly
              value={feed.subscribe_url}
              autoComplete="off"
              spellCheck={false}
              className="form-input min-w-0 flex-1 font-mono text-xs"
              aria-label="ICS subscribe URL"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => setRevealed((v) => !v)}>
                {revealed ? "Hide" : "Show"}
              </button>
              <button type="button" className="btn-secondary text-sm" onClick={() => void copySubscribeUrl()}>
                {copied ? "Copied" : "Copy URL"}
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={rotate.isPending}
                onClick={regenerateSubscribeUrl}
              >
                {rotate.isPending ? "Regenerating…" : "Regenerate URL"}
              </button>
            </div>
          </div>
          {rotate.isError ? (
            <p className="text-sm text-red-700">Could not regenerate the subscribe URL. Try again.</p>
          ) : null}
          <p className="text-[11px] text-neutral-400">
            Anyone with this URL can read your assignments. Download ICS in the toolbar still uses your signed-in session.
          </p>
        </div>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="calendar_month"
            title={`No due dates in ${bounds.label}`}
            description="Try another month, or switch scope. Import an ICS file below to create draft assignments assigned to you."
            action={
              <Link href="/assignments" className="btn-secondary text-sm">
                Open assignments
              </Link>
            }
          />
        </div>
      ) : null}

      {!isLoading && !isError ? (
        <div className="card grid grid-cols-7 gap-px overflow-hidden border border-neutral-200 bg-neutral-200 p-px">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="bg-neutral-50 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500"
            >
              {d}
            </div>
          ))}
          {cells.map((cell) => {
            if (cell.day == null) return <div key={cell.key} className="min-h-24 bg-white" />;
            const iso = `${bounds.year}-${String(bounds.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
            const dayItems = byDay.get(iso) ?? [];
            const isToday = iso === todayIso;
            return (
              <div
                key={cell.key}
                className={cn("min-h-24 p-2", isToday ? "bg-primary/5 ring-1 ring-inset ring-primary/25" : "bg-white")}
              >
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span className={cn("text-xs font-semibold", isToday ? "text-primary" : "text-neutral-700")}>
                    {cell.day}
                  </span>
                  {isToday ? (
                    <span className="rounded-full bg-primary px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
                      Today
                    </span>
                  ) : null}
                </div>
                <ul className="space-y-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/assignments/${item.id}`}
                        className="block truncate rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/20"
                        title={item.title}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                  {dayItems.length > 3 && (
                    <li>
                      <Link href="/assignments" className="text-[11px] text-neutral-400 hover:text-primary">
                        +{dayItems.length - 3} more
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}

      <details className="card p-5">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Import ICS</summary>
        <form
          data-testid="assignment-ics-import"
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ics = icsText.trim();
            if (!ics) return;
            setIcsBusy(true);
            setIcsError(null);
            try {
              const res = await assignmentsApi.importIcs({ ics });
              setIcsResult(res.data.data as Record<string, unknown>);
              setIcsText("");
              await queryClient.invalidateQueries({ queryKey: ["assignments-calendar"] });
            } catch {
              setIcsError("ICS import failed. Events are created as drafts only.");
            } finally {
              setIcsBusy(false);
            }
          }}
        >
          <p className="text-xs text-neutral-500">
            Paste a calendar file. Import creates draft assignments assigned to you — it does not issue or complete work.
          </p>
          <label className="block text-xs font-medium text-neutral-600">
            ICS text
            <textarea
              className="form-input mt-1 min-h-32 font-mono text-xs"
              value={icsText}
              onChange={(e) => setIcsText(e.target.value)}
              placeholder="BEGIN:VCALENDAR"
              aria-label="ICS text"
            />
          </label>
          <button type="submit" className="btn-secondary text-sm" disabled={icsBusy || !icsText.trim()}>
            {icsBusy ? "Importing…" : "Import ICS"}
          </button>
          {icsError ? <p className="text-sm text-red-700">{icsError}</p> : null}
          {icsResult ? <LabelledRecord value={icsResult} /> : null}
        </form>
      </details>
    </div>
  );
}
