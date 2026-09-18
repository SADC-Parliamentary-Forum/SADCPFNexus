"use client";

// Superseded by the first-class Contracts module. Redirect legacy procurement
// contract-detail links to /contracts/{id}.
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyProcurementContractDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/contracts/${id}`);
  }, [router, id]);

  return <div className="p-8 text-sm text-neutral-500">Redirecting to the contract…</div>;
}
