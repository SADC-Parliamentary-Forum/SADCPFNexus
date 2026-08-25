import { redirect } from "next/navigation";

export default async function TimesheetDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/hr/timesheets/${id}`);
}
