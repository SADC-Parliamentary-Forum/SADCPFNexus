"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { travelApi, type TravelMission } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${ok ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
      <span className="material-symbols-outlined text-[13px]">{ok ? "check_circle" : "pending"}</span>
      {label}
    </span>
  );
}

export default function TravelMissionDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = Number(params?.id);
  const [mission, setMission] = useState<TravelMission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setLoading(false);
      setError(t("travel.mission.invalidId"));
      return;
    }
    travelApi.getMission(id)
      .then((r) => setMission((r.data as any).data ?? r.data))
      .catch(() => setError(t("travel.mission.loadFailed")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const missionCrumbs = [
    { label: "nav.travel", href: "/travel" },
    { label: t("travel.mission.crumbMissions"), href: "/travel/missions" },
    { label: mission?.title ?? t("travel.mission.crumbMission") },
  ];

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title={t("travel.mission.title")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.travel", href: "/travel" }, { label: t("travel.mission.crumbMissions"), href: "/travel/missions" }, { label: t("travel.mission.crumbMission") }]} />}
        />
        <p className="text-sm text-neutral-400">{t("travel.mission.loading")}</p>
      </div>
    );
  }
  if (error || !mission) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title={t("travel.mission.title")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.travel", href: "/travel" }, { label: t("travel.mission.crumbMissions"), href: "/travel/missions" }, { label: t("travel.mission.crumbMission") }]} />}
        />
        <p className="text-sm text-red-600">{error ?? t("travel.mission.notFound")}</p>
        <Link href="/travel/missions" className="btn-secondary text-sm">{t("travel.mission.back")}</Link>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6" data-testid="travel-mission-readiness">
      <ModulePageHeader
        title={mission.title}
        subtitle={`${[mission.destination_city, mission.destination_country].filter(Boolean).join(", ") || "—"} · ${(mission.start_date ?? "—").toString().slice(0, 10)} → ${(mission.end_date ?? "—").toString().slice(0, 10)}`}
        breadcrumbs={<PageBreadcrumbs items={missionCrumbs} />}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400">{t("travel.mission.travellers")}</p>
          <p className="text-2xl font-semibold mt-1">{mission.summary?.travellers ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400">{t("travel.mission.ready")}</p>
          <p className="text-2xl font-semibold mt-1 text-green-700">{mission.summary?.ready ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400">{t("travel.mission.pending")}</p>
          <p className="text-2xl font-semibold mt-1 text-amber-700">{mission.summary?.pending ?? 0}</p>
        </div>
      </div>

      {(mission.travellers ?? []).length === 0 ? (
        <EmptyState icon="groups" title={t("travel.mission.empty")} description={t("travel.mission.emptyHint")} />
      ) : (
      <table className="data-table w-full">
        <thead>
          <tr>
            <th>{t("travel.mission.col.traveller")}</th>
            <th>{t("travel.mission.col.reference")}</th>
            <th>{t("travel.mission.col.status")}</th>
            <th>{t("travel.mission.col.readiness")}</th>
          </tr>
        </thead>
        <tbody>
          {(mission.travellers ?? []).map((tr) => (
            <tr key={tr.travel_request_id}>
              <td>{tr.traveller ?? "—"}</td>
              <td>
                <Link className="text-primary font-mono text-sm" href={`/travel/${tr.travel_request_id}`}>
                  {tr.reference_number}
                </Link>
              </td>
              <td className="capitalize text-sm">{tr.status.replace(/_/g, " ")}</td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  <Flag ok={tr.ticket} label={t("travel.mission.flag.ticket")} />
                  <Flag ok={tr.visa} label={t("travel.mission.flag.visa")} />
                  <Flag ok={tr.hotel} label={t("travel.mission.flag.hotel")} />
                  <Flag ok={tr.dsa} label={t("travel.mission.flag.dsa")} />
                  <Flag ok={tr.ready} label={tr.ready ? t("travel.mission.ready") : t("travel.mission.notReady")} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}
