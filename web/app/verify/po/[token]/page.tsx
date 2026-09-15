"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type PublicPo = {
  po: string;
  supplier: string;
  amount: string;
  issued: string | null;
  status: string;
};

export default function PublicPurchaseOrderVerifyPage() {
  const { t } = useI18n();
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<PublicPo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!params.token) return;
    axios
      .get<{ data: PublicPo }>(`/api/public/purchase-orders/verify/${params.token}`)
      .then((r) => setData(r.data.data))
      .catch(() => setError(true));
  }, [params.token]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          {error && <p className="text-sm text-red-700">{t("po.verify.notFound")}</p>}
          {!error && !data && <p className="text-sm text-neutral-500">{t("common.loading")}</p>}
          {data && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("po.verify.title")}</p>
              <h1 className="mt-6 font-mono text-3xl font-bold">{data.po}</h1>
              <p className="mt-2 text-lg text-neutral-800">{data.supplier}</p>
              <p className="mt-1 text-sm text-neutral-600">{data.amount}</p>
              {data.issued && <p className="mt-1 text-sm text-neutral-500">{data.issued}</p>}
              <p className={`mt-6 text-sm font-semibold ${data.status === "VOID" ? "text-red-700" : "text-green-700"}`}>{data.status}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
