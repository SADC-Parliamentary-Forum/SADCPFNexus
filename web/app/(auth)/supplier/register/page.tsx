"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supplierCategoriesApi, supplierRegistrationApi, type SupplierCategory } from "@/lib/api";

interface FormState {
  company_name: string;
  registration_number: string;
  tax_number: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  address: string;
  country: string;
  bank_name: string;
  bank_account: string;
  bank_branch: string;
  payment_terms: string;
  password: string;
  password_confirmation: string;
}

const initialForm: FormState = {
  company_name: "",
  registration_number: "",
  tax_number: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  website: "",
  address: "",
  country: "",
  bank_name: "",
  bank_account: "",
  bank_branch: "",
  payment_terms: "",
  password: "",
  password_confirmation: "",
};

export default function SupplierRegisterPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [categories, setCategories] = useState<SupplierCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    supplierCategoriesApi.publicList()
      .then((response) => setCategories(response.data.data))
      .catch(() => setError("Failed to load supplier categories."))
      .finally(() => setLoadingCategories(false));
  }, []);

  const canSubmit = useMemo(() => {
    return selectedCategories.length >= 1 && selectedCategories.length <= 3 && documents.length > 0;
  }, [documents.length, selectedCategories.length]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCategory(id: number) {
    setSelectedCategories((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      selectedCategories.forEach((id) => payload.append("category_ids[]", String(id)));
      documents.forEach((file) => payload.append("documents[]", file));

      const response = await supplierRegistrationApi.register(payload);
      setSuccess(response.data.message);
      setForm(initialForm);
      setSelectedCategories([]);
      setDocuments([]);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data?.message
        ?? Object.values((err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors ?? {})?.[0]?.[0]
        ?? "Supplier registration failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-muted px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Supplier Registration</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Register your company to receive category-matched RFQs through the SADC-PF supplier portal.
            </p>
          </div>
          <Link href="/login" className="btn-secondary text-sm">
            Back to Login
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-6 p-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Company Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <input className="form-input" placeholder="Company name" value={form.company_name} onChange={(e) => setField("company_name", e.target.value)} required />
              <input className="form-input" placeholder="Registration number" value={form.registration_number} onChange={(e) => setField("registration_number", e.target.value)} required />
              <input className="form-input" placeholder="Tax number" value={form.tax_number} onChange={(e) => setField("tax_number", e.target.value)} required />
              <input className="form-input" placeholder="Website (optional)" value={form.website} onChange={(e) => setField("website", e.target.value)} />
              <input className="form-input sm:col-span-2" placeholder="Physical address" value={form.address} onChange={(e) => setField("address", e.target.value)} required />
              <input className="form-input" placeholder="Country" value={form.country} onChange={(e) => setField("country", e.target.value)} required />
              <input className="form-input" placeholder="Payment terms" value={form.payment_terms} onChange={(e) => setField("payment_terms", e.target.value)} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Primary Contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <input className="form-input" placeholder="Contact name" value={form.contact_name} onChange={(e) => setField("contact_name", e.target.value)} required />
              <input className="form-input" type="email" placeholder="Contact email" value={form.contact_email} onChange={(e) => setField("contact_email", e.target.value)} required />
              <input className="form-input" placeholder="Contact phone" value={form.contact_phone} onChange={(e) => setField("contact_phone", e.target.value)} required />
              <div className="grid grid-cols-2 gap-4">
                <input className="form-input" type="password" placeholder="Password" value={form.password} onChange={(e) => setField("password", e.target.value)} required />
                <input className="form-input" type="password" placeholder="Confirm password" value={form.password_confirmation} onChange={(e) => setField("password_confirmation", e.target.value)} required />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Banking</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <input className="form-input" placeholder="Bank name" value={form.bank_name} onChange={(e) => setField("bank_name", e.target.value)} required />
              <input className="form-input" placeholder="Bank account" value={form.bank_account} onChange={(e) => setField("bank_account", e.target.value)} required />
              <input className="form-input" placeholder="Branch / SWIFT" value={form.bank_branch} onChange={(e) => setField("bank_branch", e.target.value)} required />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Categories</h2>
              <span className="text-xs text-neutral-400">{selectedCategories.length}/3 selected</span>
            </div>
            {loadingCategories ? (
              <p className="text-sm text-neutral-500">Loading categories…</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {categories.map((category) => {
                  const selected = selectedCategories.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                        selected ? "border-primary bg-primary/5" : "border-neutral-200 bg-white hover:border-primary/40"
                      }`}
                    >
                      <p className="text-sm font-semibold text-neutral-900">{category.name}</p>
                      <p className="mt-1 text-xs text-neutral-500">{category.code}</p>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-neutral-500">Select at least one category and no more than three.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Supporting Documents</h2>
            <input
              type="file"
              multiple
              onChange={(e) => setDocuments(Array.from(e.target.files ?? []))}
              className="form-input"
              required
            />
            <p className="text-xs text-neutral-500">
              Upload company profile, registration certificate, tax clearance, or bank confirmation documents.
            </p>
            {documents.length > 0 && (
              <ul className="space-y-1 text-sm text-neutral-600">
                {documents.map((file) => (
                  <li key={`${file.name}-${file.size}`}>{file.name}</li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
            <Link href="/login" className="btn-secondary text-sm">
              Cancel
            </Link>
            <button type="submit" disabled={loading || !canSubmit} className="btn-primary text-sm disabled:opacity-60">
              {loading ? "Submitting…" : "Submit Registration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
