"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { publicAssetQrApi, type PublicAssetPayload } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export default function PublicAssetQrPage() {
  const { t } = useI18n();
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<PublicAssetPayload | null>(null);
  const [error, setError] = useState(false);
  const [foundOk, setFoundOk] = useState(false);
  const [foundErr, setFoundErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", location: "", message: "" });

  useEffect(() => {
    if (!params.token) return;
    publicAssetQrApi
      .show(params.token)
      .then((r) => setData(r.data.data))
      .catch(() => setError(true));
  }, [params.token]);

  const recovery = data?.recoveryContact ?? {};
  const tel = recovery.telephone ?? "";
  const email = recovery.email ?? "";
  const whatsapp = recovery.whatsapp ?? "";
  const waHref = useMemo(() => {
    const n = digitsOnly(whatsapp);
    return n ? `https://wa.me/${n}` : "";
  }, [whatsapp]);

  async function submitFound(e: React.FormEvent) {
    e.preventDefault();
    if (!params.token) return;
    setSubmitting(true);
    setFoundErr("");
    try {
      await publicAssetQrApi.reportFound(params.token, form);
      setFoundOk(true);
    } catch {
      setFoundErr(t("assets.public.foundFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          {error && <p className="text-sm text-red-700">{t("assets.public.notFound")}</p>}
          {!error && !data && <p className="text-sm text-neutral-500">{t("common.loading")}</p>}
          {data && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{data.organisation || t("assets.public.title")}</p>
              <p className={`mt-2 text-sm ${data.publicStatus === "LOST" || data.publicStatus === "STOLEN" ? "font-semibold text-red-700" : "text-neutral-600"}`}>
                {t(data.notice_key || "assets.public.notice")}
              </p>
              <h1 className="mt-6 font-mono text-3xl font-bold">{data.asset_tag || data.assetNumber}</h1>
              <p className="mt-2 text-lg text-neutral-800">{data.asset_name}</p>
              <p className="mt-4 text-xs text-neutral-500">{t("assets.public.scanHint")}</p>
              {(tel || email || whatsapp) && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {tel && (
                    <a className="btn-primary" href={`tel:${tel}`}>{t("assets.public.call")}</a>
                  )}
                  {email && (
                    <a className="btn-secondary" href={`mailto:${email}`}>{t("assets.public.email")}</a>
                  )}
                  {waHref && (
                    <a className="btn-secondary" href={waHref} target="_blank" rel="noreferrer">{t("assets.public.whatsapp")}</a>
                  )}
                </div>
              )}
              <p className="mt-6 text-sm text-neutral-600">{recovery.instructions || data.contact || t("assets.public.contact")}</p>
              <Link href={`/login?next=/a/${params.token}`} className="mt-6 inline-block text-sm font-semibold text-primary">
                {t("assets.public.signIn")}
              </Link>

              {data.publicStatus !== "DISPOSED" && (
                <form onSubmit={submitFound} className="mt-8 space-y-3 text-left">
                  <h2 className="text-sm font-semibold text-neutral-800">{t("assets.public.foundTitle")}</h2>
                  {foundOk ? (
                    <p className="text-sm text-emerald-700">{t("assets.public.foundThanks")}</p>
                  ) : (
                    <>
                      <input className="form-input" placeholder={t("assets.public.foundName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      <input className="form-input" placeholder={t("assets.public.foundPhone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                      <input className="form-input" type="email" placeholder={t("assets.public.foundEmail")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                      <input className="form-input" placeholder={t("assets.public.foundLocation")} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                      <textarea className="form-input" rows={3} placeholder={t("assets.public.foundMessage")} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                      {foundErr && <p className="text-sm text-red-700">{foundErr}</p>}
                      <button type="submit" className="btn-primary w-full" disabled={submitting}>
                        {submitting ? t("common.loading") : t("assets.public.foundSubmit")}
                      </button>
                    </>
                  )}
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
