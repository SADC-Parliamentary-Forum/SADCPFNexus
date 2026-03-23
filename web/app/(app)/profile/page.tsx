"use client";

import { useState, useEffect } from "react";
import { profileApi, profileChangeRequestApi, profileDocumentsApi, type User, type UserDocument, type ProfileDocumentType, type ProfileChangeRequest } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import DocumentsPanel from "@/components/ui/DocumentsPanel";
import { cn } from "@/lib/utils";

type Section = "info" | "documents" | "password";

const FIELD_LABELS: Record<string, string> = {
  phone: "Phone Number", bio: "Professional Summary", nationality: "Nationality",
  gender: "Gender", marital_status: "Marital Status",
  emergency_contact_name: "Emergency Contact Name",
  emergency_contact_relationship: "Emergency Contact Relationship",
  emergency_contact_phone: "Emergency Contact Phone",
  address_line1: "Address Line 1", address_line2: "Address Line 2",
  city: "City", country: "Country",
};

export default function MyProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("info");
  const [pendingRequest, setPendingRequest] = useState<ProfileChangeRequest | null>(null);
  const [requestNotes, setRequestNotes] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const { success, error: toastError } = useToast();

  // Documents state
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsUploading, setDocsUploading] = useState(false);

  // Password state
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      profileApi.get(),
      profileChangeRequestApi.get(),
    ]).then(([profileRes, crRes]) => {
      setUser(profileRes.data);
      const cr = crRes.data.data;
      if (cr && cr.status === "pending") setPendingRequest(cr);
    }).catch(() => toastError("Error", "Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

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
      success("Submitted", "Your profile update has been submitted for HR approval.");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg = ax.response?.data?.errors?.changes?.[0] ?? ax.response?.data?.message ?? "Failed to submit profile change request.";
      toastError("Error", msg);
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
      success("Cancelled", "Profile change request has been withdrawn.");
    } catch {
      toastError("Error", "Failed to cancel the request.");
    } finally {
      setCancelling(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      toastError("Mismatch", "New passwords do not match.");
      return;
    }
    setPwSaving(true);
    try {
      await profileApi.updatePassword(pwForm.current, pwForm.next, pwForm.confirm);
      success("Updated", "Password changed successfully.");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch {
      toastError("Error", "Failed to change password. Check your current password.");
    } finally {
      setPwSaving(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl mb-4">progress_activity</span>
        <p className="text-neutral-500 font-medium">Loading your profile...</p>
      </div>
    );
  }
  if (!user) {
    return <div className="p-8 text-center text-red-500">Error loading profile.</div>;
  }

  const initials = user.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: "info",      label: "Profile Info",    icon: "person" },
    { id: "documents", label: "My Documents",    icon: "folder_open" },
    { id: "password",  label: "Change Password", icon: "lock" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">My Profile</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage your personal information, documents and security settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Avatar Card */}
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
            <div className="h-24 bg-gradient-to-r from-primary/10 to-blue-50" />
            <div className="px-6 pb-6 text-center">
              <div className="relative -mt-12 mb-4 mx-auto w-24 h-24 rounded-full border-4 border-white bg-primary text-white flex items-center justify-center text-3xl font-bold shadow-lg shadow-primary/10">
                {initials}
              </div>
              <h2 className="text-xl font-bold text-neutral-900">{user.name}</h2>
              <p className="text-sm text-neutral-500">{user.email}</p>
              {user.job_title && (
                <p className="text-xs text-neutral-400 mt-1">{user.job_title}</p>
              )}
              {user.department && (
                <p className="text-xs font-semibold text-primary mt-2">{(user.department as any)?.name ?? ""}</p>
              )}
            </div>
          </div>

          {/* Nav */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-2 shadow-sm">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all mb-1 last:mb-0",
                  activeSection === item.id
                    ? "bg-primary/5 text-primary"
                    : "text-neutral-500 hover:bg-neutral-50"
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
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500 text-[18px]">hub</span>
                Portfolios
              </h3>
              <div className="flex flex-wrap gap-2">
                {user.portfolios.map(p => (
                  <div key={p.id} className="flex items-center gap-2 rounded-full px-3 py-1.5 border border-indigo-100 bg-indigo-50/50 text-indigo-700 text-xs font-medium">
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
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden min-h-[500px]">

            {/* ── Profile Info Section ──────────────────────────────────── */}
            {activeSection === "info" && (
              <form id="profile-form" onSubmit={handleUpdate} className="p-8 space-y-8 animate-in fade-in duration-300">

                {/* Personal Details */}
                <section>
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">contact_page</span>
                    Personal Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Full Name</label>
                      <input className={cn(inputCls, "bg-neutral-100 cursor-not-allowed")} value={user.name} disabled />
                      <p className="text-[10px] text-neutral-400 ml-1 italic">Contact admin to update your name.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Email Address</label>
                      <input className={cn(inputCls, "bg-neutral-100 cursor-not-allowed")} value={user.email} disabled />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Phone Number</label>
                      <input type="tel" className={inputCls} value={user.phone || ""} onChange={e => setUser({ ...user, phone: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Nationality</label>
                      <input type="text" className={inputCls} value={user.nationality || ""} onChange={e => setUser({ ...user, nationality: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Gender</label>
                      <select className={inputCls} value={user.gender || ""} onChange={e => setUser({ ...user, gender: e.target.value })}>
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Marital Status</label>
                      <select className={inputCls} value={user.marital_status || ""} onChange={e => setUser({ ...user, marital_status: e.target.value })}>
                        <option value="">Select Status</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Date of Birth</label>
                      <input type="date" className={cn(inputCls, "bg-neutral-100 cursor-not-allowed")} value={user.date_of_birth || ""} disabled />
                      <p className="text-[10px] text-neutral-400 ml-1 italic">Contact HR to update your date of birth.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Join Date</label>
                      <input type="date" className={cn(inputCls, "bg-neutral-100 cursor-not-allowed")} value={user.join_date || ""} disabled />
                      <p className="text-[10px] text-neutral-400 ml-1 italic">Contact HR to update your join date.</p>
                    </div>
                  </div>
                </section>

                {/* Address */}
                <section className="pt-8 border-t border-neutral-100">
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">home</span>
                    Residential Address
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Address Line 1</label>
                      <input type="text" placeholder="Street name and number" className={inputCls} value={user.address_line1 || ""} onChange={e => setUser({ ...user, address_line1: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Address Line 2</label>
                      <input type="text" placeholder="Unit / Apartment" className={inputCls} value={user.address_line2 || ""} onChange={e => setUser({ ...user, address_line2: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">City</label>
                      <input type="text" placeholder="Windhoek" className={inputCls} value={user.city || ""} onChange={e => setUser({ ...user, city: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Country</label>
                      <input type="text" placeholder="Namibia" className={inputCls} value={user.country || ""} onChange={e => setUser({ ...user, country: e.target.value })} />
                    </div>
                  </div>
                </section>

                {/* Emergency Contact */}
                <section className="pt-8 border-t border-neutral-100">
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">contact_emergency</span>
                    Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Contact Name</label>
                      <input type="text" placeholder="Full Name" className={inputCls} value={user.emergency_contact_name || ""} onChange={e => setUser({ ...user, emergency_contact_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Relationship</label>
                      <input type="text" placeholder="e.g. Spouse" className={inputCls} value={user.emergency_contact_relationship || ""} onChange={e => setUser({ ...user, emergency_contact_relationship: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Contact Phone</label>
                      <input type="tel" placeholder="+264..." className={inputCls} value={user.emergency_contact_phone || ""} onChange={e => setUser({ ...user, emergency_contact_phone: e.target.value })} />
                    </div>
                  </div>
                </section>

                {/* Bio */}
                <section className="pt-8 border-t border-neutral-100">
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">description</span>
                    Professional Summary
                  </h3>
                  <textarea
                    rows={4}
                    className={cn(inputCls, "resize-none")}
                    value={user.bio || ""}
                    onChange={e => setUser({ ...user, bio: e.target.value })}
                    placeholder="Brief overview of your background and expertise..."
                  />
                </section>

                {/* Pending request banner */}
              {pendingRequest && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-500 text-[22px] flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>pending_actions</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800">Profile update pending HR approval</p>
                    <p className="text-xs text-amber-600 mt-0.5">Submitted {new Date(pendingRequest.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. Your current profile remains unchanged until approved.</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.keys(pendingRequest.requested_changes).map(f => (
                        <span key={f} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">{FIELD_LABELS[f] ?? f}</span>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={handleCancelRequest} disabled={cancelling}
                    className="text-xs font-semibold text-red-500 hover:underline flex-shrink-0">
                    {cancelling ? "Withdrawing…" : "Withdraw"}
                  </button>
                </div>
              )}

              {/* Optional note to HR */}
              <section className="pt-6 border-t border-neutral-100">
                <label className="text-sm font-bold text-neutral-700 flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[18px] text-neutral-400">note_add</span>
                  Note to HR <span className="font-normal text-neutral-400">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  className={cn(inputCls, "resize-none")}
                  value={requestNotes}
                  onChange={e => setRequestNotes(e.target.value)}
                  placeholder="Explain why you are requesting these changes (e.g. name change, address update)…"
                />
              </section>

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-neutral-100">
                <p className="text-xs text-neutral-400 italic">Changes are submitted to HR for approval before taking effect.</p>
                <button type="submit" disabled={saving || !!pendingRequest} className="btn-primary disabled:opacity-60">
                  {saving ? (
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  )}
                  {saving ? "Submitting…" : pendingRequest ? "Request Pending" : "Submit for Approval"}
                </button>
              </div>
              </form>
            )}

            {/* ── Documents Section ─────────────────────────────────────── */}
            {activeSection === "documents" && (
              <div className="p-8 animate-in fade-in duration-300">
                <h3 className="text-lg font-bold text-neutral-900 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">folder_open</span>
                  My Documents
                </h3>
                <p className="text-sm text-neutral-500 mb-6">Upload and manage your personal HR documents, qualifications, and certifications.</p>
                <DocumentsPanel
                  documents={documents}
                  loading={docsLoading}
                  uploading={docsUploading}
                  onUpload={async (file, type, title) => {
                    setDocsUploading(true);
                    try {
                      const res = await profileDocumentsApi.upload(file, type as ProfileDocumentType, title);
                      setDocuments(prev => [(res.data as any).data, ...prev]);
                      success("Uploaded", "Document uploaded successfully.");
                    } catch {
                      toastError("Upload Failed", "Could not upload document.");
                    } finally {
                      setDocsUploading(false);
                    }
                  }}
                  onDelete={async (docId) => {
                    await profileDocumentsApi.delete(docId);
                    setDocuments(prev => prev.filter(d => d.id !== docId));
                    success("Deleted", "Document removed.");
                  }}
                  getDownloadUrl={(docId) => profileDocumentsApi.downloadUrl(docId)}
                />
              </div>
            )}

            {/* ── Change Password Section ───────────────────────────────── */}
            {activeSection === "password" && (
              <form onSubmit={handlePasswordChange} className="p-8 space-y-8 animate-in fade-in duration-300">
                <section>
                  <h3 className="text-lg font-bold text-neutral-900 mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">lock</span>
                    Change Password
                  </h3>
                  <p className="text-sm text-neutral-500 mb-6">Choose a strong password that you don't use elsewhere.</p>

                  <div className="max-w-md space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Current Password</label>
                      <input
                        type="password"
                        className={inputCls}
                        value={pwForm.current}
                        onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">New Password</label>
                      <input
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
                      <label className="text-sm font-bold text-neutral-700 ml-1">Confirm New Password</label>
                      <input
                        type="password"
                        className={inputCls}
                        value={pwForm.confirm}
                        onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                        required
                        autoComplete="new-password"
                        minLength={8}
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700 space-y-1">
                      <p className="font-bold">Password requirements:</p>
                      <ul className="list-disc ml-4 space-y-0.5">
                        <li>At least 8 characters</li>
                        <li>Mix of uppercase and lowercase letters</li>
                        <li>At least one number or special character</li>
                      </ul>
                    </div>

                    <button type="submit" disabled={pwSaving} className="btn-primary w-full disabled:opacity-60">
                      {pwSaving ? (
                        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                      )}
                      {pwSaving ? "Updating..." : "Update Password"}
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
