"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { contractsApi, type ContractType, type CurrencyRecord } from "@/lib/api";

export default function ContractSettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const { data: types = [] } = useQuery({
    queryKey: ["contract-types-admin"],
    queryFn: () => contractsApi.types().then((r) => r.data.data),
  });
  const { data: currencies = [] } = useQuery({
    queryKey: ["contract-currencies-admin"],
    queryFn: () => contractsApi.currencies(true).then((r) => r.data.data),
  });

  // New contract type form
  const [typeName, setTypeName] = useState("");
  const [typeCounterparty, setTypeCounterparty] = useState("individual");
  const [typeLegal, setTypeLegal] = useState(false);

  // New currency form
  const [curCode, setCurCode] = useState("");
  const [curName, setCurName] = useState("");
  const [curSymbol, setCurSymbol] = useState("");

  const refreshTypes = () => qc.invalidateQueries({ queryKey: ["contract-types-admin"] });
  const refreshCurrencies = () => qc.invalidateQueries({ queryKey: ["contract-currencies-admin"] });

  const err = (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Action failed");

  const addType = () => {
    if (!typeName.trim()) return;
    contractsApi.createType({ name: typeName.trim(), counterparty_type: typeCounterparty, requires_legal_review: typeLegal })
      .then(() => { toast.success("Contract type added"); setTypeName(""); setTypeLegal(false); refreshTypes(); }).catch(err);
  };
  const toggleType = (t: ContractType) =>
    contractsApi.updateType(t.id, { is_active: !t.is_active }).then(() => { toast.success("Updated"); refreshTypes(); }).catch(err);
  const toggleTypeLegal = (t: ContractType) =>
    contractsApi.updateType(t.id, { requires_legal_review: !t.requires_legal_review }).then(() => { toast.success("Updated"); refreshTypes(); }).catch(err);

  const addCurrency = () => {
    if (!curCode.trim() || !curName.trim()) return;
    contractsApi.createCurrency({ code: curCode.trim(), name: curName.trim(), symbol: curSymbol.trim() || undefined })
      .then(() => { toast.success("Currency added"); setCurCode(""); setCurName(""); setCurSymbol(""); refreshCurrencies(); }).catch(err);
  };
  const makeDefault = (c: CurrencyRecord) =>
    contractsApi.updateCurrency(c.id, { is_default: true }).then(() => { toast.success("Default set"); refreshCurrencies(); }).catch(err);
  const toggleCurrency = (c: CurrencyRecord) =>
    contractsApi.updateCurrency(c.id, { is_active: !c.is_active }).then(() => { toast.success("Updated"); refreshCurrencies(); }).catch(err);

  return (
    <div className="space-y-6 max-w-4xl">
      <ModulePageHeader
        title="Contract Settings"
        subtitle="Manage contract types and the central currency reference"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Contracts", href: "/contracts" }, { label: "Settings" }]} />}
      />

      {/* Contract types */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100"><h2 className="text-sm font-semibold text-neutral-800">Contract types</h2></div>
        <table className="data-table">
          <thead><tr><th>Name</th><th>Counterparty</th><th>Legal review</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id}>
                <td className="text-sm font-medium text-neutral-800">{t.name}</td>
                <td className="text-xs capitalize text-neutral-500">{t.counterparty_type}</td>
                <td className="text-sm">
                  <button className="text-primary text-xs underline" onClick={() => toggleTypeLegal(t)}>{t.requires_legal_review ? "Required" : "Not required"}</button>
                </td>
                <td className="text-sm">{t.is_active ? "Yes" : "No"}</td>
                <td className="text-right"><button className="btn-secondary text-xs py-0.5" onClick={() => toggleType(t)}>{t.is_active ? "Deactivate" : "Activate"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-end gap-2">
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">New type name</label><input className="form-input" value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="e.g. Translation Services Agreement" /></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Counterparty</label>
            <select className="form-input" value={typeCounterparty} onChange={(e) => setTypeCounterparty(e.target.value)}>
              <option value="individual">Individual</option><option value="organisation">Organisation</option><option value="either">Either</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-600 pb-2"><input type="checkbox" checked={typeLegal} onChange={(e) => setTypeLegal(e.target.checked)} /> Requires legal review</label>
          <button className="btn-primary text-sm" onClick={addType}>Add type</button>
        </div>
      </div>

      {/* Currencies */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100"><h2 className="text-sm font-semibold text-neutral-800">Currencies</h2></div>
        <table className="data-table">
          <thead><tr><th>Code</th><th>Name</th><th>Symbol</th><th>Default</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {currencies.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-sm">{c.code}</td>
                <td className="text-sm text-neutral-800">{c.name}</td>
                <td className="text-sm text-neutral-600">{c.symbol ?? "—"}</td>
                <td className="text-sm">{c.is_default ? <span className="badge badge-success">Default</span> : <button className="text-primary text-xs underline" onClick={() => makeDefault(c)}>Set default</button>}</td>
                <td className="text-sm">{c.is_active ? "Yes" : "No"}</td>
                <td className="text-right"><button className="btn-secondary text-xs py-0.5" onClick={() => toggleCurrency(c)}>{c.is_active ? "Deactivate" : "Activate"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-end gap-2">
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Code</label><input className="form-input w-24 uppercase" value={curCode} maxLength={8} onChange={(e) => setCurCode(e.target.value.toUpperCase())} placeholder="KES" /></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Name</label><input className="form-input" value={curName} onChange={(e) => setCurName(e.target.value)} placeholder="Kenyan Shilling" /></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Symbol</label><input className="form-input w-24" value={curSymbol} onChange={(e) => setCurSymbol(e.target.value)} placeholder="KSh" /></div>
          <button className="btn-primary text-sm" onClick={addCurrency}>Add currency</button>
        </div>
      </div>
    </div>
  );
}
