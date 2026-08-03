import { redirect } from "next/navigation";

/** Canonical role matrix lives in the Access Governance role catalogue. */
export default function AdminRoleMatrixRedirectPage() {
  redirect("/admin/access/roles/matrix");
}
