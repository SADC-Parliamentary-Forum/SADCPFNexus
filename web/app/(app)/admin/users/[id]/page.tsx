"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  adminApi,
  positionsApi,
  adminUserDocumentsApi,
  type User,
  type Department,
  type Portfolio,
  type Role,
  type Position,
  type UserDocument,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import DocumentsPanel from "@/components/ui/DocumentsPanel";

const CLASSIFICATIONS = ["UNCLASSIFIED", "RESTRICTED", "CONFIDENTIAL", "SECRET"];

interface FormState {
  name: string;
  email: string;
  employee_number: string;
  job_title: string;
  department_id: string;
  position_id: string;
  portfolio_ids: number[];
  phone: string;
  gender: string;
  join_date: string;
  date_of_birth: string;
  nationality: string;
  marital_status: string;
  address_line1: string;
  address_line2: string;
  city: string;
  country: string;
  bio: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_phone: string;
  role: string;
  is_active: boolean;
  classification: string;
  mfa_enabled: boolean;
}

const DEFAULT_FORM: FormState = {
  name: "", email: "", employee_number: "", job_title: "",
  department_id: "", position_id: "", portfolio_ids: [],
  phone: "", gender: "", join_date: "", date_of_birth: "",
  nationality: "", marital_status: "",
  address_line1: "", address_line2: "", city: "", country: "",
  bio: "",
  emergency_contact_name: "", emergency_contact_relationship: "", emergency_contact_phone: "",
  role: "Staff", is_active: true, classification: "UNCLASSIFIED", mfa_enabled: true,
};

