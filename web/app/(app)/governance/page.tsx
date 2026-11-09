"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  governanceApi,
  governanceMeetingTypeApi,
  minutesApi,
  type GovernanceMeeting,
  type MeetingMinutesRecord,
} from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE, getLastPage, getListData, getTotal } from "@/lib/listPagination";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { RegisterMobileCards } from "@/components/ui/RegisterMobileCards";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function MeetingsMinutesPage() {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");

  const { data: types } = useQuery({
    queryKey: ["governance", "meeting-types"],
    queryFn: async () => (await governanceMeetingTypeApi.list()).data.data ?? [],
    staleTime: 60_000,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["governance", "minutes", statusFilter, typeFilter, search, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { per_page: DEFAULT_PAGE_SIZE, page };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.meeting_type = typeFilter;
      if (search.trim()) params.search = search.trim();
      return (await minutesApi.list(params)).data;
    },
    staleTime: 20_000,
  });

  const { data: scheduled } = useQuery({
    queryKey: ["governance", "scheduled-meetings"],
    queryFn: async () => {
      const res = await governanceApi.meetings({ per_page: 50 });
      return getListData<GovernanceMeeting>(res.data);
    },
    staleTime: 30_000,
  });

  const rows = useMemo(() => getListData<MeetingMinutesRecord>(data), [data]);
  const lastPage = getLastPage(data);
  const total = getTotal(data, rows.length);

  const unmatchedScheduled = useMemo(() => {
    const meetings = scheduled ?? [];
    return meetings.filter((meeting) => {
      const hasMinutes = rows.some(
        (m) =>
          (m.workplan_event_id != null && m.workplan_event_id === meeting.id) ||
          m.title.trim().toLowerCase() === meeting.title.trim().toLowerCase(),
      );
      return !hasMinutes;
    });
  }, [scheduled, rows]);

  return (
    <RegisterShell
      title={t("governance.crumb")}
      subtitle={t("governance.register.subtitle")}
      breadcrumbs={<PageBreadcrumbs items={[{ label: "governance.crumb" }]} />}
      density={density}
      onDensityChange={setDensity}
      page={Math.min(page, lastPage)}
      pageCount={lastPage}
      total={total}
      onPageChange={setPage}
      loading={isLoading}
      actions={
        <>
          <Link href="/governance/resolutions" className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">gavel</span>
            {t("governance.register.resolutionsLegacy")}
          </Link>
          <Link href="/governance/minutes/new" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("governance.register.recordMinutes")}
          </Link>
        </>
      }
      filters={
        <div className="flex flex-col gap-3">
          <div className="relative max-w-md">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-neutral-400">
              search
            </span>
            <input
              className="form-input pl-9"
              placeholder={t("governance.register.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label={t("governance.register.searchLabel")}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { v: "", l: t("governance.register.allStatus") },
              { v: "draft", l: t("governance.register.draft") },
              { v: "final", l: t("governance.register.final") },
            ].map(({ v, l }) => (
              <button
                key={v || "all-status"}
                type="button"
                onClick={() => {
                  setStatusFilter(v);
                  setPage(1);
                }}
                className={`filter-tab${statusFilter === v ? " active" : ""}`}
              >
                {l}
              </button>
            ))}
          </div>
          {(types ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setTypeFilter("");
                  setPage(1);
                }}
                className={`filter-tab${typeFilter === "" ? " active" : ""}`}
              >
                {t("governance.register.allTypes")}
              </button>
              {(types ?? []).map((mt) => (
                <button
                  key={mt.id}
                  type="button"
                  onClick={() => {
                    setTypeFilter(mt.name);
                    setPage(1);
                  }}
                  className={`filter-tab${typeFilter === mt.name ? " active" : ""}`}
                >
                  {mt.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      }
      empty={
        !isLoading && rows.length === 0 && unmatchedScheduled.length === 0 ? (
          <div className="card overflow-hidden">
            {isError ? (
              <EmptyState
                icon="error"
                title={t("governance.register.loadFailed")}
                description={t("governance.register.loadFailedHint")}
              />
            ) : (
              <EmptyState
                icon="meeting_room"
                title={t("governance.register.empty")}
                description={
                  search || statusFilter || typeFilter
                    ? t("governance.register.noMatch")
                    : t("governance.register.emptyHint")
                }
                action={
                  <Link href="/governance/minutes/new" className="btn-primary text-sm">
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    {t("governance.register.recordMinutes")}
                  </Link>
                }
              />
            )}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {rows.length === 0 ? (
          <div className="card overflow-hidden">
            {isError ? (
              <EmptyState
                icon="error"
                title={t("governance.register.loadFailed")}
                description={t("governance.register.loadFailedHint")}
              />
            ) : (
              <EmptyState
                icon="meeting_room"
                title={t("governance.register.empty")}
                description={
                  search || statusFilter || typeFilter
                    ? t("governance.register.noMatch")
                    : t("governance.register.emptyScheduledHint")
                }
                action={
                  <Link href="/governance/minutes/new" className="btn-primary text-sm">
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    {t("governance.register.recordMinutes")}
                  </Link>
                }
              />
            )}
          </div>
        ) : (
        <div className="card overflow-hidden">
          <RegisterMobileCards
            items={rows}
            getKey={(m) => m.id}
            title={(m) => m.title}
            subtitle={(m) => m.meeting_type || t("governance.register.meeting")}
            badge={(m) => (
              <Badge variant={m.status === "final" ? "success" : "warning"}>
                {m.status === "final" ? t("governance.register.final") : t("governance.register.draft")}
              </Badge>
            )}
            fields={(m) => [
              { label: t("governance.register.date"), value: m.meeting_date ? formatDateShort(m.meeting_date) : "—" },
              { label: t("governance.register.venue"), value: m.location || "—" },
              { label: t("governance.register.chair"), value: m.chairperson || "—" },
            ]}
            actions={(m) => (
              <Link href={`/governance/minutes/${m.id}`} className="btn-secondary text-xs py-1 px-2">
                {t("governance.register.view")}
              </Link>
            )}
          />
          <div className="hidden overflow-x-auto md:block">
            <table className="data-table w-full">
              <caption className="sr-only">{t("governance.register.caption")}</caption>
              <thead>
                <tr>
                  <th>{t("governance.register.meeting")}</th>
                  <th>{t("governance.register.type")}</th>
                  <th>{t("governance.register.date")}</th>
                  <th>{t("governance.register.venue")}</th>
                  <th>{t("governance.register.status")}</th>
                  <th className="text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/governance/minutes/${m.id}`} className="font-medium text-neutral-900 dark:text-neutral-100">
                        {m.title}
                      </Link>
                      {m.chairperson ? <div className="text-xs text-neutral-500">{t("governance.register.chairValue", { name: m.chairperson })}</div> : null}
                    </td>
                    <td>
                      <span className="badge badge-muted text-xs">{m.meeting_type || "—"}</span>
                    </td>
                    <td className="text-sm text-neutral-600 dark:text-neutral-400">
                      {m.meeting_date ? formatDateShort(m.meeting_date) : "—"}
                    </td>
                    <td className="text-sm text-neutral-600 dark:text-neutral-400">{m.location || "—"}</td>
                    <td>
                      <span className={m.status === "final" ? "badge-success" : "badge-warning"}>
                        {m.status === "final" ? t("governance.register.final") : t("governance.register.draft")}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link href={`/governance/minutes/${m.id}`} className="btn-secondary text-xs py-1 px-2">
                        {t("governance.register.view")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {unmatchedScheduled.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("governance.register.scheduledTitle")}</h2>
              <p className="text-xs text-neutral-500">{t("governance.register.scheduledHint")}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>{t("governance.register.meeting")}</th>
                    <th>{t("governance.register.date")}</th>
                    <th className="text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedScheduled.map((meeting) => {
                    const params = new URLSearchParams();
                    params.set("title", meeting.title);
                    if (meeting.date) params.set("date", String(meeting.date).slice(0, 10));
                    params.set("workplan_event_id", String(meeting.id));
                    return (
                      <tr key={meeting.id}>
                        <td className="font-medium">{meeting.title}</td>
                        <td className="text-sm text-neutral-600">
                          {meeting.date ? formatDateShort(meeting.date) : "—"}
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/governance/minutes/new?${params.toString()}`}
                            className="btn-secondary text-xs py-1 px-2"
                          >
                            {t("governance.register.recordMinutes")}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </RegisterShell>
  );
}
