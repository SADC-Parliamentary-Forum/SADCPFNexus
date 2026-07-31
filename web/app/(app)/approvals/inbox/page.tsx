import { redirect } from "next/navigation";

/** UX-133: single Approvals surface lives at /approvals */
export default function ApprovalsInboxRedirectPage() {
  redirect("/approvals");
}
