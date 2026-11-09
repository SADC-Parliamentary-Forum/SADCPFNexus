"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type AccessRequest = {
  id: number;
  permission_key?: string;
  business_reason: string;
  status: string;
  scope_type?: string;
};

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-warning",
  submitted: "badge-warning",
  approved: "badge-success",
  rejected: "badge-danger",
};

export default function AccessRequestsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [permission, setPermission] = useState("procurement.evaluation.read.assigned");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = () =>
    api
      .get<{ data: AccessRequest[] }>("/admin/access/requests")
      .then((r) => r.data)
      .then((r) => setRows(r.data ?? []))
      .catch(() => setMessage(t("admin.access.requests.loadFailed")))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setMessage(null);
    await api.post("/access/requests", {
      permission_key: permission,
      business_reason: reason,
      scope_type: "assigned",
    });
    setReason("");
    setMessage(t("admin.access.requests.submitted"));
    load();
  };

  const decide = async (id: number, decision: "approve" | "reject", stage: "supervisor" | "approver") => {
    await api.post(`/admin/access/requests/${id}/decide`, { decision, stage });
    load();
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("admin.access.links.requests")}
        subtitle={t("admin.access.requests.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("admin.homeLabel"), href: "/admin" },
              { label: t("admin.crumb.access"), href: "/admin/access" },
              { label: t("admin.access.requests.crumb") },
            ]}
          />
        }
      />

      <FormSection title={t("admin.access.requests.new")} icon="how_to_reg" dense>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={t("admin.common.permission")} htmlFor="req-perm" required className="min-w-[260px]">
            <input
              id="req-perm"
              className="form-input"
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
            />
          </FormField>
          <FormField label={t("admin.access.requests.businessReason")} htmlFor="req-reason" required className="min-w-[240px] flex-1">
            <input
              id="req-reason"
              className="form-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <button type="button" className="btn-primary text-sm" onClick={submit} disabled={!reason}>
            {t("access.request")}
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-neutral-600">{message}</p> : null}
      </FormSection>

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="how_to_reg" title={t("admin.access.requests.empty")} description={t("admin.access.requests.emptyDesc")} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("admin.common.id")}</th>
                  <th>{t("admin.common.permission")}</th>
                  <th>{t("admin.common.reason")}</th>
                  <th>{t("admin.common.status")}</th>
                  <th>{t("admin.common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.id}</td>
                    <td className="font-medium text-neutral-800">{r.permission_key}</td>
                    <td className="max-w-xs text-sm text-neutral-600">{r.business_reason || "—"}</td>
                    <td>
                      <span className={`badge text-xs capitalize ${STATUS_BADGE[r.status] ?? "badge-muted"}`}>{r.status}</span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => decide(r.id, "approve", "supervisor")}>
                          {t("admin.access.requests.supervisorOk")}
                        </button>
                        <button type="button" className="btn-secondary text-xs py-1 px-2 text-emerald-700" onClick={() => decide(r.id, "approve", "approver")}>
                          {t("admin.common.approve")}
                        </button>
                        <button type="button" className="btn-secondary text-xs py-1 px-2 text-red-600" onClick={() => decide(r.id, "reject", "approver")}>
                          {t("admin.common.reject")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
