"use client";

import { PayslipDistributionDesk } from "@/components/payslips/PayslipDistributionDesk";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function HrPayslipsPage() {
  const { t } = useI18n();
  return <PayslipDistributionDesk homeHref="/hr" homeLabel={t("nav.hr")} />;
}
