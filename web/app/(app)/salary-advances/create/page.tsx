"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Alias: Apply for Salary Advance → existing create wizard. */
export default function SalaryAdvanceCreateAliasPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/advances/create");
  }, [router]);
  return (
    <div className="card p-6 text-sm text-neutral-500">Redirecting to application form…</div>
  );
}
