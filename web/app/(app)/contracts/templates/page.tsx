"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { contractsApi, type ContractTemplateSummary, type ContractTemplateVersionSummary, type ContractType } from "@/lib/api";

export default function ContractTemplatesPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const { data: templates = [] } = useQuery({
    queryKey: ["contract-templates"],
    queryFn: () => contractsApi.listTemplates().then((r) => r.data.data),
  });
  const { data: types = [] } = useQuery({
    queryKey: ["contract-types-admin"],
    queryFn: () => contractsApi.types().then((r) => r.data.data),
  });

  const refreshTemplates = () => qc.invalidateQueries({ queryKey: ["contract-templates"] });

  const err = (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Action failed");

  const typeName = (id: number | null) => (id == null ? "—" : types.find((t: ContractType) => t.id === id)?.name ?? `#${id}`);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = useMemo(() => templates.find((t) => t.id === selectedId) ?? null, [templates, selectedId]);

  // New version form
  const [versionLabel, setVersionLabel] = useState("");
  const [versionBody, setVersionBody] = useState("");

  const addVersion = () => {
    if (!selected || !versionLabel.trim() || !versionBody.trim()) return;
    contractsApi.addTemplateVersion(selected.id, { version: versionLabel.trim(), body: versionBody })
      .then(() => {
        toast.success("Template version added");
        setVersionLabel("");
        setVersionBody("");
        refreshTemplates();
      }).catch(err);
  };

  const activateVersion = (versionId: number) => {
    if (!selected) return;
    contractsApi.activateTemplateVersion(selected.id, versionId)
      .then(() => { toast.success("Version activated"); refreshTemplates(); }).catch(err);
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
      toast.success("Template created");
      setNewName(""); setNewTypeId(""); setNewCounterparty("either"); setNewDescription(""); setNewBody("");
      refreshTemplates();
    }).catch(err);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <ModulePageHeader
        title="Contract Templates"
        subtitle="Versioned document templates — only APPROVED/ACTIVE versions can generate contracts."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Contracts", href: "/contracts" }, { label: "Templates" }]} />}
      />

      {/* Templates list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100"><h2 className="text-sm font-semibold text-neutral-800">Templates</h2></div>
        {templates.length === 0 ? (
          <div className="p-6 text-sm text-neutral-400">No templates have been created yet.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Contract type</th><th>Counterparty</th><th>Status</th><th>Current version</th><th></th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className={t.id === selectedId ? "bg-neutral-50" : ""}>
                  <td className="text-sm font-medium text-neutral-800">{t.name}</td>
                  <td className="text-xs text-neutral-500">{typeName(t.contract_type_id)}</td>
                  <td className="text-xs capitalize text-neutral-500">{t.counterparty_type ?? "—"}</td>
                  <td className="text-sm"><span className="badge">{t.status}</span></td>
                  <td className="text-xs text-neutral-500">{t.current_version?.version ?? "—"}</td>
                  <td className="text-right">
                    <button className="btn-secondary text-xs py-0.5" onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}>
                      {t.id === selectedId ? "Close" : "Open"}
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
            <h2 className="text-sm font-semibold text-neutral-800">{selected.name} — versions</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Current version: {selected.current_version?.version ?? "none set"}</p>
          </div>
          <table className="data-table">
            <thead><tr><th>Version</th><th>Status</th><th>Current</th><th></th></tr></thead>
            <tbody>
              {(selected.versions ?? []).length === 0 ? (
                <tr><td colSpan={4} className="text-sm text-neutral-400 p-4">No versions yet.</td></tr>
              ) : (selected.versions ?? []).map((v: ContractTemplateVersionSummary) => (
                <tr key={v.id}>
                  <td className="text-sm font-mono text-neutral-800">{v.version}</td>
                  <td className="text-sm"><span className="badge">{v.status}</span></td>
                  <td className="text-sm">{v.id === selected.current_version_id ? "Yes" : "No"}</td>
                  <td className="text-right">
                    {v.status !== "ACTIVE" && (
                      <button className="btn-secondary text-xs py-0.5" onClick={() => activateVersion(v.id)}>Activate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-neutral-100 space-y-2">
            <h3 className="text-xs font-semibold text-neutral-600">Add a new version</h3>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Version</label><input className="form-input w-32" value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="v1.1" /></div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Body</label>
              <textarea className="form-input w-full" rows={6} value={versionBody} onChange={(e) => setVersionBody(e.target.value)} placeholder="Template body text..." />
            </div>
            <button className="btn-primary text-sm" onClick={addVersion}>Add version</button>
          </div>
        </div>
      )}

      {/* New template */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100"><h2 className="text-sm font-semibold text-neutral-800">New template</h2></div>
        <div className="p-4 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Name</label><input className="form-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Standard Consultancy Agreement" /></div>
            <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Contract type</label>
              <select className="form-input" value={newTypeId} onChange={(e) => setNewTypeId(e.target.value)}>
                <option value="">— none —</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Counterparty</label>
              <select className="form-input" value={newCounterparty} onChange={(e) => setNewCounterparty(e.target.value)}>
                <option value="individual">Individual</option><option value="organisation">Organisation</option><option value="either">Either</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Description (optional)</label>
            <textarea className="form-input w-full" rows={2} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Short description" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Body (first version)</label>
            <textarea className="form-input w-full" rows={8} value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Template body text..." />
          </div>
          <button className="btn-primary text-sm" onClick={createTemplate}>Create template</button>
        </div>
      </div>
    </div>
  );
}
