"use client";

// Contracts are now a first-class module. This legacy procurement entry point
// redirects to /contracts, preserving any inbound query (e.g. ?request= from
// an awarded procurement request creating a contract).
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const request = searchParams.get("request");
    const target = request ? `/contracts/register?request=${encodeURIComponent(request)}` : "/contracts";
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="p-8 text-sm text-neutral-500">Redirecting to Contracts…</div>
  );
}

export default function LegacyProcurementContractsRedirect() {
  return (
    <Suspense fallback={null}>
      <RedirectInner />
    </Suspense>
  );
}
