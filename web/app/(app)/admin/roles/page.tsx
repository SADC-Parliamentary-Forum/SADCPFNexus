import { redirect } from "next/navigation";

/** UX-029: canonical role administration is Access Governance roles catalogue */
export default function AdminRolesRedirectPage() {
  redirect("/admin/access/roles");
}
