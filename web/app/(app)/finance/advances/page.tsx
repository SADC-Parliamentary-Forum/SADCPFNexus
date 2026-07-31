import { redirect } from "next/navigation";

/** UX-IA Pass 3: canonical salary advances hub is /salary-advances */
export default async function FinanceAdvancesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const queue = typeof sp.queue === "string" ? sp.queue : undefined;
  if (queue === "certify" || queue === "payment" || queue === "recovery") {
    redirect(`/salary-advances/queues/${queue}`);
  }
  redirect("/salary-advances/applications");
}
