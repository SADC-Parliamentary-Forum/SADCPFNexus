"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { PoTemplateDesigner } from "@/components/procurement/PoTemplateDesigner";
import { poTemplatesApi } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { sanitizePoLayout, type PoLayout } from "@/lib/poTemplateLayout";

function versionLayout(row: { draft_version?: { layout_json?: unknown } | null; draftVersion?: { layout_json?: unknown } | null; published_version?: { layout_json?: unknown } | null; publishedVersion?: { layout_json?: unknown } | null }): unknown {
  return row.draft_version?.layout_json ?? row.draftVersion?.layout_json ?? row.published_version?.layout_json ?? row.publishedVersion?.layout_json ?? {};
}

export default function PoTemplateDesignerPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "procurement.admin");
  const canPublish = canAdmin || hasPermission(user, "procurement.template.publish");
  const [layout, setLayout] = useState<PoLayout | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["po-template", id],
    queryFn: () => poTemplatesApi.get(id).then((r) => r.data.data),
    enabled: canAdmin && Number.isFinite(id),
  });

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setLayout(sanitizePoLayout(versionLayout(data)));
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => poTemplatesApi.saveDraft(id, { name, layout_json: layout }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po-template", id] });
      setMessage(t("po.designer.saved"));
    },
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      await poTemplatesApi.saveDraft(id, { name, layout_json: layout });
      return poTemplatesApi.publish(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po-template", id] });
      setMessage(t("po.designer.published"));
    },
  });

  async function preview(mode: "design" | "sample") {
    if (!layout) return;
    const res = await poTemplatesApi.preview(id, { mode, layout_json: layout });
    const url = URL.createObjectURL(res.data);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!canAdmin) {
    return <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 max-w-xl">{t("po.templates.needAdmin")}</div>;
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <ModulePageHeader
        title="po.designer.title"
        subtitle="po.designer.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "po.settings.hub", href: "/procurement/settings" },
              { label: "po.templates.title", href: "/procurement/settings/po-templates" },
              { label: data?.name ?? "po.designer.title" },
            ]}
          />
        }
      />
      {message && <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">{message}</p>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="text-neutral-500 uppercase tracking-wide">{t("po.templates.name")}</span>
          <input className="form-input mt-1 min-w-[16rem]" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="button" className="btn-secondary text-sm" data-testid="po-designer-preview" onClick={() => preview("sample")}>{t("po.designer.preview")}</button>
        <button type="button" className="btn-secondary text-sm" data-testid="po-designer-save" disabled={saveMut.isPending || !layout} onClick={() => saveMut.mutate()}>{t("po.designer.saveDraft")}</button>
        {canPublish && (
          <button type="button" className="btn-primary text-sm" data-testid="po-designer-publish" disabled={publishMut.isPending || !layout} onClick={() => publishMut.mutate()}>{t("po.designer.publish")}</button>
        )}
      </div>
      {isLoading || !layout ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
      ) : (
        <PoTemplateDesigner layout={layout} onChange={setLayout} />
      )}
    </div>
  );
}
