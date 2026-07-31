import { redirect } from "next/navigation";

/** UX-257 Pass 3: ledger generate lives under /admin/ledger/generate */
export default function AnalyticsLedgerGenerateRedirectPage() {
  redirect("/admin/ledger/generate");
}
