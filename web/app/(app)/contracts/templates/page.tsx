"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { contractsApi, type ContractTemplateSummary, type ContractTemplateVersionSummary, type ContractType } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function ContractTemplatesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();

  const { data: templates = [] } = useQuery({
    queryKey: ["contract-templates"],
    queryFn: () => contractsApi.listTemplates().then((r) => r.data.data),
  });
  const { data: types = [] } = useQuery({
    queryKey: ["contract-types-admin"],
    queryFn: () => contractsApi.types().then((r) => r.data.data),
  });

  const refreshTemplates = () => qc.invalidateQueries({ queryKey: ["contract-templates"] });

  const err = (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.common.actionFailed"));

  const typeName = (id: number | null) => (id == null ? "—" : types.find((ty: ContractType) => ty.id === id)?.name ?? `#${id}`);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = useMemo(() => templates.find((tpl) => tpl.id === selectedId) ?? null, [templates, selectedId]);

  // New version form
  const [versionLabel, setVersionLabel] = useState("");
  const [versionBody, setVersionBody] = useState("");

  const addVersion = () => {
    if (!selected || !versionLabel.trim() || !versionBody.trim()) return;
    contractsApi.addTemplateVersion(selected.id, { version: versionLabel.trim(), body: versionBody })
      .then(() => {
        toast.success(t("contracts.templates.versionAdded"));
        setVersionLabel("");
        setVersionBody("");
        refreshTemplates();
      }).catch(err);
  };

  const activateVersion = (versionId: number) => {
    if (!selected) return;
    contractsApi.activateTemplateVersion(selected.id, versionId)
      .then(() => { toast.success(t("contracts.templates.versionActivated")); refreshTemplates(); }).catch(err);
  };

  // New template form
  const [newName, setNewName] = useState("");
  const [newTypeId, setNewTypeId] = useState("");
  const [newCounterparty, setNewCounterparty] = useState("either");
  const [newDescription, setNewDescription] = useState("");
  const [newBody, setNewBody] = useState("");

  const createTemplate = () => {
    if (!newName.trim() || !newBody.trim()) return;
    contractsApi.createTemplate({
      name: newName.trim(),
      contract_type_id: newTypeId ? Number(newTypeId) : undefined,
      counterparty_type: newCounterparty,
      description: newDescription.trim() || undefined,
      body: newBody,
    }).then(() => {
      toast.success(t("contracts.templates.created"));
      setNewName(""); setNewTypeId(""); setNewCounterparty("either"); setNewDescription(""); setNewBody("");
      refreshTemplates();
    }).catch(err);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <ModulePageHeader
        title="contracts.templates.title"
        subtitle="contracts.templates.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.contracts", href: "/contracts" }, { label: "contracts.templates.crumb" }]} />}
      />

      {/* Templates list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100"><h2 className="text-sm font-semibold text-neutral-800">{t("contracts.templates.crumb")}</h2></div>
        {templates.length === 0 ? (
          <div className="p-6 text-sm text-neutral-400">{t("contracts.templates.empty")}</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>{t("contracts.field.name")}</th><th>{t("contracts.field.contractType")}</th><th>{t("contracts.field.counterparty")}</th><th>{t("contracts.field.status")}</th><th>{t("contracts.templates.currentVersion")}</th><th></th></tr></thead>
            <tbody>
              {templates.map((tpl) => (
                <tr key={tpl.id} className={tpl.id === selectedId ? "bg-neutral-50" : ""}>
                  <td className="text-sm font-medium text-neutral-800">{tpl.name}</td>
                  <td className="text-xs text-neutral-500">{typeName(tpl.contract_type_id)}</td>
                  <td className="text-xs capitalize text-neutral-500">{tpl.counterparty_type ?? "—"}</td>
                  <td className="text-sm"><span className="badge">{tpl.status}</span></td>
                  <td className="text-xs text-neutral-500">{tpl.current_version?.version ?? "—"}</td>
                  <td className="text-right">
                    <button className="btn-secondary text-xs py-0.5" onClick={() => setSelectedId(tpl.id === selectedId ? null : tpl.id)}>
                      {tpl.id === selectedId ? t("common.close") : t("common.open")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected template: version history + add version */}
      {selected && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.templates.versionsOf", { name: selected.name })}</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{t("contracts.templates.currentVersionLine", { version: selected.current_version?.version ?? t("contracts.templates.noneSet") })}</p>
          </div>
          <table className="data-table">
            <thead><tr><th>{t("contracts.templates.version")}</th><th>{t("contracts.field.status")}</th><th>{t("contracts.templates.current")}</th><th></th></tr></thead>
            <tbody>
              {(selected.versions ?? []).length === 0 ? (
                <tr><td colSpan={4} className="text-sm text-neutral-400 p-4">{t("contracts.templates.noVersions")}</td></tr>
              ) : (selected.versions ?? []).map((v: ContractTemplateVersionSummary) => (
                <tr key={v.id}>
                  <td className="text-sm font-mono text-neutral-800">{v.version}</td>
                  <td className="text-sm"><span className="badge">{v.status}</span></td>
                  <td className="text-sm">{v.id === selected.current_version_id ? t("contracts.common.yes") : t("contracts.common.no")}</td>
                  <td className="text-right">
                    {v.status !== "ACTIVE" && (
                      <button className="btn-secondary text-xs py-0.5" onClick={() => activateVersion(v.id)}>{t("contracts.templates.activate")}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-neutral-100 space-y-2">
            <h3 className="text-xs font-semibold text-neutral-600">{t("contracts.templates.addNewVersion")}</h3>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><label htmlFor="contracts-templates-version-label" className="text-xs font-semibold text-neutral-600">{t("contracts.templates.version")}</label><input id="contracts-templates-version-label" className="form-input w-32" value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="v1.1" /></div>
            </div>
            <div className="space-y-1">
              <label htmlFor="contracts-templates-version-body" className="text-xs font-semibold text-neutral-600">{t("contracts.templates.body")}</label>
              <textarea id="contracts-templates-version-body" className="form-input w-full" rows={6} value={versionBody} onChange={(e) => setVersionBody(e.target.value)} placeholder={t("contracts.templates.bodyPlaceholder")} />
            </div>
            <button className="btn-primary text-sm" onClick={addVersion}>{t("contracts.templates.addVersion")}</button>
          </div>
        </div>
      )}

      {/* New template */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100"><h2 className="text-sm font-semibold text-neutral-800">{t("contracts.templates.newTemplate")}</h2></div>
        <div className="p-4 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><label htmlFor="contracts-templates-new-name" className="text-xs font-semibold text-neutral-600">{t("contracts.field.name")}</label><input id="contracts-templates-new-name" className="form-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("contracts.templates.namePlaceholder")} /></div>
            <div className="space-y-1"><label htmlFor="contracts-templates-new-type" className="text-xs font-semibold text-neutral-600">{t("contracts.field.contractType")}</label>
              <select id="contracts-templates-new-type" className="form-input" value={newTypeId} onChange={(e) => setNewTypeId(e.target.value)}>
                <option value="">{t("contracts.common.noneOption")}</option>
                {types.map((ty) => <option key={ty.id} value={ty.id}>{ty.name}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label htmlFor="contracts-templates-new-counterparty" className="text-xs font-semibold text-neutral-600">{t("contracts.field.counterparty")}</label>
              <select id="contracts-templates-new-counterparty" className="form-input" value={newCounterparty} onChange={(e) => setNewCounterparty(e.target.value)}>
                <option value="individual">{t("contracts.counterpartyType.individual")}</option><option value="organisation">{t("contracts.counterpartyType.organisation")}</option><option value="either">{t("contracts.counterpartyType.either")}</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="contracts-templates-new-description" className="text-xs font-semibold text-neutral-600">{t("contracts.templates.descriptionOptional")}</label>
            <textarea id="contracts-templates-new-description" className="form-input w-full" rows={2} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder={t("contracts.templates.shortDescription")} />
          </div>
          <div className="space-y-1">
            <label htmlFor="contracts-templates-new-body" className="text-xs font-semibold text-neutral-600">{t("contracts.templates.bodyFirst")}</label>
            <textarea id="contracts-templates-new-body" className="form-input w-full" rows={8} value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder={t("contracts.templates.bodyPlaceholder")} />
          </div>
          <button className="btn-primary text-sm" onClick={createTemplate}>{t("contracts.templates.create")}</button>
        </div>
      </div>
    </div>
  );
}
