import { redirect } from "next/navigation";

/** Canonical role creation lives in the Access Governance role catalogue. */
export default function AdminRoleCreateRedirectPage() {
  redirect("/admin/access/roles");
}
