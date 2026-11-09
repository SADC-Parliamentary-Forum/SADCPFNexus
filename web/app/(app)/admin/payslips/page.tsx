"use client";

import { PayslipDistributionDesk } from "@/components/payslips/PayslipDistributionDesk";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AdminPayslipsPage() {
  const { t } = useI18n();
  return <PayslipDistributionDesk homeHref="/admin" homeLabel={t("admin.homeLabel")} />;
}
