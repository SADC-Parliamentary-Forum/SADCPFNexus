"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { assetUnregisteredFindsApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Campaign = { id: number; name: string; status: string; starts_on: string; ends_on?: string };
type Counts = Record<string, number>;
type Find = { id: number; description: string; status: string; found_location?: string | null };

export default function AssetVerificationPage() {
  const { t } = useI18n();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [finds, setFinds] = useState<Find[]>([]);
  const [findDesc, setFindDesc] = useState("");

  async function load(campaignId?: number) {
    const r = await api.get<{ data: Campaign[] }>("/assets-meta/verification-campaigns");
    const list = Array.isArray(r.data.data) ? r.data.data : ((r.data as { data?: Campaign[] }).data ?? []);
    setCampaigns(list);
    const selected = campaignId ?? activeId ?? list[0]?.id;
    if (selected) {
      setActiveId(selected);
      const dash = await api.get<{ data: { counts: Counts } }>(`/assets-meta/verification-campaigns/${selected}/dashboard`);
      setCounts(dash.data.data.counts);
    }
    const found = await assetUnregisteredFindsApi.list();
    setFinds(((found.data as { data?: Find[] }).data ?? []) as Find[]);
  }

  useEffect(() => { load().catch(() => setCampaigns([])); }, []);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setMsg(null);
    setErrorMsg(null);
    try {
      await api.post("/assets-meta/verification-campaigns", { name, starts_on: startsOn });
      setName("");
      setMsg(t("common.create"));
      await load();
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: string } } };
      setErrorMsg(ax?.response?.data?.message ?? t("common.error"));
    } finally {
      setCreating(false);
    }
  }

  async function recordFind(e: React.FormEvent) {
    e.preventDefault();
    await assetUnregisteredFindsApi.create({ description: findDesc, campaign_id: activeId ?? campaigns[0]?.id });
    setFindDesc("");
    await load(activeId ?? undefined);
  }

  async function promoteFind(find: Find) {
    const tag = window.prompt(t("assets.verify.promoteTag"));
    if (!tag) return;
    await assetUnregisteredFindsApi.promote(find.id, { asset_tag: tag, name: find.description });
    await load(activeId ?? undefined);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="page-header">
        <ModulePageHeader
          title={t("assets.verify.title")}
          subtitle={t("assets.verify.subtitle")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.verify.title") }]} />}
        />
      </div>
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {errorMsg && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMsg}</div>}
      {counts && (
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.entries(counts).map(([k, v]) => (
            <div key={k} className="card p-3">
              <div className="text-xs text-neutral-500">{t(`assets.verify.count.${k}`)}</div>
              <div className="text-lg font-semibold">{v}</div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={createCampaign} className="card" style={{ padding: "1rem", marginBottom: "1.5rem", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input className="input" placeholder={t("assets.verify.title")} value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
        <Button type="submit" disabled={creating}>{creating ? t("common.loading") : t("common.create")}</Button>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("assets.verify.colName")}</th>
              <th>{t("assets.verify.colStatus")}</th>
              <th>{t("assets.verify.colStarts")}</th>
              <th>{t("assets.verify.colEnds")}</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className={activeId === c.id ? "bg-primary/5" : undefined}>
                <td>
                  <button type="button" className="text-left font-medium" onClick={() => load(c.id)}>{c.name}</button>
                </td>
                <td>{c.status}</td>
                <td>{c.starts_on}</td>
                <td>{c.ends_on ?? "—"}</td>
              </tr>
            ))}
            {campaigns.length === 0 && <tr><td colSpan={4}>{t("common.noResults")}</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-semibold">{t("assets.verify.unregistered")}</h2>
      <form onSubmit={recordFind} className="card flex gap-2 p-4">
        <input className="input flex-1" value={findDesc} onChange={(e) => setFindDesc(e.target.value)} placeholder={t("assets.verify.recordFind")} required />
        <Button type="submit">{t("assets.verify.recordFind")}</Button>
      </form>
      <ul className="card space-y-2 p-4 text-sm">
        {finds.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>{f.description} — {f.status}</span>
            {f.status !== "promoted" && (
              <Button type="button" size="sm" variant="secondary" onClick={() => promoteFind(f)}>{t("assets.verify.promote")}</Button>
            )}
          </li>
        ))}
        {finds.length === 0 && <li>{t("common.noResults")}</li>}
      </ul>
    </div>
  );
}
