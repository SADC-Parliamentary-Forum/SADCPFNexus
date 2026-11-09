"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { supplierEmailVerificationApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function VerifyEmailInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState(() => t("admin.supplierVerify.verifying"));
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const user = Number(params.get("user") ?? "");
    const expires = Number(params.get("expires") ?? "");
    const signature = params.get("signature") ?? "";
    if (!user || !expires || !signature) {
      setMessage(t("admin.supplierVerify.missingParams"));
      return;
    }
    supplierEmailVerificationApi
      .verify({ user, expires, signature })
      .then((res) => {
        setOk(true);
        setMessage(res.data.message);
        queryClient.invalidateQueries({ queryKey: ["supplier-profile"] });
        queryClient.invalidateQueries({ queryKey: ["supplier-completeness"] });
        queryClient.invalidateQueries({ queryKey: ["supplier-dashboard"] });
      })
      .catch((error: { response?: { data?: { message?: string } } }) => {
        setMessage(error.response?.data?.message ?? t("admin.supplierVerify.failed"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, queryClient]);

  return (
    <div className="mx-auto max-w-lg card p-8 space-y-4 text-center">
      <h1 className="text-xl font-semibold">{t("admin.supplierVerify.title")}</h1>
      <p className="text-sm text-neutral-600" data-testid="verify-email-message">{message}</p>
      {ok && (
        <Link href="/supplier/login" className="btn-primary inline-flex">
          {t("admin.supplierVerify.continue")}
        </Link>
      )}
    </div>
  );
}

export default function SupplierVerifyEmailPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="card p-6">{t("admin.common.loadingDots")}</div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
