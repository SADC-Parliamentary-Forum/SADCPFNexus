"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Alias detail route → existing finance advance detail (lifecycle actions). */
export default function SalaryAdvanceDetailAliasPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  useEffect(() => {
    if (id) router.replace(`/finance/advances/${id}`);
  }, [id, router]);

  return (
    <div className="card p-6 text-sm text-neutral-500">Opening salary advance…</div>
  );
}
