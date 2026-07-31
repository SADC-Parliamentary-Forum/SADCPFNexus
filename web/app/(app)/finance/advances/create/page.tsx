import { redirect } from "next/navigation";

/** UX-IA Pass 3: create lives under /salary-advances/create */
export default function FinanceAdvanceCreateRedirectPage() {
  redirect("/salary-advances/create");
}
