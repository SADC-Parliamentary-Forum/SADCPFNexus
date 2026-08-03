import { redirect } from "next/navigation";

/** Canonical audit administration lives at /admin/audit-trail. */
export default function AdminAuditRedirectPage() {
  redirect("/admin/audit-trail");
}
