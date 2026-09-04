"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type PublicAsset = {
  organisation: string;
  notice: string;
  asset_tag: string;
  asset_name: string;
  contact: string;
};

export default function PublicAssetQrPage() {
  const { t } = useI18n();
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<PublicAsset | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!params.token) return;
    axios
      .get<{ data: PublicAsset }>(`/api/public/assets/${params.token}`)
      .then((r) => setData(r.data.data))
      .catch(() => setError(true));
  }, [params.token]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          {error && <p className="text-sm text-red-700">{t("assets.public.notFound")}</p>}
          {!error && !data && <p className="text-sm text-neutral-500">{t("common.loading")}</p>}
          {data && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{data.organisation || t("assets.public.title")}</p>
              <p className="mt-1 text-sm text-neutral-600">{data.notice || t("assets.public.notice")}</p>
              <h1 className="mt-6 font-mono text-3xl font-bold">{data.asset_tag}</h1>
              <p className="mt-2 text-lg text-neutral-800">{data.asset_name}</p>
              <p className="mt-6 text-sm text-neutral-600">{data.contact || t("assets.public.contact")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
