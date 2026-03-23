"use client";

import { useState, useEffect } from "react";
import { vendorsApi, type Vendor } from "@/lib/api";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    registration_number: "",
    contact_email: "",
    contact_phone: "",
    address: "",
  });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    vendorsApi.list()
      .then((res) => setVendors(res.data.data ?? []))
      .catch(() => setError("Failed to load vendors."))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Vendor name is required."); return; }
    setSaving(true);
    setFormError("");
    vendorsApi.create(form)
      .then((res) => {
        setVendors((prev) => [...prev, res.data.data]);
        setForm({ name: "", registration_number: "", contact_email: "", contact_phone: "", address: "" });
        setShowForm(false);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? "Failed to create vendor.";
        setFormError(msg);
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Vendor Register</h1>
          <p className="page-subtitle">Approved suppliers and service providers for procurement.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setFormError(""); }}
          className="btn-primary flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">{showForm ? "close" : "add"}</span>
          {showForm ? "Cancel" : "Add Vendor"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* Add vendor form */}
      {showForm && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-neutral-800 mb-4">New Vendor</h2>
          {formError && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{formError}</div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-600 mb-1">Vendor Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Acme Supplies Ltd"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">Registration Number</label>
              <input
                type="text"
                className="form-input"
                value={form.registration_number}
                onChange={(e) => setForm((f) => ({ ...f, registration_number: e.target.value }))}
                placeholder="e.g. CC/2021/12345"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">Contact Email</label>
              <input
                type="email"
                className="form-input"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                placeholder="vendor@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">Contact Phone</label>
              <input
                type="text"
                className="form-input"
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                placeholder="+264 61 000 0000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">Address</label>
              <input
                type="text"
                className="form-input"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Street, City, Country"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary py-2 px-4 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5 disabled:opacity-60">
                {saving && <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>}
                {saving ? "Saving…" : "Save Vendor"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vendors table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-neutral-800">
            Vendors
            {!loading && <span className="ml-2 text-xs font-normal text-neutral-400">({vendors.length})</span>}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left">Name</th>
                <th className="text-left">Reg. Number</th>
                <th className="text-left">Email</th>
                <th className="text-left">Phone</th>
                <th className="text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-neutral-400">
                    <span className="material-symbols-outlined animate-spin text-primary">autorenew</span>
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-neutral-400">
                      <span className="material-symbols-outlined text-3xl">storefront</span>
                      <p className="text-sm">No vendors registered yet.</p>
                      <button type="button" onClick={() => setShowForm(true)} className="btn-primary mt-1 py-1.5 px-4 text-xs">Add First Vendor</button>
                    </div>
                  </td>
                </tr>
              ) : (
                vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-neutral-50/50">
                    <td className="font-medium text-neutral-900">{v.name}</td>
                    <td className="font-mono text-xs text-neutral-500">{v.registration_number ?? "—"}</td>
                    <td className="text-neutral-600">{v.contact_email ?? "—"}</td>
                    <td className="text-neutral-600">{v.contact_phone ?? "—"}</td>
                    <td>
                      {v.is_approved ? (
                        <span className="badge badge-success">Approved</span>
                      ) : (
                        <span className="badge badge-warning">Pending</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
