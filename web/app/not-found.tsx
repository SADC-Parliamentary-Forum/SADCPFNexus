"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-muted p-6">
      <h1 className="text-2xl font-semibold text-neutral-900 mb-2">{t("notFound.title")}</h1>
      <p className="text-neutral-600 mb-6 text-center max-w-md">
        {t("notFound.body")}
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90"
        >
          {t("notFound.home")}
        </Link>
        <Link
          href="/login"
          className="px-4 py-2 rounded-lg border border-neutral-300 font-medium hover:bg-neutral-50"
        >
          {t("notFound.login")}
        </Link>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-lg border border-neutral-300 font-medium hover:bg-neutral-50"
        >
          {t("nav.dashboard")}
        </Link>
      </div>
    </div>
  );
}
