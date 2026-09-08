"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { documentServiceApi } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

type RetentionDashboard = {
  total?: number;
  on_legal_hold?: number;
  past_retain_until?: number;
  archived?: number;
  pending_disposal?: number;
  campaigns?: Array<{
    id: number;
    name: string;
    status?: string;
    candidate_count?: number;
    held_count?: number;
  }>;
};

export default function DocumentRetentionPage() {
  const { t } = useI18n();
  const { success, error } = useToast();
  const [data, setData] = useState<RetentionDashboard | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    documentServiceApi
      .retentionDashboard()
      .then((r: { data?: { data?: RetentionDashboard } }) => setData(r.data?.data ?? (r.data as RetentionDashboard)))
      .catch((err: unknown) => {
        setData(null);
        error(t("documents.retention.loadError"), apiErrorMessage(err, t("documents.retention.loadError")));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCampaign = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await documentServiceApi.createRetentionCampaign({ name: name.trim() });
      setName("");
      success(t("documents.retention.created"));
      load();
    } catch (err: unknown) {
      error(t("documents.retention.createFailed"), apiErrorMessage(err, t("documents.retention.createFailed")));
    } finally {
      setCreating(false);
    }
  };

  const campaigns = data?.campaigns ?? [];
  const stats = [
    { key: "total", label: t("documents.retention.total"), value: data?.total ?? 0 },
    { key: "hold", label: t("documents.retention.onHold"), value: data?.on_legal_hold ?? 0 },
    { key: "past", label: t("documents.retention.pastRetain"), value: data?.past_retain_until ?? 0 },
    { key: "archived", label: t("documents.retention.archived"), value: data?.archived ?? 0 },
    { key: "disposal", label: t("documents.retention.pendingDisposal"), value: data?.pending_disposal ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ModulePageHeader
        title="documents.retention.title"
        subtitle="documents.retention.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.admin", href: "/admin" },
              { label: "documents.register.title", href: "/admin/documents" },
              { label: "documents.retention.title" },
            ]}
          />
        }
        actions={
          <Link href="/admin/documents" className="btn-secondary text-sm">
            {t("documents.register.title")}
          </Link>
        }
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.key} className="card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <FormSection title="documents.retention.create" icon="campaign" dense>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="doc-campaign-name" className="mb-1 block text-xs font-semibold text-neutral-700">
              {t("documents.retention.campaignName")}
            </label>
            <input
              id="doc-campaign-name"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-primary text-sm disabled:opacity-60"
            disabled={creating || !name.trim()}
            onClick={() => void createCampaign()}
          >
            {t("documents.retention.create")}
          </button>
        </div>
      </FormSection>

      {!loading && campaigns.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="policy"
            title="documents.retention.empty"
            description="documents.retention.emptyHint"
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {campaigns.map((campaign) => (
            <li key={campaign.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">{campaign.name}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {t("documents.retention.candidates")}: {campaign.candidate_count ?? 0}
                  {" · "}
                  {t("documents.retention.held")}: {campaign.held_count ?? 0}
                </p>
              </div>
              <Badge variant="muted">{campaign.status || t("status.pending")}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
