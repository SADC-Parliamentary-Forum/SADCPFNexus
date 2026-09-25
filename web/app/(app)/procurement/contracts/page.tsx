"use client";

// Contracts are now a first-class module. This legacy procurement entry point
// redirects to /contracts, preserving any inbound query (e.g. ?request= from
// an awarded procurement request creating a contract).
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    const request = searchParams.get("request");
    const target = request ? `/contracts/create?request=${encodeURIComponent(request)}` : "/contracts";
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="p-8 text-sm text-neutral-500">{t("contracts.redirecting")}</div>
  );
}

export default function LegacyProcurementContractsRedirect() {
  return (
    <Suspense fallback={null}>
      <RedirectInner />
    </Suspense>
  );
}
