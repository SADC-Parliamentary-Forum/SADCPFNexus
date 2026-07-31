import { redirect } from "next/navigation";

/** UX-257 Pass 3: canonical ledger verification is /admin/ledger */
export default function AnalyticsLedgerRedirectPage() {
  redirect("/admin/ledger");
}
