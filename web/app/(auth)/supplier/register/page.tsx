"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supplierCategoriesApi, supplierRegistrationApi, type SupplierCategory } from "@/lib/api";
import { LocaleSwitcher, useI18n } from "@/lib/i18n/LocaleProvider";
import { CaptchaGate, EMPTY_CAPTCHA, type CaptchaValue } from "@/components/auth/CaptchaGate";
import { SupplierDocumentsField, type PendingSupplierDocument } from "@/components/auth/SupplierDocumentsField";

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

interface OwnerDraft {
  full_name: string;
  role: string;
  ownership_percent: string;
}

const WIZARD_STEPS = [
  { key: "company", labelKey: "auth.wizard.company" as const },
  { key: "contacts", labelKey: "auth.wizard.contacts" as const },
  { key: "categories", labelKey: "auth.wizard.categories" as const },
  { key: "ownership", labelKey: "auth.wizard.ownership" as const },
  { key: "banking", labelKey: "auth.wizard.banking" as const },
  { key: "documents", labelKey: "auth.wizard.documents" as const },
  { key: "declarations", labelKey: "auth.wizard.declarations" as const },
  { key: "review", labelKey: "auth.wizard.review" as const },
] as const;

export default function SupplierRegisterPage() {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [owners, setOwners] = useState<OwnerDraft[]>([]);
  const [categories, setCategories] = useState<SupplierCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [documents, setDocuments] = useState<PendingSupplierDocument[]>([]);
  const [submittedDocuments, setSubmittedDocuments] = useState<Array<{ original_filename: string; document_type: string | null }>>([]);
  const [captcha, setCaptcha] = useState<CaptchaValue>(EMPTY_CAPTCHA);
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
    return selectedCategories.length >= 1 && documents.length > 0 && captcha.verified;
  }, [captcha.verified, documents.length, selectedCategories.length]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCategory(id: number) {
    setSelectedCategories((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
  }

  function canAdvance(index: number): boolean {
    if (index === 0) {
      return Boolean(form.company_name && form.address && form.country && (form.supplier_type === "individual" || (form.registration_number && form.tax_number)));
    }
    if (index === 1) {
      return Boolean(form.contact_name && form.contact_email && form.contact_phone && form.password.length >= 8 && form.password === form.password_confirmation);
    }
    if (index === 2) return selectedCategories.length >= 1;
    if (index === 4) return Boolean(form.bank_name && form.bank_account && form.bank_branch);
    if (index === 5) return documents.length > 0;
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.password_confirmation) {
      setError("Passwords do not match.");
      return;
    }
    if (!canAdvance(0) || !canAdvance(1) || !canAdvance(2) || !canAdvance(4) || !canAdvance(5)) {
      setError("Complete required wizard steps, including mandatory documents, before creating the account.");
      return;
    }

    setLoading(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      selectedCategories.forEach((id) => payload.append("category_ids[]", String(id)));
      documents.forEach((item) => {
        payload.append("documents[]", item.file);
        payload.append("document_types[]", item.documentType);
      });
      owners.filter((owner) => owner.full_name.trim()).forEach((owner, index) => {
        payload.append(`owners[${index}][full_name]`, owner.full_name.trim());
        if (owner.role) payload.append(`owners[${index}][role]`, owner.role);
        if (owner.ownership_percent) payload.append(`owners[${index}][ownership_percent]`, owner.ownership_percent);
      });
      if (captcha.token) payload.append("captcha_token", captcha.token);
      if (captcha.honeypot) payload.append("website_confirm", captcha.honeypot);

      const response = await supplierRegistrationApi.register(payload);
      setSuccess(response.data.message);
      setSubmittedDocuments(response.data.data.documents ?? documents.map((item) => ({
        original_filename: item.file.name,
        document_type: item.documentType,
      })));
      setForm(initialForm);
      setOwners([]);
      setSelectedCategories([]);
      setDocuments([]);
      setCaptcha(EMPTY_CAPTCHA);
      setStep(0);
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
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t("auth.supplierTitle")}</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {t("auth.supplierDescription")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <Link href="/supplier/login" className="btn-secondary text-sm">{t("auth.backSupplierLogin")}</Link>
          </div>
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
        <form onSubmit={handleSubmit} className="card space-y-6 p-6" data-testid="supplier-wizard">
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="supplier-wizard-steps">
            {WIZARD_STEPS.map((item, index) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  className={`w-full rounded-lg border px-2 py-2 text-left text-[11px] font-semibold ${
                    step === index ? "border-primary bg-primary/5 text-primary" : "border-neutral-200 text-neutral-500"
                  }`}
                >
                  {index + 1}. {t(item.labelKey)}
                </button>
              </li>
            ))}
          </ol>
          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400" data-testid="supplier-register-success">
              <p>{success}</p>
              <p className="mt-2">{t("auth.verifyEmailNext")}</p>
              {submittedDocuments.length > 0 && (
                <div className="mt-3">
                  <p className="font-semibold">{t("auth.docsReceived")}</p>
                  <ul className="mt-1 list-disc pl-5">
                    {submittedDocuments.map((doc) => (
                      <li key={doc.original_filename}>{doc.original_filename}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 0 && (
            <>
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
                  <select className="form-input" value={form.country} onChange={(e) => setField("country", e.target.value)} required>
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
                    <select className="form-input w-full" value={form.payment_terms} onChange={(e) => setField("payment_terms", e.target.value)}>
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
            </>
          )}

          {step === 1 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Primary Contact</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <input className="form-input" placeholder="Contact name" value={form.contact_name} onChange={(e) => setField("contact_name", e.target.value)} required />
                <input className="form-input" type="email" placeholder="Contact email" value={form.contact_email} onChange={(e) => setField("contact_email", e.target.value)} required />
                <input className="form-input" placeholder="Contact phone" value={form.contact_phone} onChange={(e) => setField("contact_phone", e.target.value)} required />
                <div className="grid grid-cols-2 gap-4">
                  <input className="form-input" type="password" placeholder="Password" value={form.password} onChange={(e) => setField("password", e.target.value)} required />
                  <div className="space-y-1">
                    <input className="form-input w-full" type="password" placeholder="Confirm password" value={form.password_confirmation} onChange={(e) => setField("password_confirmation", e.target.value)} required />
                    {form.password_confirmation && form.password !== form.password_confirmation && (
                      <p className="text-xs text-red-500">Passwords do not match</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Categories</h2>
                <span className="text-xs text-neutral-400">{selectedCategories.length} selected</span>
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
                        <p className="mt-1 text-xs text-neutral-500">{category.code}{category.parent_id ? " · child category" : ""}</p>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-neutral-500">Select every applicable category, including child categories.</p>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Ownership</h2>
              <p className="text-sm text-neutral-500">Add beneficial owners. You can continue with none and complete this after login.</p>
              {owners.map((owner, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-3">
                  <input className="form-input" placeholder="Full name" value={owner.full_name} onChange={(e) => setOwners((current) => current.map((row, i) => i === index ? { ...row, full_name: e.target.value } : row))} />
                  <input className="form-input" placeholder="Role" value={owner.role} onChange={(e) => setOwners((current) => current.map((row, i) => i === index ? { ...row, role: e.target.value } : row))} />
                  <input className="form-input" placeholder="% ownership" value={owner.ownership_percent} onChange={(e) => setOwners((current) => current.map((row, i) => i === index ? { ...row, ownership_percent: e.target.value } : row))} />
                </div>
              ))}
              <button type="button" className="btn-secondary text-sm" onClick={() => setOwners((current) => [...current, { full_name: "", role: "", ownership_percent: "" }])}>
                Add owner
              </button>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Banking</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <input className="form-input" placeholder="Bank name" value={form.bank_name} onChange={(e) => setField("bank_name", e.target.value)} required />
                <input className="form-input" placeholder="Bank account" value={form.bank_account} onChange={(e) => setField("bank_account", e.target.value)} required />
                <input className="form-input" placeholder="Branch / SWIFT" value={form.bank_branch} onChange={(e) => setField("bank_branch", e.target.value)} required />
              </div>
            </section>
          )}

          {step === 5 && <SupplierDocumentsField documents={documents} onChange={setDocuments} />}

          {step === 6 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Declarations</h2>
              <p className="text-sm text-neutral-600">{t("auth.wizard.declarationsHint")}</p>
            </section>
          )}

          {step === 7 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Review &amp; create account</h2>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-neutral-400">Company</dt><dd>{form.company_name || "—"}</dd></div>
                <div><dt className="text-xs text-neutral-400">Contact</dt><dd>{form.contact_email || "—"}</dd></div>
                <div><dt className="text-xs text-neutral-400">Categories</dt><dd>{selectedCategories.length}</dd></div>
                <div><dt className="text-xs text-neutral-400">Documents</dt><dd>{documents.length}</dd></div>
              </dl>
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {t("auth.verifyEmailNext")}
              </p>
              <CaptchaGate value={captcha} onChange={setCaptcha} />
            </section>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
            <button type="button" className="btn-secondary text-sm" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
              Back
            </button>
            {step < WIZARD_STEPS.length - 1 ? (
              <button
                type="button"
                className="btn-primary text-sm disabled:opacity-60"
                disabled={!canAdvance(step)}
                onClick={() => setStep((current) => Math.min(WIZARD_STEPS.length - 1, current + 1))}
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                data-testid="create-supplier-account"
                disabled={loading || !canSubmit}
                className="btn-primary text-sm disabled:opacity-60"
              >
                {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
              </button>
            )}
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
