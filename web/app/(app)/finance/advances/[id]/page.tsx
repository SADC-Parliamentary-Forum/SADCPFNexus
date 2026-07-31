import { redirect } from "next/navigation";

/** UX-IA Pass 3: detail lives under /salary-advances/[id] */
export default async function FinanceAdvanceDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/salary-advances/${id}`);
}
