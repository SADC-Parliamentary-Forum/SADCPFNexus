import { redirect } from "next/navigation";

/** Canonical timesheet hub is under HR. */
export default function TimesheetsRedirectPage() {
  redirect("/hr/timesheets");
}
