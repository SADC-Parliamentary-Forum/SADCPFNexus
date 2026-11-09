"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function Page() {
  const { t } = useI18n();
  const [name, setName] = useState("Privileged role recertification");
  const [dueDate, setDueDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const open = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.openRecertification({
        name: name.trim() || undefined,
        due_date: dueDate || undefined,
        auto_populate_roles: true,
      }),
    onSuccess: () => {
      setMsg(t("people.recertification.opened"));
      setErr(null);
    },
    onError: () => setErr(t("people.recertification.openFailed")),
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("people.recertification.title")}
        subtitle={t("people.recertification.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("people.hub.title"), href: "/people" },
              { label: t("people.recertification.title") },
            ]}
          />
        }
        actions={<Link href="/people" className="btn-secondary text-sm">{t("people.common.hub")}</Link>}
      />
      <form
        className="card space-y-3 p-4 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          open.mutate();
        }}
      >
        <label htmlFor="people-recertification-campaign-name-setname-e-target-value" className="block text-xs font-medium text-neutral-600">
          {t("people.common.campaignName")}
          <input id="people-recertification-campaign-name-setname-e-target-value" className="form-input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label htmlFor="people-recertification-due-date-setduedate-e-target-value" className="block text-xs font-medium text-neutral-600">
          {t("people.common.dueDate")}
          <input id="people-recertification-due-date-setduedate-e-target-value" type="date" className="form-input mt-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary text-sm" disabled={open.isPending}>
          {open.isPending ? t("people.recertification.opening") : t("people.recertification.open")}
        </button>
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        {err && <p className="text-sm text-red-700">{err}</p>}
      </form>
    </div>
  );
}