function ChangePasswordSection({ userId }: { userId: number }) {
  const { success, error: toastError } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const strength = (p: string) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const score = strength(newPassword);
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][score];
  const strengthColor = ["", "bg-red-500", "bg-amber-400", "bg-blue-400", "bg-green-500"][score];

  const handleSubmit = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toastError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toastError("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await adminApi.changeUserPassword(userId, newPassword, confirmPassword);
      success("Password changed successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      console.error("[ChangePassword]", err);
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string };
      const msg = ax.response?.data?.message
        ?? (ax.response?.data?.errors && Object.values(ax.response.data.errors).flat()[0])
        ?? ax.message
        ?? "Failed to change password.";
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="pt-8 border-t border-neutral-100">
      <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">key</span>
        Change Password
      </h3>
      <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-5">
        <p className="text-sm text-neutral-500">
          Set a new password for this user. They will be required to use this password on their next login.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowNew((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[18px]">{showNew ? "visibility_off" : "visibility"}</span>
              </button>
            </div>
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? strengthColor : "bg-neutral-200"}`} />
                  ))}
                </div>
                <p className={`text-[11px] font-medium ${score <= 1 ? "text-red-500" : score === 2 ? "text-amber-500" : score === 3 ? "text-blue-500" : "text-green-600"}`}>
                  {strengthLabel}
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[18px]">{showConfirm ? "visibility_off" : "visibility"}</span>
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">error</span>
                Passwords do not match
              </p>
            )}
            {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
              <p className="text-[11px] text-green-600 mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">check_circle</span>
                Passwords match
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">{saving ? "hourglass_empty" : "lock_reset"}</span>
            {saving ? "Saving…" : "Set New Password"}
          </button>
          {(newPassword || confirmPassword) && (
            <button type="button" onClick={() => { setNewPassword(""); setConfirmPassword(""); }}
              className="text-sm text-neutral-400 hover:text-neutral-600">
              Clear
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default function UserEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { confirm } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "permissions" | "activity" | "documents">("profile");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsUploading, setDocsUploading] = useState(false);

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use allSettled so a 403 on secondary data (portfolios/positions)
        // doesn't prevent the user record from loading.
        const [userResult, deptsResult, portsResult, rolesResult, posResult] = await Promise.allSettled([
          adminApi.getUser(Number(id)),
          adminApi.listDepartments(),
          adminApi.listPortfolios(),
          adminApi.listRoles(),
          positionsApi.list({ all: true }),
        ]);

        // User is the critical resource — if it fails with 403, show Access Denied
        if (userResult.status === "rejected") {
          const status = (userResult.reason as any)?.response?.status;
          if (status === 403 || status === 401) {
            setAccessDenied(true);
          } else {
            toastError("Error", "Failed to load user information.");
          }
          return;
        }

        const u: User = (userResult.value.data as any).data ?? userResult.value.data;

        if (deptsResult.status === "fulfilled") {
          setDepartments((deptsResult.value.data as any)?.data ?? deptsResult.value.data ?? []);
        }
        if (portsResult.status === "fulfilled") {
          const pd = portsResult.value.data;
          setPortfolios(Array.isArray(pd) ? pd : (pd as any)?.data ?? []);
        }
        if (rolesResult.status === "fulfilled") {
          setAvailableRoles(rolesResult.value.data?.roles ?? []);
        }
        if (posResult.status === "fulfilled") {
          setPositions((posResult.value.data as any)?.data ?? []);
        }

        const rawRole = u.roles?.[0] || "Staff";
        const roleName = String((typeof rawRole === "object" ? (rawRole as any).name : rawRole) || "Staff");
        const portfolioIds = u.portfolios?.map((p) => p.id) ?? [];

        setForm({
          name: u.name ?? "",
          email: u.email ?? "",
          employee_number: u.employee_number ?? "",
          job_title: u.job_title ?? "",
          department_id: String(u.department_id ?? ""),
          position_id: String((u as any).position_id ?? ""),
          portfolio_ids: portfolioIds,
          phone: u.phone ?? "",
          gender: u.gender ?? "",
          join_date: u.join_date ?? "",
          date_of_birth: u.date_of_birth ?? "",
          nationality: u.nationality ?? "",
          marital_status: u.marital_status ?? "",
          address_line1: u.address_line1 ?? "",
          address_line2: u.address_line2 ?? "",
          city: u.city ?? "",
          country: u.country ?? "",
          bio: u.bio ?? "",
          emergency_contact_name: u.emergency_contact_name ?? "",
          emergency_contact_relationship: u.emergency_contact_relationship ?? "",
          emergency_contact_phone: u.emergency_contact_phone ?? "",
          role: roleName,
          is_active: u.is_active ?? true,
          classification: u.classification ?? "UNCLASSIFIED",
          mfa_enabled: u.mfa_enabled ?? true,
        });
      } catch (err) {
        console.error("Failed to fetch user data:", err);
        toastError("Error", "Failed to load user information.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, toastError]);

  // Load audit logs when the activity tab is first opened
  useEffect(() => {
    if (activeTab !== "activity" || auditLogs.length > 0 || auditLoading) return;
    setAuditLoading(true);
    adminApi.getUserAudit(Number(id))
      .then((res) => {
        const logs = (res.data as any)?.data ?? (res.data as any)?.logs ?? res.data ?? [];
        setAuditLogs(Array.isArray(logs) ? logs : []);
      })
      .catch(() => setAuditLogs([]))
      .finally(() => setAuditLoading(false));
  }, [activeTab, id, auditLogs.length, auditLoading]);

  // Load documents when the documents tab is first opened
  useEffect(() => {
    if (activeTab !== "documents" || documents.length > 0 || docsLoading) return;
    setDocsLoading(true);
    adminUserDocumentsApi.list(Number(id))
      .then(res => setDocuments((res.data as any).data ?? []))
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  }, [activeTab, id, documents.length, docsLoading]);

  const set = (field: keyof FormState, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const togglePortfolio = (pid: number) => {
    const ids = form.portfolio_ids.includes(pid)
      ? form.portfolio_ids.filter((x) => x !== pid)
      : [...form.portfolio_ids, pid];
    set("portfolio_ids", ids);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateUser(Number(id), {
        name: form.name,
        email: form.email,
        employee_number: form.employee_number || undefined,
        job_title: form.job_title || undefined,
        department_id: form.department_id ? Number(form.department_id) : undefined,
        position_id: form.position_id ? Number(form.position_id) : undefined,
        portfolio_ids: form.portfolio_ids.length > 0 ? form.portfolio_ids : undefined,
        phone: form.phone || undefined,
        gender: form.gender || undefined,
        join_date: form.join_date || undefined,
        date_of_birth: form.date_of_birth || undefined,
        nationality: form.nationality || undefined,
        marital_status: form.marital_status || undefined,
        address_line1: form.address_line1 || undefined,
        address_line2: form.address_line2 || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        bio: form.bio || undefined,
        emergency_contact_name: form.emergency_contact_name || undefined,
        emergency_contact_relationship: form.emergency_contact_relationship || undefined,
        emergency_contact_phone: form.emergency_contact_phone || undefined,
        role: form.role,
        is_active: form.is_active,
        classification: form.classification,
        mfa_enabled: form.mfa_enabled,
      } as any);
      success("Success", "User updated successfully.");
      router.refresh();
    } catch {
      toastError("Update Failed", "Could not update user details.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (await confirm({
      title: "Delete User",
      message: "Are you sure? This cannot be undone.",
      variant: "danger",
    })) {
      try {
        await adminApi.deactivateUser(Number(id));
        success("Deleted", "User has been removed.");
        router.push("/admin/users");
      } catch {
        toastError("Error", "Failed to delete user.");
      }
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl mb-4">progress_activity</span>
        <p className="text-neutral-500 font-medium">Loading user details...</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="material-symbols-outlined text-5xl text-red-300">lock</span>
        <h2 className="text-xl font-bold text-neutral-800">Access Denied</h2>
        <p className="text-sm text-neutral-500">You don't have permission to view this user's profile.</p>
        <Link href="/admin/users" className="btn-secondary mt-2">Back to Users</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/users"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-neutral-200 text-neutral-500 hover:text-primary hover:border-primary transition-all shadow-sm"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 leading-tight">Edit Staff Member</h1>
            <p className="text-sm text-neutral-500">Manage profile and permissions for {form.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Delete User
          </button>
          <button
            type="submit"
            form="user-edit-form"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-all shadow-md shadow-primary/20 disabled:opacity-50"
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">save</span>
            )}
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
            <div className="h-24 bg-gradient-to-r from-primary/10 to-blue-50" />
            <div className="px-6 pb-6 text-center">
              <div className="relative -mt-12 mb-4 mx-auto w-24 h-24 rounded-full border-4 border-white bg-primary text-white flex items-center justify-center text-3xl font-bold shadow-lg shadow-primary/10">
                {form.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
              </div>
              <h2 className="text-xl font-bold text-neutral-900">{form.name || "—"}</h2>
              <p className="text-sm text-neutral-500 mb-4">{form.email}</p>
              <span className={cn(
                "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                form.is_active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              )}>
                {form.is_active ? "Active" : "Inactive"}
              </span>
              <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-center gap-2">
                <span className="badge badge-primary">{form.role}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-2 shadow-sm">
            {[
              { id: "profile", label: "Staff Profile", icon: "person" },
              { id: "security", label: "Role & Security", icon: "admin_panel_settings" },
              { id: "permissions", label: "Module Access", icon: "key" },
              { id: "documents", label: "Documents", icon: "folder_open" },
              { id: "activity", label: "System Activity", icon: "history" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all mb-1 last:mb-0",
                  activeTab === tab.id
                    ? "bg-primary/5 text-primary"
                    : "text-neutral-500 hover:bg-neutral-50"
                )}
              >
                <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                {tab.label}
                {activeTab === tab.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8">
          <form id="user-edit-form" onSubmit={handleSubmit} className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden min-h-[500px]">

            {/* ── Profile Tab ─────────────────────────────────────────────── */}
            {activeTab === "profile" && (
              <div className="p-8 space-y-8 animate-in fade-in duration-300">

                {/* General Information */}
                <section>
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">contact_page</span>
                    General Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Full Name <span className="text-red-400">*</span></label>
                      <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Email Address <span className="text-red-400">*</span></label>
                      <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Employee Number</label>
                      <input type="text" placeholder="e.g. EMP-001" value={form.employee_number} onChange={(e) => set("employee_number", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Primary Phone</label>
                      <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Date of Birth</label>
                      <input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Gender</label>
                      <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className={inputCls}>
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Nationality</label>
                      <input type="text" placeholder="e.g. Namibian" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Marital Status</label>
                      <select value={form.marital_status} onChange={(e) => set("marital_status", e.target.value)} className={inputCls}>
                        <option value="">Select…</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* Professional Details */}
                <section className="pt-8 border-t border-neutral-100">
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">business_center</span>
                    Professional Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Department</label>
                      <select value={form.department_id} onChange={(e) => set("department_id", e.target.value)} className={inputCls}>
                        <option value="">Select Department</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Establishment Position</label>
                      <select value={form.position_id} onChange={(e) => set("position_id", e.target.value)} className={inputCls}>
                        <option value="">No position assigned</option>
                        {positions
                          .filter((p) => !form.department_id || String(p.department_id) === form.department_id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.grade ? `[${p.grade}] ` : ""}{p.title}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Official Job Title</label>
                      <input type="text" placeholder="e.g. Senior Specialist" value={form.job_title} onChange={(e) => set("job_title", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Join Date</label>
                      <input type="date" value={form.join_date} onChange={(e) => set("join_date", e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  {/* Portfolios */}
                  <div className="mt-6 space-y-2">
                    <label className="text-sm font-bold text-neutral-700 ml-1">Portfolios & Committees</label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {portfolios.length === 0 && (
                        <p className="text-xs text-neutral-400 italic py-2">No portfolios defined.</p>
                      )}
                      {portfolios.map((p) => {
                        const selected = form.portfolio_ids.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => togglePortfolio(p.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-full px-4 py-2 border transition-all text-xs font-medium",
                              selected
                                ? "border-primary bg-primary/10 text-primary shadow-sm"
                                : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
                            )}
                          >
                            <div className="size-2 rounded-full" style={{ backgroundColor: (p as any).color || "#ccc" }} />
                            {p.name}
                            {selected && <span className="material-symbols-outlined text-[14px]">check</span>}
                          </button>
                        );
                      })}
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
                      <input type="text" placeholder="Street name and number" value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">City</label>
                      <input type="text" placeholder="Windhoek" value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Country</label>
                      <input type="text" placeholder="Namibia" value={form.country} onChange={(e) => set("country", e.target.value)} className={inputCls} />
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
                      <input type="text" placeholder="Full Name" value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Relationship</label>
                      <input type="text" placeholder="e.g. Spouse" value={form.emergency_contact_relationship} onChange={(e) => set("emergency_contact_relationship", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Contact Phone</label>
                      <input type="tel" placeholder="+264..." value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} className={inputCls} />
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
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    placeholder="Brief overview of staff background, expertise..."
                    className={`${inputCls} resize-none`}
                  />
                </section>
              </div>
            )}

            {/* ── Security Tab ─────────────────────────────────────────────── */}
            {activeTab === "security" && (
              <div className="p-8 space-y-8 animate-in fade-in duration-300">

                {/* Role Assignment */}
                <section>
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">badge</span>
                    System Role
                  </h3>
                  <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-4">
                    <p className="text-sm text-neutral-600 leading-relaxed">
                      System roles define high-level access patterns. A user must have exactly one primary role.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {availableRoles.map((role) => (
                        <label key={role.id} className={cn(
                          "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all",
                          form.role === role.name
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-neutral-200 bg-white hover:border-neutral-300"
                        )}>
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="role"
                              value={role.name}
                              checked={form.role === role.name}
                              onChange={() => set("role", role.name)}
                              className="w-4 h-4 text-primary focus:ring-primary"
                            />
                            <span className="text-sm font-bold text-neutral-900">{role.name}</span>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">System</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Account Status */}
                <section className="pt-8 border-t border-neutral-100">
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">verified_user</span>
                    Account Status
                  </h3>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        checked={form.is_active}
                        onChange={() => set("is_active", true)}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-900 group-hover:text-primary transition-colors">Active</span>
                        <span className="text-xs text-neutral-400">Can log in and access modules</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        checked={!form.is_active}
                        onChange={() => set("is_active", false)}
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-900 group-hover:text-red-600 transition-colors">Inactive</span>
                        <span className="text-xs text-neutral-400">Access temporarily revoked</span>
                      </div>
                    </label>
                  </div>
                </section>

                {/* Change Password */}
                <ChangePasswordSection userId={Number(id)} />

                {/* Classification & MFA */}
                <section className="pt-8 border-t border-neutral-100">
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">security</span>
                    Security Settings
                  </h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-neutral-700 ml-1">Data Classification Level</label>
                      <select value={form.classification} onChange={(e) => set("classification", e.target.value)} className={inputCls}>
                        {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <p className="text-xs text-neutral-400 ml-1">Controls the sensitivity tier of data this user can access.</p>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">Multi-Factor Authentication</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Require MFA on every login</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => set("mfa_enabled", !form.mfa_enabled)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          form.mfa_enabled ? "bg-primary" : "bg-neutral-200"
                        )}
                      >
                        <span className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                          form.mfa_enabled ? "translate-x-6" : "translate-x-1"
                        )} />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* ── Permissions Tab ─────────────────────────────────────────── */}
            {activeTab === "permissions" && (
              <div className="p-20 text-center space-y-4">
                <span className="material-symbols-outlined text-5xl text-neutral-200">lock_open</span>
                <h3 className="text-xl font-bold text-neutral-900">Module Access Level</h3>
                <p className="max-w-md mx-auto text-neutral-500 text-sm leading-relaxed">
                  Advanced module-specific permissions are coming in the next update. Currently, permissions are inherited from the assigned <strong>{form.role}</strong> role.
                </p>
                <div className="flex justify-center mt-6">
                  <Link href="/admin/roles" className="text-primary font-semibold hover:underline flex items-center gap-2">
                    Manage Role Base Permissions
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  </Link>
                </div>
              </div>
            )}

            {/* ── Documents Tab ──────────────────────────────────────────── */}
            {activeTab === "documents" && (
              <div className="p-8 animate-in fade-in duration-300">
                <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">folder_open</span>
                  Staff Documents
                </h3>
                <DocumentsPanel
                  documents={documents}
                  loading={docsLoading}
                  uploading={docsUploading}
                  onUpload={async (file, type, title) => {
                    setDocsUploading(true);
                    try {
                      const res = await adminUserDocumentsApi.upload(Number(id), file, type, title);
                      setDocuments(prev => [(res.data as any).data, ...prev]);
                      success("Uploaded", "Document uploaded successfully.");
                    } catch {
                      toastError("Upload Failed", "Could not upload document.");
                    } finally {
                      setDocsUploading(false);
                    }
                  }}
                  onDelete={async (docId) => {
                    await adminUserDocumentsApi.delete(Number(id), docId);
                    setDocuments(prev => prev.filter(d => d.id !== docId));
                    success("Deleted", "Document removed.");
                  }}
                  getDownloadUrl={(docId) => adminUserDocumentsApi.downloadUrl(Number(id), docId)}
                />
              </div>
            )}

            {/* ── Activity Tab ─────────────────────────────────────────────── */}
            {activeTab === "activity" && (
              <div className="p-8">
                <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">history</span>
                  User Engagement Trail
                </h3>

                {auditLoading && (
                  <div className="flex items-center justify-center py-12">
                    <span className="material-symbols-outlined animate-spin text-primary text-2xl mr-3">progress_activity</span>
                    <span className="text-sm text-neutral-500">Loading activity...</span>
                  </div>
                )}

                {!auditLoading && auditLogs.length === 0 && (
                  <div className="py-12 text-center text-sm text-neutral-400 italic">
                    No audit activity found for this user.
                  </div>
                )}

                {!auditLoading && auditLogs.length > 0 && (
                  <div className="space-y-3">
                    {auditLogs.map((log: any, i: number) => {
                      const ev: string = log.event ?? "";
                      const icon = ev.includes("login") ? "login"
                        : ev.includes("logout") ? "logout"
                        : ev.includes("creat") ? "add_circle"
                        : ev.includes("updat") ? "edit"
                        : ev.includes("delet") ? "delete"
                        : ev.includes("approv") ? "check_circle"
                        : ev.includes("reject") ? "cancel"
                        : "history";
                      // Turn "auth.login.success" → "Auth: Login Success"
                      const label = ev
                        .split(".")
                        .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
                        .join(": ");
                      return (
                        <div key={log.id ?? i} className="flex items-start gap-4 p-4 rounded-xl border border-neutral-100 bg-neutral-50/50">
                          <div className="p-2 rounded-lg bg-white border border-neutral-100 flex-shrink-0">
                            <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-neutral-900">{label || "System Action"}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {log.ip_address && (
                                <span className="text-xs text-neutral-400">IP: {log.ip_address}</span>
                              )}
                              {log.tags && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-[10px] font-bold uppercase tracking-wide">{log.tags}</span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-400 mt-1 uppercase tracking-tight font-medium">
                              {log.created_at
                                ? new Date(log.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
                                : "—"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
