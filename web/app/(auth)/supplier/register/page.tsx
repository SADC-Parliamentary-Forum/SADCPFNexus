"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supplierCategoriesApi, supplierRegistrationApi, type SupplierCategory } from "@/lib/api";

const SADC_COUNTRIES = [
  "Angola", "Botswana", "Comoros", "Democratic Republic of the Congo",
  "Eswatini", "Lesotho", "Madagascar", "Malawi", "Mauritius", "Mozambique",
  "Namibia", "Seychelles", "South Africa", "Tanzania", "Zambia", "Zimbabwe",
];

const OTHER_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Antigua and Barbuda",
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina",
  "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic",
  "Chad", "Chile", "China", "Colombia", "Congo", "Costa Rica",
  "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea",
  "Estonia", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada",
  "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania",
  "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco",
  "Myanmar",
  "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria",
  "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru",
  "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines",
  "Samoa", "San Marino", "São Tomé and Príncipe", "Saudi Arabia", "Senegal",
  "Serbia", "Sierra Leone", "Singapore", "Slovakia", "Slovenia",
  "Solomon Islands", "Somalia", "Spain", "Sri Lanka", "Sudan", "Suriname",
  "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Thailand", "Timor-Leste", "Togo", "Tonga",
  "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Venezuela", "Vietnam",
  "Yemen",
];

const PAYMENT_TERMS_OPTIONS = [
  { value: "", label: "Select payment terms" },
  { value: "Due on Receipt", label: "Due on Receipt" },
  { value: "Net 7", label: "Net 7 – payment within 7 days of invoice" },
  { value: "Net 14", label: "Net 14 – payment within 14 days of invoice" },
  { value: "Net 30", label: "Net 30 – payment within 30 days of invoice" },
  { value: "Net 45", label: "Net 45 – payment within 45 days of invoice" },
  { value: "Net 60", label: "Net 60 – payment within 60 days of invoice" },
  { value: "Net 90", label: "Net 90 – payment within 90 days of invoice" },
  { value: "50% Upfront / 50% on Delivery", label: "50% Upfront / 50% on Delivery" },
  { value: "COD", label: "COD – Cash on Delivery" },
];

interface FormState {
  supplier_type: "company" | "individual";
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
  supplier_type: "company",
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
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [categories, setCategories] = useState<SupplierCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { setMounted(true); }, []);

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
    <div className="min-h-screen bg-surface-muted dark:bg-neutral-900 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Supplier Registration</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Register your company to receive category-matched RFQs through the SADC-PF supplier portal.
            </p>
          </div>
          <Link href="/login" className="btn-secondary text-sm">
            Back to Login
          </Link>
        </div>

        {!mounted ? (
          <div className="card space-y-6 p-6 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-3 w-32 rounded bg-neutral-100 dark:bg-neutral-700/40" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {[...Array(4)].map((_, j) => <div key={j} className="h-10 rounded-lg bg-neutral-100 dark:bg-neutral-700/40" />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="card space-y-6 p-6">
          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
              {success}
            </div>
          )}

          {/* Supplier type toggle */}
          <div className="flex gap-3">
            {(["company", "individual"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setField("supplier_type", type)}
                className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors ${
                  form.supplier_type === type
                    ? "border-primary bg-primary/5"
                    : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-primary/40"
                }`}
              >
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {type === "company" ? "Company / Organisation" : "Individual / Sole Trader"}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {type === "company"
                    ? "Registered business, NGO, or institution"
                    : "Freelancer, translator, interpreter, or sole trader"}
                </p>
              </button>
            ))}
          </div>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {form.supplier_type === "individual" ? "Your Details" : "Company Details"}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                className="form-input"
                placeholder={form.supplier_type === "individual" ? "Full name or trading name" : "Company name"}
                value={form.company_name}
                onChange={(e) => setField("company_name", e.target.value)}
                required
              />
              <div className="space-y-1">
                <input
                  className="form-input w-full"
                  placeholder={form.supplier_type === "individual" ? "Business reg. no. (if any)" : "Registration number"}
                  value={form.registration_number}
                  onChange={(e) => setField("registration_number", e.target.value)}
                  required={form.supplier_type === "company"}
                />
                {form.supplier_type === "individual" && (
                  <p className="text-xs text-neutral-400">Optional for individuals.</p>
                )}
              </div>
              <div className="space-y-1">
                <input
                  className="form-input w-full"
                  placeholder={form.supplier_type === "individual" ? "Tax number (if any)" : "Tax number"}
                  value={form.tax_number}
                  onChange={(e) => setField("tax_number", e.target.value)}
                  required={form.supplier_type === "company"}
                />
                {form.supplier_type === "individual" && (
                  <p className="text-xs text-neutral-400">Optional for individuals.</p>
                )}
              </div>
              <input className="form-input" placeholder="Website (optional)" value={form.website} onChange={(e) => setField("website", e.target.value)} />
              <input className="form-input sm:col-span-2" placeholder="Physical address" value={form.address} onChange={(e) => setField("address", e.target.value)} required />

              <select
                className="form-input"
                value={form.country}
                onChange={(e) => setField("country", e.target.value)}
                required
              >
                <option value="">Select country</option>
                <optgroup label="SADC Member States">
                  {SADC_COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
                <optgroup label="Other Countries">
                  {OTHER_COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              </select>

              <div className="space-y-1">
                <select
                  className="form-input w-full"
                  value={form.payment_terms}
                  onChange={(e) => setField("payment_terms", e.target.value)}
                >
                  {PAYMENT_TERMS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-neutral-400">
                  Your standard payment terms — how many days after invoice you expect payment (e.g. Net 30 means payment is due within 30 days).
                </p>
              </div>
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
            ) : categories.length === 0 ? (
              <p className="text-sm text-neutral-500">No categories available.</p>
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
        )}
      </div>
    </div>
  );
}
