import { redirect } from "next/navigation";

export default function AdminPositionsCreateRedirect() {
  redirect("/hr/positions/create");
}
