import { redirect } from "next/navigation";

/** Canonical role administration lives in the Access Governance role catalogue. */
export default function AdminRoleEditRedirectPage() {
  redirect("/admin/access/roles");
}
