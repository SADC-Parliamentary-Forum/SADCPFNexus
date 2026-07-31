import { redirect } from "next/navigation";

/** UX-IA Pass 3: certificate lives under /salary-advances/[id]/certificate */
export default async function FinanceAdvanceCertificateRedirectPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved = await Promise.resolve(params);
  redirect(`/salary-advances/${resolved.id}/certificate`);
}
