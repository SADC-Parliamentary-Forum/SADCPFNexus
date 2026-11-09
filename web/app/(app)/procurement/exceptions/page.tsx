"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { procurementWorkbenchApi } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function ProcurementExceptionsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["procurement", "exceptions"],
    queryFn: () => procurementWorkbenchApi.exceptions().then((r) => r.data),
  });
  const approve = useMutation({
    mutationFn: (id: number) => procurementWorkbenchApi.approveException(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procurement", "exceptions"] });
      toast.success(t("procurement.exceptions.approved"));
    },
    onError: (err: unknown) => {
      toast.error(t("procurement.exceptions.approveFailedTitle"), apiErrorMessage(err, t("procurement.exceptions.approveFailed")));
    },
  });
  const rows = (data as { data?: Array<{ id: number; exception_type: string; reason: string; status: string }> })?.data ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("procurement.exceptions.title")}
        subtitle={t("procurement.exceptions.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("nav.procurement"), href: "/procurement" }, { label: t("procurement.exceptions.crumb") }]} />}
      />
      {isLoading && <p className="text-sm text-neutral-500">{t("procurement.exceptions.loading")}</p>}
      {isError && <p className="text-sm text-rose-700">{t("procurement.exceptions.loadError")}</p>}
      {!isLoading && rows.length === 0 && (
        <div className="card">
          <EmptyState icon="gavel" title={t("procurement.exceptions.empty")} />
        </div>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{row.exception_type}</p>
              <p className="text-neutral-600">{row.reason}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase text-neutral-500">{row.status}</span>
              {row.status === "requested" && (
                <button type="button" className="btn-primary text-xs" onClick={() => approve.mutate(row.id)}>{t("common.approve")}</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Link href="/procurement" className="text-sm text-primary">{t("procurement.backToProcurement")}</Link>
    </div>
  );
}
