import { redirect } from "next/navigation";

/** UX-IA Pass 3: certificate lives under /salary-advances/[id]/certificate */
export default async function FinanceAdvanceCertificateRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/salary-advances/${id}/certificate`);
}
