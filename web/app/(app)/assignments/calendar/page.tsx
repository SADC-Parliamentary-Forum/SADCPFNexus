"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function localIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthBounds(d = new Date(), localeTag = "en-GB") {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: localIso(from),
    to: localIso(to),
    label: from.toLocaleString(localeTag, { month: "long", year: "numeric" }),
    year: from.getFullYear(),
    month: from.getMonth(),
  };
}

export default function AssignmentsCalendarPage() {
  const { t, localeTag } = useI18n();
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [cursor, setCursor] = useState(() => new Date());
  const [scope, setScope] = useState<"mine" | "team" | "register">("mine");
  const [icsText, setIcsText] = useState("");
  const [icsBusy, setIcsBusy] = useState(false);
  const [icsResult, setIcsResult] = useState<Record<string, unknown> | null>(null);
  const [icsError, setIcsError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const bounds = useMemo(() => monthBounds(cursor, localeTag), [cursor, localeTag]);
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
      toast.success(t("assignments.calendar.toast.regenerated"));
    },
    onError: (err) => {
      toast.error(t("assignments.calendar.toast.regenerateFailed"), apiErrorMessage(err, t("assignments.calendar.toast.regenerateFailedDetail")));
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

  const regenerateSubscribeUrl = async () => {
    if (
      !(await confirm({
        title: "assignments.calendar.regenerateTitle",
        message: "assignments.calendar.regenerateMessage",
        variant: "danger",
      }))
    ) {
      return;
    }
    rotate.mutate();
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("assignments.calendar.title")}
        subtitle={t("assignments.calendar.subtitle", { month: bounds.label })}
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: t("nav.assignments"), href: "/assignments" }, { label: t("assignments.calendar.breadcrumb") }]} />
        }
        actions={
          <>
            <select
              className="form-input w-36"
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
              aria-label={t("assignments.calendar.scope")}
            >
              <option value="mine">{t("assignments.calendar.scopeMine")}</option>
              <option value="team">{t("assignments.calendar.scopeTeam")}</option>
              <option value="register">{t("assignments.calendar.scopeRegister")}</option>
            </select>
            <Link href="/assignments/capacity" className="btn-secondary text-sm">
              {t("assignments.calendar.capacity")}
            </Link>
            <Link href="/assignments/workload" className="btn-secondary text-sm">
              {t("assignments.calendar.workload")}
            </Link>
            <button type="button" className="btn-secondary text-sm" onClick={() => void downloadIcs()}>
              <span className="material-symbols-outlined text-[18px]">download</span>
              {t("assignments.calendar.downloadIcs")}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              {t("common.previous")}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setCursor(new Date())}>
              {t("assignments.calendar.thisMonth")}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              {t("common.next")}
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
          <span className="flex-1">{t("assignments.calendar.loadFailed")}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => void refetch()}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {feed ? (
        <div className="card space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">{t("assignments.calendar.subscribeTitle")}</h2>
              <p className="mt-1 max-w-2xl text-xs text-neutral-500">
                {feed.google_credentials_present
                  ? t("assignments.calendar.googlePresent")
                  : t("assignments.calendar.googleMissing")}
              </p>
            </div>
            <span className="badge-muted text-[11px] uppercase tracking-wide">{t("assignments.calendar.secretUrl")}</span>
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
              aria-label={t("assignments.calendar.subscribeUrl")}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => setRevealed((v) => !v)}>
                {revealed ? t("assignments.calendar.hide") : t("assignments.calendar.show")}
              </button>
              <button type="button" className="btn-secondary text-sm" onClick={() => void copySubscribeUrl()}>
                {copied ? t("assignments.calendar.copied") : t("assignments.calendar.copyUrl")}
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={rotate.isPending}
                onClick={regenerateSubscribeUrl}
              >
                {rotate.isPending ? t("assignments.calendar.regenerating") : t("assignments.calendar.regenerateUrl")}
              </button>
            </div>
          </div>
          {rotate.isError ? (
            <p className="text-sm text-red-700">{t("assignments.calendar.regenerateError")}</p>
          ) : null}
          <p className="text-[11px] text-neutral-400">
            {t("assignments.calendar.secretWarning")}
          </p>
        </div>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="calendar_month"
            title={t("assignments.calendar.emptyTitle", { month: bounds.label })}
            description={t("assignments.calendar.emptyDescription")}
            action={
              <Link href="/assignments" className="btn-secondary text-sm">
                {t("assignments.calendar.openAssignments")}
              </Link>
            }
          />
        </div>
      ) : null}

      {!isLoading && !isError ? (
        <div className="card grid grid-cols-7 gap-px overflow-hidden border border-neutral-200 bg-neutral-200 p-px">
          {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => (
            <div
              key={d}
              className="bg-neutral-50 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500"
            >
              {t(`assignments.calendar.dow.${d}`)}
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
                      {t("assignments.calendar.today")}
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
                        {t("assignments.calendar.more", { count: dayItems.length - 3 })}
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
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">{t("assignments.calendar.importIcs")}</summary>
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
              toast.success(t("assignments.calendar.toast.imported"), t("assignments.calendar.toast.importedDetail"));
              await queryClient.invalidateQueries({ queryKey: ["assignments-calendar"] });
            } catch (err) {
              const message = apiErrorMessage(err, t("assignments.calendar.importFailed"));
              setIcsError(t("assignments.calendar.importFailed"));
              toast.error(t("assignments.calendar.toast.notImported"), message);
            } finally {
              setIcsBusy(false);
            }
          }}
        >
          <p className="text-xs text-neutral-500">
            {t("assignments.calendar.importHint")}
          </p>
          <label htmlFor="assignments-calendar-ics-text-seticstext-e-target-value-placeholder-b" className="block text-xs font-medium text-neutral-600">
            {t("assignments.calendar.icsText")}
            <textarea id="assignments-calendar-ics-text-seticstext-e-target-value-placeholder-b"
              className="form-input mt-1 min-h-32 font-mono text-xs"
              value={icsText}
              onChange={(e) => setIcsText(e.target.value)}
              placeholder="BEGIN:VCALENDAR"
              aria-label={t("assignments.calendar.icsText")}
            />
          </label>
          <button type="submit" className="btn-secondary text-sm" disabled={icsBusy || !icsText.trim()}>
            {icsBusy ? t("assignments.calendar.importing") : t("assignments.calendar.importIcs")}
          </button>
          {icsError ? <p className="text-sm text-red-700">{icsError}</p> : null}
          {icsResult ? <LabelledRecord value={icsResult} /> : null}
        </form>
      </details>
    </div>
  );
}
