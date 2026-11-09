"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function Page() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const create = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.createAccessReview({
        name: name.trim(),
        due_date: dueDate || undefined,
      }),
    onSuccess: () => {
      toast.success(t("people.accessReviews.created"));
      setMsg(t("people.accessReviews.createdDetail"));
      setErr(null);
      setName("");
    },
    onError: (e) => {
      const message = apiErrorMessage(e, t("people.accessReviews.createFailed"));
      setErr(message);
      toast.error(t("people.accessReviews.notCreated"), message);
    },
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("people.accessReviews.title")}
        subtitle={t("people.accessReviews.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("people.hub.title"), href: "/people" },
              { label: t("people.accessReviews.title") },
            ]}
          />
        }
        actions={<Link href="/people" className="btn-secondary text-sm">{t("people.common.hub")}</Link>}
      />
      <form
        className="card space-y-3 p-4 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            setErr(t("people.common.nameRequired"));
            return;
          }
          create.mutate();
        }}
      >
        <label htmlFor="people-access-reviews-campaign-name-setname-e-target-value-required" className="block text-xs font-medium text-neutral-600">
          {t("people.common.campaignName")}
          <input id="people-access-reviews-campaign-name-setname-e-target-value-required" className="form-input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label htmlFor="people-access-reviews-due-date-setduedate-e-target-value" className="block text-xs font-medium text-neutral-600">
          {t("people.common.dueDate")}
          <input id="people-access-reviews-due-date-setduedate-e-target-value" type="date" className="form-input mt-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
          {create.isPending ? t("people.common.saving") : t("people.accessReviews.create")}
        </button>
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        {err && <p className="text-sm text-red-700">{err}</p>}
      </form>
    </div>
  );
}
