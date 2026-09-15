"use client";

import type { ReactNode } from "react";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supplierPortalApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import {
  SUPPLIER_TONE_STYLES,
  actionIcon,
  completenessTone,
  compliancePresentation,
  registrationPresentation,
  type SupplierTone,
} from "@/lib/supplierDashboard";

function StatusCard({
  testId,
  label,
  value,
  icon,
  tone,
  hint,
}: {
  testId: string;
  label: string;
  value: string;
  icon: string;
  tone: SupplierTone;
  hint?: ReactNode;
}) {
  const styles = SUPPLIER_TONE_STYLES[tone];
  return (
    <div className="card p-5 h-full" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-600">{label}</p>
          <p className="mt-2 text-xl font-bold text-neutral-900">{value}</p>
          {hint ? <div className="mt-2">{hint}</div> : null}
        </div>
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${styles.iconBg}`}>
          <span
            className={`material-symbols-outlined text-[22px] ${styles.iconColor}`}
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            {icon}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SupplierDashboardPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["supplier-dashboard"],
    queryFn: () => supplierPortalApi.dashboard().then((response) => response.data.data),
  });
  const submitMutation = useMutation({
    mutationFn: () => supplierPortalApi.submitApplication(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supplier-dashboard"] }),
  });

  if (isLoading) {
    return (
      <div className="card p-6" role="status">
        {t("supplier.dashboard.loading")}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorBanner
        message={t("supplier.dashboard.loadError")}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const actions = data.actions ?? [];
  const registration = registrationPresentation(data.status ?? data.vendor.status);
  const compliance = compliancePresentation(data.compliance_status ?? data.eligibility?.compliance_status ?? "unknown");
  const completeness = data.completeness_percent ?? data.vendor.completeness?.percent ?? 0;
  const completeTone = completenessTone(completeness);
  const completeStyles = SUPPLIER_TONE_STYLES[completeTone];
  const registrationLabel = registration.labelKey ? t(registration.labelKey) : registration.fallback;
  const complianceLabel = compliance.labelKey ? t(compliance.labelKey) : compliance.fallback;
  const shortcuts = [
    {
      href: "/supplier/rfqs",
      icon: "request_quote",
      label: t("supplier.dashboard.rfqs"),
      count: data.open_rfq_count,
      countKey: "supplier.dashboard.openCount",
    },
    {
      href: "/supplier/purchase-orders",
      icon: "receipt_long",
      label: t("supplier.dashboard.purchaseOrders"),
      count: data.purchase_order_count,
      countKey: "supplier.dashboard.totalCount",
    },
    {
      href: "/supplier/invoices",
      icon: "receipt",
      label: t("supplier.dashboard.invoices"),
      count: data.invoice_count,
      countKey: "supplier.dashboard.totalCount",
    },
    {
      href: "/supplier/profile",
      icon: "badge",
      label: t("supplier.dashboard.profile"),
    },
  ];

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="auth.supplierPortalName"
        subtitle="supplier.dashboard.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "auth.supplierPortalName" }]} />}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard
          testId="supplier-status"
          label={t("supplier.dashboard.registration")}
          value={registrationLabel}
          icon={registration.icon}
          tone={registration.tone}
        />
        <StatusCard
          testId="supplier-completeness"
          label={t("supplier.dashboard.completeness")}
          value={`${completeness}%`}
          icon="pie_chart"
          tone={completeTone}
          hint={
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completeness}
              aria-label={t("supplier.dashboard.completeness")}
            >
              <div
                className={`h-full rounded-full ${completeStyles.bar}`}
                style={{ width: `${Math.max(0, Math.min(100, completeness))}%` }}
              />
            </div>
          }
        />
        <StatusCard
          testId="supplier-compliance"
          label={t("supplier.dashboard.compliance")}
          value={complianceLabel}
          icon={compliance.icon}
          tone={compliance.tone}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
                {item.icon}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">{item.label}</p>
              {item.count !== undefined && item.countKey ? (
                <p className="text-xs text-neutral-500">{t(item.countKey, { count: item.count })}</p>
              ) : (
                <p className="text-xs text-neutral-500">{t("supplier.dashboard.profileHint")}</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div className="card" data-testid="supplier-actions">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-600" aria-hidden="true">
              task_alt
            </span>
            <h2 className="text-sm font-semibold text-neutral-900">{t("supplier.dashboard.actions")}</h2>
          </div>
        </div>
        {actions.length === 0 ? (
          <EmptyState
            icon="check_circle"
            title="supplier.dashboard.noActions"
            className="min-h-[140px] py-8"
          />
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {actions.map((action) => (
              <li key={`${action.code}-${action.label}`} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <span className="material-symbols-outlined text-[16px] text-neutral-600" aria-hidden="true">
                    {actionIcon(action.code)}
                  </span>
                </div>
                {action.code === "submit_application" ? (
                  <button
                    type="button"
                    className="btn-primary text-sm inline-flex items-center gap-1.5"
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">send</span>
                    {action.label}
                  </button>
                ) : (
                  <Link href={action.href} className="text-sm font-medium text-primary hover:underline">
                    {action.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
