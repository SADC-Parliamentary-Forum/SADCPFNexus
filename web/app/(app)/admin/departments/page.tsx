import { redirect } from "next/navigation";

export default function AdminDepartmentsRedirect() {
  redirect("/hr/departments");
}
