"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { supplierEmailVerificationApi } from "@/lib/api";

function VerifyEmailInner() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("Verifying your email...");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const user = Number(params.get("user") ?? "");
    const expires = Number(params.get("expires") ?? "");
    const signature = params.get("signature") ?? "";
    if (!user || !expires || !signature) {
      setMessage("This verification link is missing required parameters.");
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
        setMessage(error.response?.data?.message ?? "Unable to verify this email link.");
      });
  }, [params, queryClient]);

  return (
    <div className="mx-auto max-w-lg card p-8 space-y-4 text-center">
      <h1 className="text-xl font-semibold">Supplier email verification</h1>
      <p className="text-sm text-neutral-600" data-testid="verify-email-message">{message}</p>
      {ok && (
        <Link href="/supplier/login" className="btn-primary inline-flex">
          Continue to supplier sign in
        </Link>
      )}
    </div>
  );
}

export default function SupplierVerifyEmailPage() {
  return (
    <Suspense fallback={<div className="card p-6">Loading...</div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
