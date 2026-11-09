"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { profileApi, profileChangeRequestApi, profileDocumentsApi, type User, type UserDocument, type ProfileDocumentType, type ProfileChangeRequest } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import DocumentsPanel from "@/components/ui/DocumentsPanel";
import { cn } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { readStoredUser } from "@/lib/session";
import { isSupplierUser } from "@/lib/postAuthDestination";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Section = "info" | "documents" | "password";

const FIELD_LABELS: Record<string, string> = {
  phone: "profile.field.phone", bio: "profile.field.bio", nationality: "profile.field.nationality",
  gender: "profile.field.gender", marital_status: "profile.field.maritalStatus",
  emergency_contact_name: "profile.field.emergencyName",
  emergency_contact_relationship: "profile.field.emergencyRelationship",
  emergency_contact_phone: "profile.field.emergencyPhone",
  address_line1: "profile.field.address1", address_line2: "profile.field.address2",
  city: "profile.field.city", country: "profile.field.country",
};

export default function MyProfilePage() {
  const { t, localeTag } = useI18n();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("info");
  const [pendingRequest, setPendingRequest] = useState<ProfileChangeRequest | null>(null);
  const [requestNotes, setRequestNotes] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const { success, error: toastError } = useToast();
  const [supplierRedirect, setSupplierRedirect] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsUploading, setDocsUploading] = useState(false);

  // Password state
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  useLayoutEffect(() => {
    if (!isSupplierUser(readStoredUser())) return;
    setSupplierRedirect(true);
    router.replace("/supplier/profile");
  }, [router]);

  useEffect(() => {
    if (isSupplierUser(readStoredUser())) return;
    Promise.all([
      profileApi.get(),
      profileChangeRequestApi.get(),
    ]).then(([profileRes, crRes]) => {
      setUser(profileRes.data);
      const cr = crRes.data.data;
      if (cr && cr.status === "pending") setPendingRequest(cr);
    }).catch(() => toastError(t("profile.error"), t("profile.loadFailed")))
      .finally(() => setLoading(false));
  }, [toastError]);

  // Load documents when the documents section is first opened
  useEffect(() => {
    if (activeSection !== "documents" || documents.length > 0 || docsLoading) return;
    setDocsLoading(true);
    profileDocumentsApi.list()
      .then(res => setDocuments((res.data as any).data ?? []))
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  }, [activeSection, documents.length, docsLoading]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const res = await profileChangeRequestApi.submit({
        phone: user.phone,
        bio: user.bio,
        gender: user.gender,
        nationality: user.nationality,
        marital_status: user.marital_status,
        emergency_contact_name: user.emergency_contact_name,
        emergency_contact_relationship: user.emergency_contact_relationship,
        emergency_contact_phone: user.emergency_contact_phone,
        address_line1: user.address_line1,
        address_line2: user.address_line2,
        city: user.city,
        country: user.country,
        notes: requestNotes || undefined,
      });
      setPendingRequest(res.data.data);
      setRequestNotes("");
      success(t("profile.submittedTitle"), t("profile.submittedBody"));
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg = ax.response?.data?.errors?.changes?.[0] ?? ax.response?.data?.message ?? t("profile.submitFailed");
      toastError(t("profile.error"), msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!pendingRequest) return;
    setCancelling(true);
    try {
      await profileChangeRequestApi.cancel(pendingRequest.id);
      setPendingRequest(null);
      success(t("profile.cancelledTitle"), t("profile.cancelledBody"));
    } catch {
      toastError(t("profile.error"), t("profile.cancelFailed"));
    } finally {
      setCancelling(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      toastError(t("profile.mismatchTitle"), t("profile.mismatchBody"));
      return;
    }
    setPwSaving(true);
    try {
      await profileApi.updatePassword(pwForm.current, pwForm.next, pwForm.confirm);
      success(t("profile.passwordUpdatedTitle"), t("profile.passwordUpdatedBody"));
      setPwForm({ current: "", next: "", confirm: "" });
    } catch {
      toastError(t("profile.error"), t("profile.passwordFailed"));
    } finally {
      setPwSaving(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-white/5 text-neutral-900 dark:text-neutral-100 focus:bg-white dark:focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm";

  if (supplierRedirect) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl mb-4">progress_activity</span>
        <p className="text-neutral-500 dark:text-neutral-400 font-medium">{t("profile.openingSupplier")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl mb-4">progress_activity</span>
        <p className="text-neutral-500 dark:text-neutral-400 font-medium">{t("profile.loading")}</p>
      </div>
    );
  }
  if (!user) {
    return <div className="p-8 text-center text-red-500 dark:text-red-400">{t("profile.loadError")}</div>;
  }

  const initials = user.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: "info",      label: t("profile.nav.info"),      icon: "person" },
    { id: "documents", label: t("profile.nav.documents"), icon: "folder_open" },
    { id: "password",  label: t("profile.nav.password"),  icon: "lock" },
  ];

  return (
    <div className="w-full min-w-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <ModulePageHeader
        title="profile.title"
        subtitle="profile.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "profile.title" }]} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Avatar Card */}
          <div className="bg-white dark:bg-[var(--dk-bg-surface)] rounded-3xl border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
            <div className="h-24 bg-gradient-to-r from-primary/10 to-blue-50 dark:from-primary/20 dark:to-blue-900/20" />
            <div className="px-6 pb-6 text-center">
              <div className="relative -mt-12 mb-4 mx-auto w-24 h-24 rounded-full border-4 border-white dark:border-[var(--dk-bg-surface)] bg-primary text-white flex items-center justify-center text-3xl font-bold shadow-lg shadow-primary/10">
                {initials}
              </div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{user.name}</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{user.email}</p>
              {user.job_title && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{user.job_title}</p>
              )}
              {user.department && (
                <p className="text-xs font-semibold text-primary mt-2">{(user.department as any)?.name ?? ""}</p>
              )}
            </div>
          </div>

          {/* Nav */}
          <div className="bg-white dark:bg-[var(--dk-bg-surface)] rounded-2xl border border-neutral-200 dark:border-neutral-700 p-2 shadow-sm">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all mb-1 last:mb-0",
                  activeSection === item.id
                    ? "bg-primary/5 text-primary"
                    : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/5"
                )}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
                {activeSection === item.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>

          {/* Portfolios */}
          {user.portfolios && user.portfolios.length > 0 && (
            <div className="bg-white dark:bg-[var(--dk-bg-surface)] rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500 text-[18px]">hub</span>
                {t("profile.portfolios")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {user.portfolios.map(p => (
                  <div key={p.id} className="flex items-center gap-2 rounded-full px-3 py-1.5 border border-indigo-100 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                    <div className="size-2 rounded-full" style={{ backgroundColor: p.color || "#ccc" }} />
                    {p.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-[var(--dk-bg-surface)] rounded-3xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden min-h-[500px]">

            {/* ── Profile Info Section ──────────────────────────────────── */}
            {activeSection === "info" && (
              <form id="profile-form" onSubmit={handleUpdate} className="p-8 space-y-8 animate-in fade-in duration-300">

                {/* Personal Details */}
                <section>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">contact_page</span>
                    {t("profile.personalDetails")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="profile-full-name" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.fullName")}</label>
                      <input id="profile-full-name" className={cn(inputCls, "bg-neutral-100 dark:bg-white/10 cursor-not-allowed")} value={user.name} disabled />
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-1 italic">{t("profile.nameHint")}</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-email-address" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.email")}</label>
                      <input id="profile-email-address" className={cn(inputCls, "bg-neutral-100 dark:bg-white/10 cursor-not-allowed")} value={user.email} disabled />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-phone-number" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.field.phone")}</label>
                      <input id="profile-phone-number" type="tel" className={inputCls} value={user.phone || ""} onChange={e => setUser({ ...user, phone: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-nationality" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.field.nationality")}</label>
                      <input id="profile-nationality" type="text" className={inputCls} value={user.nationality || ""} onChange={e => setUser({ ...user, nationality: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-gender" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.field.gender")}</label>
                      <select id="profile-gender" className={inputCls} value={user.gender || ""} onChange={e => setUser({ ...user, gender: e.target.value })}>
                        <option value="">{t("profile.selectGender")}</option>
                        <option value="Male">{t("profile.gender.male")}</option>
                        <option value="Female">{t("profile.gender.female")}</option>
                        <option value="Other">{t("profile.gender.other")}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-marital-status" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.field.maritalStatus")}</label>
                      <select id="profile-marital-status" className={inputCls} value={user.marital_status || ""} onChange={e => setUser({ ...user, marital_status: e.target.value })}>
                        <option value="">{t("profile.selectStatus")}</option>
                        <option value="Single">{t("profile.marital.single")}</option>
                        <option value="Married">{t("profile.marital.married")}</option>
                        <option value="Divorced">{t("profile.marital.divorced")}</option>
                        <option value="Widowed">{t("profile.marital.widowed")}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-date-of-birth" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.dob")}</label>
                      <input id="profile-date-of-birth" type="date" className={cn(inputCls, "bg-neutral-100 dark:bg-white/10 cursor-not-allowed")} value={user.date_of_birth || ""} disabled />
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-1 italic">{t("profile.dobHint")}</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-join-date" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.joinDate")}</label>
                      <input id="profile-join-date" type="date" className={cn(inputCls, "bg-neutral-100 dark:bg-white/10 cursor-not-allowed")} value={user.join_date || ""} disabled />
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-1 italic">{t("profile.joinDateHint")}</p>
                    </div>
                  </div>
                </section>

                {/* Address */}
                <section className="pt-8 border-t border-neutral-100 dark:border-neutral-700/50">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">home</span>
                    {t("profile.address")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 space-y-2">
                      <label htmlFor="profile-address-line-1" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.field.address1")}</label>
                      <input id="profile-address-line-1" type="text" placeholder={t("profile.address1Placeholder")} className={inputCls} value={user.address_line1 || ""} onChange={e => setUser({ ...user, address_line1: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-address-line-2" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.field.address2")}</label>
                      <input id="profile-address-line-2" type="text" placeholder={t("profile.address2Placeholder")} className={inputCls} value={user.address_line2 || ""} onChange={e => setUser({ ...user, address_line2: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-city" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.field.city")}</label>
                      <input id="profile-city" type="text" placeholder={t("profile.cityPlaceholder")} className={inputCls} value={user.city || ""} onChange={e => setUser({ ...user, city: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-country" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.field.country")}</label>
                      <input id="profile-country" type="text" placeholder={t("profile.countryPlaceholder")} className={inputCls} value={user.country || ""} onChange={e => setUser({ ...user, country: e.target.value })} />
                    </div>
                  </div>
                </section>

                {/* Emergency Contact */}
                <section className="pt-8 border-t border-neutral-100 dark:border-neutral-700/50">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">contact_emergency</span>
                    {t("profile.emergency")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="profile-contact-name" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.contactName")}</label>
                      <input id="profile-contact-name" type="text" placeholder={t("profile.fullName")} className={inputCls} value={user.emergency_contact_name || ""} onChange={e => setUser({ ...user, emergency_contact_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-relationship" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.relationship")}</label>
                      <input id="profile-relationship" type="text" placeholder={t("profile.relationshipPlaceholder")} className={inputCls} value={user.emergency_contact_relationship || ""} onChange={e => setUser({ ...user, emergency_contact_relationship: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-contact-phone" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.contactPhone")}</label>
                      <input id="profile-contact-phone" type="tel" placeholder="+264..." className={inputCls} value={user.emergency_contact_phone || ""} onChange={e => setUser({ ...user, emergency_contact_phone: e.target.value })} />
                    </div>
                  </div>
                </section>

                {/* Bio */}
                <section className="pt-8 border-t border-neutral-100 dark:border-neutral-700/50">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">description</span>
                    {t("profile.field.bio")}
                  </h3>
                  <textarea
                    rows={4}
                    className={cn(inputCls, "resize-none")}
                    value={user.bio || ""}
                    onChange={e => setUser({ ...user, bio: e.target.value })}
                    placeholder={t("profile.bioPlaceholder")}
                  />
                </section>

                {/* Pending request banner */}
              {pendingRequest && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-4 flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-500 dark:text-amber-400 text-[22px] flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>pending_actions</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{t("profile.pendingTitle")}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{t("profile.pendingBody", { date: new Date(pendingRequest.created_at).toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" }) })}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.keys(pendingRequest.requested_changes).map(f => (
                        <span key={f} className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">{FIELD_LABELS[f] ? t(FIELD_LABELS[f]) : f}</span>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={handleCancelRequest} disabled={cancelling}
                    className="btn-secondary text-xs py-1 px-2 flex-shrink-0 text-red-600">
                    {cancelling ? t("profile.withdrawing") : t("profile.withdraw")}
                  </button>
                </div>
              )}

              {/* Optional note to HR */}
              <section className="pt-6 border-t border-neutral-100 dark:border-neutral-700/50">
                <label htmlFor="profile-note-add-note-to-hr-optional" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[18px] text-neutral-400 dark:text-neutral-500">note_add</span>
                  {t("profile.noteToHr")} <span className="font-normal text-neutral-400 dark:text-neutral-500">{t("profile.optional")}</span>
                </label>
                <textarea id="profile-note-add-note-to-hr-optional"
                  rows={2}
                  className={cn(inputCls, "resize-none")}
                  value={requestNotes}
                  onChange={e => setRequestNotes(e.target.value)}
                  placeholder={t("profile.notePlaceholder")}
                />
              </section>

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-700/50">
                <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">{t("profile.changesHint")}</p>
                <button type="submit" disabled={saving || !!pendingRequest} className="btn-primary disabled:opacity-60">
                  {saving ? (
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  )}
                  {saving ? t("hr.incidents.new.submitting") : pendingRequest ? t("profile.requestPending") : t("hr.timesheets.submitForApproval")}
                </button>
              </div>
              </form>
            )}

            {/* ── Documents Section ─────────────────────────────────────── */}
            {activeSection === "documents" && (
              <div className="p-8 animate-in fade-in duration-300">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">folder_open</span>
                  {t("profile.nav.documents")}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">{t("profile.documentsHint")}</p>
                <DocumentsPanel
                  documents={documents}
                  loading={docsLoading}
                  uploading={docsUploading}
                  onUpload={async (file, type, title) => {
                    setDocsUploading(true);
                    try {
                      const res = await profileDocumentsApi.upload(file, type as ProfileDocumentType, title);
                      setDocuments(prev => [(res.data as any).data, ...prev]);
                      success(t("profile.uploadedTitle"), t("profile.uploadedBody"));
                    } catch {
                      toastError(t("profile.uploadFailedTitle"), t("profile.uploadFailedBody"));
                    } finally {
                      setDocsUploading(false);
                    }
                  }}
                  onDelete={async (docId) => {
                    await profileDocumentsApi.delete(docId);
                    setDocuments(prev => prev.filter(d => d.id !== docId));
                    success(t("profile.deletedTitle"), t("profile.deletedBody"));
                  }}
                  getDownloadUrl={(docId) => profileDocumentsApi.downloadUrl(docId)}
                />
              </div>
            )}

            {/* ── Change Password Section ───────────────────────────────── */}
            {activeSection === "password" && (
              <form onSubmit={handlePasswordChange} className="p-8 space-y-8 animate-in fade-in duration-300">
                <section>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">lock</span>
                    {t("profile.nav.password")}
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">{t("profile.passwordHint")}</p>

                  <div className="max-w-md space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="profile-current-password" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.currentPassword")}</label>
                      <input id="profile-current-password"
                        type="password"
                        className={inputCls}
                        value={pwForm.current}
                        onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-new-password" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.newPassword")}</label>
                      <input id="profile-new-password"
                        type="password"
                        className={inputCls}
                        value={pwForm.next}
                        onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                        required
                        autoComplete="new-password"
                        minLength={8}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-confirm-new-password" className="text-sm font-bold text-neutral-700 dark:text-neutral-300 ml-1">{t("profile.confirmPassword")}</label>
                      <input id="profile-confirm-new-password"
                        type="password"
                        className={inputCls}
                        value={pwForm.confirm}
                        onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                        required
                        autoComplete="new-password"
                        minLength={8}
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                      <p className="font-bold">{t("profile.requirements")}</p>
                      <ul className="list-disc ml-4 space-y-0.5">
                        <li>{t("profile.req.length")}</li>
                        <li>{t("profile.req.case")}</li>
                        <li>{t("profile.req.number")}</li>
                      </ul>
                    </div>

                    <button type="submit" disabled={pwSaving} className="btn-primary w-full disabled:opacity-60">
                      {pwSaving ? (
                        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                      )}
                      {pwSaving ? t("profile.updating") : t("profile.updatePassword")}
                    </button>
                  </div>
                </section>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
