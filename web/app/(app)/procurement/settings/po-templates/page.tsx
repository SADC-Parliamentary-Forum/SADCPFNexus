"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { poTemplatesApi, type PoDocumentTemplate } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function PoTemplatesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "procurement.admin");
  const canPublish = canAdmin || hasPermission(user, "procurement.template.publish");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["po-templates"],
    queryFn: () => poTemplatesApi.list().then((r) => r.data.data),
    enabled: canAdmin,
  });

  const createMut = useMutation({
    mutationFn: () => poTemplatesApi.create({ name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po-templates"] });
      setName("");
      setMessage(t("po.templates.created"));
    },
  });

  const defaultMut = useMutation({
    mutationFn: (id: number) => poTemplatesApi.setDefault(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["po-templates"] }),
  });

  const retireMut = useMutation({
    mutationFn: (id: number) => poTemplatesApi.retire(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["po-templates"] }),
  });

  if (!canAdmin) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 max-w-xl">
        {t("po.templates.needAdmin")}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="po.templates.title"
        subtitle="po.templates.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "po.settings.hub", href: "/procurement/settings" },
              { label: "po.templates.title" },
            ]}
          />
        }
      />
      {message && <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">{message}</p>}
      <div className="card p-4 flex flex-wrap gap-2">
        <input className="form-input max-w-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("po.templates.newName")} />
        <button type="button" className="btn-primary text-sm" disabled={!name.trim() || createMut.isPending} onClick={() => createMut.mutate()}>
          {t("po.templates.create")}
        </button>
      </div>
      {isLoading ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
      ) : (
        <div className="space-y-2">
          {data.map((row: PoDocumentTemplate) => (
            <div key={row.id} className="card px-4 py-3 flex flex-wrap items-center justify-between gap-2" data-testid="po-template-row">
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  {row.name}
                  {row.is_default && <span className="ml-2 text-[10px] uppercase text-green-700">{t("po.templates.default")}</span>}
                </p>
                <p className="text-xs text-neutral-500">{row.status} · {row.description || t("po.templates.noDescription")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/procurement/settings/po-templates/${row.id}`} className="btn-secondary text-xs">{t("po.templates.edit")}</Link>
                {!row.is_default && (
                  <button type="button" className="btn-secondary text-xs" onClick={() => defaultMut.mutate(row.id)}>{t("po.templates.setDefault")}</button>
                )}
                {canPublish && !row.is_default && row.status !== "retired" && (
                  <button type="button" className="btn-secondary text-xs" onClick={() => retireMut.mutate(row.id)}>{t("po.templates.retire")}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
