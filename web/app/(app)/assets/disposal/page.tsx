"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

type AssetOption = { id: number; asset_code: string; name: string; status: string; book_value?: number };
type Disposal = {
  id: number;
  reference: string;
  status: string;
  reason: string;
  method?: string | null;
  justification: string;
  estimated_value?: number | null;
  proceeds?: number | null;
  accounting_reference?: string | null;
  hod_comments?: string | null;
  finance_comments?: string | null;
  asset?: AssetOption;
  requester?: { id: number; name: string };
};

const REASONS = ["obsolete", "damaged", "lost", "stolen", "surplus", "other"] as const;
const METHODS = ["sale", "donation", "scrap", "write_off", "transfer"] as const;

export default function AssetDisposalPage() {
  const [rows, setRows] = useState<Disposal[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Disposal | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    asset_id: "",
    reason: "obsolete",
    method: "scrap",
    justification: "",
    estimated_value: "",
  });
  const [completeForm, setCompleteForm] = useState({
    method: "scrap",
    proceeds: "",
    accounting_reference: "",
  });

  async function load() {
    const r = await api.get<{ data: Disposal[] }>("/asset-disposals");
    const data = r.data as { data?: Disposal[] } & Disposal[];
    const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    setRows(list);
  }

  async function loadAssets() {
    try {
      const r = await api.get<{ data: AssetOption[] }>("/assets", { params: { status: "active", per_page: 100 } });
      const body = r.data as { data?: AssetOption[] };
      setAssets(Array.isArray(body.data) ? body.data : []);
    } catch {
      setAssets([]);
    }
  }

  useEffect(() => {
    load().catch(() => setRows([]));
    loadAssets();
  }, []);

  async function createDisposal(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await api.post("/asset-disposals", {
        asset_id: Number(form.asset_id),
        reason: form.reason,
        method: form.method,
        justification: form.justification,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      });
      setMsg("Disposal request created.");
      setShowCreate(false);
      setForm({ asset_id: "", reason: "obsolete", method: "scrap", justification: "", estimated_value: "" });
      await load();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Failed to create disposal.");
    } finally {
      setSaving(false);
    }
  }

  async function advance(id: number, action: string, payload: Record<string, unknown> = {}) {
    setSaving(true);
    setErr(null);
    try {
      await api.post(`/asset-disposals/${id}/${action}`, payload);
      setMsg(`Disposal ${action} recorded.`);
      setCompleteOpen(false);
      await load();
      if (selected?.id === id) {
        const r = await api.get<{ data: Disposal }>(`/asset-disposals/${id}`);
        setSelected((r.data as { data: Disposal }).data);
      }
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : `Failed to ${action}.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-container space-y-4">
      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Disposal Requests</h1>
          <p className="page-subtitle">
            Workflow: request → HOD recommend → Finance review → approve → complete. Assets are never hard-deleted.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/assets/revaluation" className="btn btn-secondary btn-sm">
            Revaluations
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            New disposal
          </button>
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      {showCreate && (
        <form onSubmit={createDisposal} className="card space-y-3 p-4">
          <h2 className="text-lg font-semibold">Create disposal request</h2>
          <label className="block text-sm">
            Asset
            <select
              className="form-input mt-1 w-full"
              required
              value={form.asset_id}
              onChange={(e) => setForm({ ...form, asset_id: e.target.value })}
            >
              <option value="">Select asset…</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset_code} — {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              Reason
              <select className="form-input mt-1 w-full" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                {REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Method
              <select className="form-input mt-1 w-full" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Justification
            <textarea
              className="form-input mt-1 w-full"
              rows={3}
              required
              value={form.justification}
              onChange={(e) => setForm({ ...form, justification: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Estimated value
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-input mt-1 w-full"
              value={form.estimated_value}
              onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving…" : "Submit request"}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="table-wrap lg:col-span-3">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Asset</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className={selected?.id === d.id ? "bg-neutral-50" : undefined}>
                  <td>
                    <button type="button" className="text-primary hover:underline" onClick={() => setSelected(d)}>
                      {d.reference}
                    </button>
                  </td>
                  <td>{d.asset?.asset_code ?? "—"}</td>
                  <td>{d.reason}</td>
                  <td>{d.status}</td>
                  <td className="flex flex-wrap gap-1">
                    {d.status === "draft" && (
                      <button className="btn btn-sm" disabled={saving} onClick={() => advance(d.id, "recommend", { comments: "Recommended" })}>
                        HOD recommend
                      </button>
                    )}
                    {d.status === "recommended" && (
                      <button className="btn btn-sm" disabled={saving} onClick={() => advance(d.id, "finance-review", { comments: "Finance OK" })}>
                        Finance review
                      </button>
                    )}
                    {d.status === "finance_reviewed" && (
                      <button className="btn btn-sm" disabled={saving} onClick={() => advance(d.id, "approve")}>
                        Approve
                      </button>
                    )}
                    {d.status === "approved" && (
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={saving}
                        onClick={() => {
                          setSelected(d);
                          setCompleteForm({
                            method: d.method || "scrap",
                            proceeds: "",
                            accounting_reference: "",
                          });
                          setCompleteOpen(true);
                        }}
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5}>No disposal requests.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card space-y-2 p-4 lg:col-span-2">
          <h2 className="text-lg font-semibold">Detail</h2>
          {!selected && <p className="text-sm text-neutral-500">Select a disposal to view workflow detail.</p>}
          {selected && (
            <>
              <p className="text-sm"><span className="font-medium">Reference:</span> {selected.reference}</p>
              <p className="text-sm"><span className="font-medium">Asset:</span> {selected.asset?.asset_code} — {selected.asset?.name}</p>
              <p className="text-sm"><span className="font-medium">Status:</span> {selected.status}</p>
              <p className="text-sm"><span className="font-medium">Reason / method:</span> {selected.reason} / {selected.method ?? "—"}</p>
              <p className="text-sm whitespace-pre-wrap"><span className="font-medium">Justification:</span> {selected.justification}</p>
              {selected.hod_comments && <p className="text-sm"><span className="font-medium">HOD:</span> {selected.hod_comments}</p>}
              {selected.finance_comments && <p className="text-sm"><span className="font-medium">Finance:</span> {selected.finance_comments}</p>}
              {selected.accounting_reference && <p className="text-sm"><span className="font-medium">Accounting ref:</span> {selected.accounting_reference}</p>}
            </>
          )}
        </div>
      </div>

      {completeOpen && selected && (
        <form
          className="card space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void advance(selected.id, "complete", {
              method: completeForm.method,
              proceeds: completeForm.proceeds ? Number(completeForm.proceeds) : null,
              accounting_reference: completeForm.accounting_reference || null,
            });
          }}
        >
          <h2 className="text-lg font-semibold">Complete disposal — {selected.reference}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              Method
              <select className="form-input mt-1 w-full" value={completeForm.method} onChange={(e) => setCompleteForm({ ...completeForm, method: e.target.value })}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Proceeds
              <input type="number" min="0" step="0.01" className="form-input mt-1 w-full" value={completeForm.proceeds} onChange={(e) => setCompleteForm({ ...completeForm, proceeds: e.target.value })} />
            </label>
            <label className="block text-sm">
              Accounting reference
              <input className="form-input mt-1 w-full" value={completeForm.accounting_reference} onChange={(e) => setCompleteForm({ ...completeForm, accounting_reference: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>Complete</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCompleteOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
