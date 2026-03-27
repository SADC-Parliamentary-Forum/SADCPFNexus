"use client";

import { useState, useEffect } from "react";
import { saamApi, tenantUsersApi, type DelegatedAuthority, type TenantUserOption } from "@/lib/api";

export default function DelegationsPage() {
  const [outgoing, setOutgoing] = useState<DelegatedAuthority[]>([]);
  const [incoming, setIncoming] = useState<DelegatedAuthority[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [users, setUsers] = useState<TenantUserOption[]>([]);
  const [form, setForm] = useState({
    delegate_user_id: "",
    start_date: "",
    end_date: "",
    role_scope: "",
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  function loadData() {
    setLoading(true);
    Promise.all([
      saamApi.listDelegations(),
      tenantUsersApi.list(),
    ])
      .then(([delRes, usrRes]) => {
        setOutgoing(delRes.data.data.outgoing ?? []);
        setIncoming(delRes.data.data.incoming ?? []);
        setUsers(usrRes.data.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  async function createDelegation() {
    if (!form.delegate_user_id || !form.start_date || !form.end_date) {
      setError("Delegate, start date, and end date are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saamApi.createDelegation({
        delegate_user_id: Number(form.delegate_user_id),
        start_date: form.start_date,
        end_date: form.end_date,
        role_scope: form.role_scope || undefined,
        reason: form.reason || undefined,
      });
      setShowForm(false);
      setForm({ delegate_user_id: "", start_date: "", end_date: "", role_scope: "", reason: "" });
      showToast("Delegation created.");
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create delegation.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function revoke(id: number) {
    if (!confirm("Revoke this delegation?")) return;
    try {
      await saamApi.revokeDelegation(id);
      showToast("Delegation revoked.");
      loadData();
    } catch { setError("Failed to revoke delegation."); }
  }

  function isActive(d: DelegatedAuthority) {
    const today = new Date().toISOString().slice(0, 10);
    return d.start_date <= today && d.end_date >= today;
  }

  const PERMISSION_SCOPES = [
    "correspondence.approve", "correspondence.review", "correspondence.send",
    "travel.approve", "imprest.approve", "finance.approve", "procurement.approve",
    "leave.approve", "hr.approve", "governance.approve",
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white bg-green-600 shadow-lg">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Delegation of Authority</h1>
          <p className="page-subtitle">Grant temporary signing authority to another staff member on your behalf.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-1.5 flex-shrink-0 text-sm">
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Delegation
        </button>
      </div>

      {loading ? (
        <div className="h-32 bg-neutral-100 rounded-xl animate-pulse" />
      ) : (
        <>
          {/* Outgoing */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">arrow_outward</span>
              <h2 className="text-sm font-semibold text-neutral-900">My Delegations Out ({outgoing.length})</h2>
            </div>
            {outgoing.length === 0 ? (
              <p className="px-5 py-8 text-sm text-neutral-400 text-center">No outgoing delegations.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {outgoing.map((d) => (
                  <div key={d.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-neutral-900">{d.delegate?.name ?? `User #${d.delegate_user_id}`}</span>
                        {isActive(d) ? (
                          <span className="badge badge-success text-[10px]">Active</span>
                        ) : (
                          <span className="badge badge-muted text-[10px]">Expired</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400">
                        {d.start_date} → {d.end_date}
                        {d.role_scope && <> · Scope: <span className="font-mono">{d.role_scope}</span></>}
                      </p>
                      {d.reason && <p className="text-xs text-neutral-500 mt-0.5 italic">{d.reason}</p>}
                    </div>
                    {isActive(d) && (
                      <button onClick={() => revoke(d.id)} className="text-xs font-semibold text-red-500 hover:underline flex-shrink-0">Revoke</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Incoming */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[18px]">arrow_inward</span>
              <h2 className="text-sm font-semibold text-neutral-900">Delegated to Me ({incoming.length})</h2>
            </div>
            {incoming.length === 0 ? (
              <p className="px-5 py-8 text-sm text-neutral-400 text-center">No active delegations from others.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {incoming.map((d) => (
                  <div key={d.id} className="px-5 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-neutral-900">From: {d.principal?.name ?? `User #${d.principal_user_id}`}</span>
                      {isActive(d) ? (
                        <span className="badge badge-success text-[10px]">Active</span>
                      ) : (
                        <span className="badge badge-muted text-[10px]">Expired</span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400">
                      {d.start_date} → {d.end_date}
                      {d.role_scope && <> · Scope: <span className="font-mono">{d.role_scope}</span></>}
                    </p>
                    {d.reason && <p className="text-xs text-neutral-500 mt-0.5 italic">{d.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create delegation slide-over */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative z-10 w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <h2 className="text-base font-semibold text-neutral-900">New Delegation</h2>
              <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Delegate To *</label>
                <select className="form-input" value={form.delegate_user_id} onChange={(e) => setForm({ ...form, delegate_user_id: e.target.value })}>
                  <option value="">Select staff member…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Start Date *</label>
                  <input type="date" className="form-input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">End Date *</label>
                  <input type="date" className="form-input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Scope (Permission)</label>
                <select className="form-input" value={form.role_scope} onChange={(e) => setForm({ ...form, role_scope: e.target.value })}>
                  <option value="">All permissions (no restriction)</option>
                  {PERMISSION_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Reason</label>
                <textarea rows={3} className="form-input resize-none" placeholder="e.g. Annual leave, official mission…" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={createDelegation} disabled={saving} className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-60">
                {saving ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-[16px]">add</span>}
                {saving ? "Creating…" : "Create Delegation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
