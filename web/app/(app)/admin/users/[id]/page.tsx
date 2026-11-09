"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  adminApi,
  accessApi,
  positionsApi,
  adminUserDocumentsApi,
  type User,
  type Department,
  type Portfolio,
  type Role,
  type Position,
  type UserDocument,
  type AccessPermissionDefinition,
  type AccessCatalogueRole,
  type AccessCatalogueAssignment,
  type AccessRoleSyncRequest,
} from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { cn, formatDateShort } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/apiError";
import { invitationState, type InvitationFields } from "@/lib/userInvitation";
import DocumentsPanel from "@/components/ui/DocumentsPanel";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t } = useI18n();
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
  const strengthKey = ["", "weak", "fair", "good", "strong"][score];
  const strengthLabel = strengthKey ? t(`admin.users.detail.pw.strength.${strengthKey}`) : "";
  const strengthColor = ["", "bg-red-500", "bg-amber-400", "bg-blue-400", "bg-green-500"][score];

  const handleSubmit = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toastError(t("admin.users.detail.pw.mismatchToast"));
      return;
    }
    if (newPassword.length < 8) {
      toastError(t("admin.users.detail.pw.tooShort"));
      return;
    }
    setSaving(true);
    try {
      await adminApi.changeUserPassword(userId, newPassword, confirmPassword);
      success(t("admin.users.detail.pw.changed"));
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      console.error("[ChangePassword]", err);
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string };
      const msg = ax.response?.data?.message
        ?? (ax.response?.data?.errors && Object.values(ax.response.data.errors).flat()[0])
        ?? ax.message
        ?? t("admin.users.detail.pw.changeFailed");
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="pt-8 border-t border-neutral-100">
      <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">key</span>
        {t("admin.users.detail.pw.title")}
      </h3>
      <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-5">
        <p className="text-sm text-neutral-500">
          {t("admin.users.detail.pw.intro")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="admin-users-detail-new-password" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("admin.users.detail.pw.new")}</label>
            <div className="relative">
              <input
                id="admin-users-detail-new-password"
                type={showNew ? "text" : "password"}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder={t("admin.users.detail.pw.newPlaceholder")}
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
            <label htmlFor="admin-users-detail-confirm-password" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("admin.users.detail.pw.confirm")}</label>
            <div className="relative">
              <input
                id="admin-users-detail-confirm-password"
                type={showConfirm ? "text" : "password"}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder={t("admin.users.detail.pw.confirmPlaceholder")}
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
                {t("admin.users.detail.pw.mismatch")}
              </p>
            )}
            {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
              <p className="text-[11px] text-green-600 mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">check_circle</span>
                {t("admin.users.detail.pw.match")}
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
            {saving ? t("admin.users.detail.saving") : t("admin.users.detail.pw.submit")}
          </button>
          {(newPassword || confirmPassword) && (
            <button type="button" onClick={() => { setNewPassword(""); setConfirmPassword(""); }}
              className="text-sm text-neutral-400 hover:text-neutral-600">
              {t("admin.users.detail.pw.clear")}
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
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "permissions" | "activity" | "documents">("profile");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [roleAliases, setRoleAliases] = useState<Record<string, string[]>>({});
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [initialRoles, setInitialRoles] = useState<string[]>([]);
  const [effectivePermissions, setEffectivePermissions] = useState<string[]>([]);
  const [permissionRegistry, setPermissionRegistry] = useState<Record<string, AccessPermissionDefinition>>({});
  const [catalogueRoles, setCatalogueRoles] = useState<AccessCatalogueRole[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<AccessCatalogueAssignment[]>([]);
  const [pendingRoleSyncs, setPendingRoleSyncs] = useState<AccessRoleSyncRequest[]>([]);
  const [catalogueReason, setCatalogueReason] = useState("Assigned from user security tab");
  const [catalogueBusy, setCatalogueBusy] = useState(false);
  const viewerId = getStoredUser()?.id ?? null;
  const [positions, setPositions] = useState<Position[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [invitation, setInvitation] = useState<InvitationFields | null>(null);
  /** Set when the account has been deleted (removed): the email it held and when. */
  const [removal, setRemoval] = useState<{ email: string; at: string | null } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsUploading, setDocsUploading] = useState(false);

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use allSettled so a 403 on secondary data (portfolios/positions)
        // doesn't prevent the user record from loading.
        const [userResult, deptsResult, portsResult, rolesResult, posResult, profileResult, registryResult, catalogueResult] = await Promise.allSettled([
          adminApi.getUser(Number(id)),
          adminApi.listDepartments(),
          adminApi.listPortfolios(),
          adminApi.listRoles(),
          positionsApi.list({ all: true }),
          accessApi.userProfile(Number(id)),
          accessApi.registry(),
          accessApi.listCatalogueRoles(),
        ]);

        // User is the critical resource — if it fails with 403, show Access Denied
        if (userResult.status === "rejected") {
          const status = (userResult.reason as any)?.response?.status;
          if (status === 403 || status === 401) {
            setAccessDenied(true);
          } else {
            toastError(t("admin.users.detail.error"), t("admin.users.detail.loadFailed"));
          }
          return;
        }

        const u: User = (userResult.value.data as any).data ?? userResult.value.data;
        setInvitation({ is_active: u.is_active, account_status: u.account_status, latest_account_invitation: u.latest_account_invitation });
        setRemoval(u.account_status === "removed" ? { email: u.former_email ?? "", at: u.removed_at ?? null } : null);

        if (deptsResult.status === "fulfilled") {
          setDepartments((deptsResult.value.data as any)?.data ?? deptsResult.value.data ?? []);
        }
        if (portsResult.status === "fulfilled") {
          const pd = portsResult.value.data;
          setPortfolios(Array.isArray(pd) ? pd : (pd as any)?.data ?? []);
        }
        if (rolesResult.status === "fulfilled") {
          setAvailableRoles(rolesResult.value.data?.roles ?? []);
          setRoleAliases(rolesResult.value.data?.aliases ?? {});
        }
        if (profileResult.status === "fulfilled") {
          const profile = profileResult.value.data.data;
          setEffectivePermissions(profile.effective_permissions ?? []);
          setRoleAssignments(profile.role_assignments ?? []);
          setPendingRoleSyncs(profile.pending_role_sync_requests ?? []);
        }
        if (catalogueResult.status === "fulfilled") {
          setCatalogueRoles(catalogueResult.value.data.data ?? []);
        }
        if (registryResult.status === "fulfilled") {
          setPermissionRegistry(registryResult.value.data.data.permissions ?? {});
        }
        if (posResult.status === "fulfilled") {
          setPositions((posResult.value.data as any)?.data ?? []);
        }

        const rawRole = u.roles?.[0] || "Staff";
        const roleName = String((typeof rawRole === "object" ? (rawRole as any).name : rawRole) || "Staff");
        const roleNames = (u.roles ?? []).map((role: any) => String(typeof role === "object" ? role.name : role)).filter(Boolean);
        const normalizedRoles = roleNames.length > 0 ? roleNames : [roleName];
        setAssignedRoles(normalizedRoles);
        setInitialRoles(normalizedRoles);
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
        toastError(t("admin.users.detail.error"), t("admin.users.detail.loadFailed"));
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

  // Held roles that are neither in the list nor an alias a listed role brings with it.
  const otherRoles = assignedRoles.filter(
    (name) => !availableRoles.some((role) => role.name === name || (roleAliases[role.name] ?? []).includes(name)),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assignedRoles.length === 0) {
      toastError(t("admin.users.detail.roleRequired"), t("admin.users.detail.roleRequiredDesc"));
      setActiveTab("security");
      return;
    }
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
        is_active: form.is_active,
        classification: form.classification,
        mfa_enabled: form.mfa_enabled,
      } as any);
      if (JSON.stringify([...assignedRoles].sort()) !== JSON.stringify([...initialRoles].sort())) {
        const roleRes = await adminApi.updateUserRoles(Number(id), assignedRoles);
        setInitialRoles([...assignedRoles]);
        if (roleRes.status === 202) {
          success(t("admin.users.detail.pendingApproval"), t("admin.users.detail.roleChangePending"));
          const profile = await accessApi.userProfile(Number(id));
          setPendingRoleSyncs(profile.data.data.pending_role_sync_requests ?? []);
          setSaving(false);
          return;
        }
      }
      success(t("admin.users.detail.success"), t("admin.users.detail.updated"));
      router.refresh();
    } catch {
      toastError(t("admin.users.detail.updateFailed"), t("admin.users.detail.updateFailedDesc"));
    } finally {
      setSaving(false);
    }
  };

  const reloadAccessProfile = async () => {
    const profile = await accessApi.userProfile(Number(id));
    const data = profile.data.data;
    setEffectivePermissions(data.effective_permissions ?? []);
    setRoleAssignments(data.role_assignments ?? []);
    setPendingRoleSyncs(data.pending_role_sync_requests ?? []);
  };

  const catalogueError = (err: unknown, fallback: string) => {
    const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
    return ax.response?.data?.message
      ?? (ax.response?.data?.errors && Object.values(ax.response.data.errors).flat()[0])
      ?? fallback;
  };

  const handleAssignCatalogue = async (role: AccessCatalogueRole) => {
    const versionId = role.current_version?.id;
    if (!versionId) {
      toastError(t("admin.users.detail.unavailable"), t("admin.users.detail.noPublishedVersion", { name: role.name }));
      return;
    }
    setCatalogueBusy(true);
    try {
      await accessApi.assignRoleVersion(Number(id), versionId, {
        reason: catalogueReason.trim() || "Assigned from user security tab",
      });
      success(t("admin.users.detail.assigned"), t("admin.users.detail.assignSubmitted", { name: role.name }));
      await reloadAccessProfile();
    } catch (err) {
      toastError(t("admin.users.detail.assignFailed"), catalogueError(err, t("admin.users.detail.assignFailedDesc")));
    } finally {
      setCatalogueBusy(false);
    }
  };

  const handleApproveCatalogue = async (assignmentId: number) => {
    setCatalogueBusy(true);
    try {
      await accessApi.approveRoleAssignment(assignmentId);
      success(t("admin.users.detail.approved"), t("admin.users.detail.catalogueApproved"));
      await reloadAccessProfile();
    } catch (err) {
      toastError(t("admin.users.detail.approvalFailed"), catalogueError(err, t("admin.users.detail.approveAssignmentFailed")));
    } finally {
      setCatalogueBusy(false);
    }
  };

  const handleApproveRoleSync = async (syncId: number) => {
    setCatalogueBusy(true);
    try {
      await adminApi.approveRoleSync(syncId);
      success(t("admin.users.detail.approved"), t("admin.users.detail.roleChangeApproved"));
      await reloadAccessProfile();
    } catch (err) {
      toastError(t("admin.users.detail.approvalFailed"), catalogueError(err, t("admin.users.detail.approveRoleChangeFailed")));
    } finally {
      setCatalogueBusy(false);
    }
  };

  const handleInvite = async () => {
    if (!invitation) return;
    const resend = invitationState(invitation).kind !== "not_invited";
    setInviting(true);
    try {
      const res = await adminApi.resendUserInvitation(Number(id));
      setInvitation({ ...invitation, latest_account_invitation: res.data.user.latest_account_invitation });
      success(resend ? t("admin.users.inv.resentToast") : t("admin.users.inv.sent"), t("admin.users.inv.canRegister", { email: form.email }));
    } catch (err) {
      toastError(t("admin.users.inv.notSent"), apiErrorMessage(err, t("admin.users.inv.sendFailed")));
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async () => {
    if (await confirm({
      title: t("admin.users.detail.deactivateUser"),
      message: t("admin.users.detail.deactivateMessage"),
      confirmText: t("admin.users.deactivate"),
      variant: "danger",
    })) {
      try {
        await adminApi.deactivateUser(Number(id));
        success(t("admin.users.detail.deactivated"), t("admin.users.detail.deactivatedDesc"));
        router.push("/admin/users");
      } catch {
        toastError(t("admin.users.detail.error"), t("admin.users.detail.deactivateFailed"));
      }
    }
  };

  const handleRemove = async () => {
    const name = form.name || form.email;
    if (!(await confirm({
      title: t("admin.users.detail.deleteUser"),
      message: t("admin.users.detail.deleteMessage", { name }),
      confirmText: t("admin.users.detail.deleteConfirm"),
      variant: "danger",
    }))) return;
    try {
      await adminApi.deleteUser(Number(id));
      success(t("admin.users.detail.userDeleted"), t("admin.users.detail.userDeletedDesc", { name }));
      router.push("/admin/users");
    } catch (err) {
      toastError(t("admin.users.detail.deleteFailed"), apiErrorMessage(err, t("admin.users.detail.deleteFailed")));
    }
  };

  const handleRestore = async () => {
    try {
      const res = await adminApi.restoreUser(Number(id));
      const u = res.data.user;
      setRemoval(null);
      setInvitation((prev) => (prev ? { ...prev, is_active: u.is_active, account_status: u.account_status } : prev));
      setForm((prev) => ({ ...prev, email: u.email, is_active: u.is_active }));
      success(t("admin.users.restored"), t("admin.users.restoredDesc"));
    } catch (err) {
      toastError(t("admin.users.restoreFailed"), apiErrorMessage(err, t("admin.users.restoreFailed")));
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl mb-4">progress_activity</span>
        <p className="text-neutral-500 font-medium">{t("admin.users.detail.loading")}</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="material-symbols-outlined text-5xl text-red-300">lock</span>
        <h2 className="text-xl font-bold text-neutral-800">{t("admin.users.detail.accessDenied")}</h2>
        <p className="text-sm text-neutral-500">{t("admin.users.detail.accessDeniedDesc")}</p>
        <Link href="/admin/users" className="btn-secondary mt-2">{t("admin.users.detail.backToUsers")}</Link>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/users"
            aria-label={t("admin.users.detail.backToUsers")}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-neutral-200 text-neutral-500 hover:text-primary hover:border-primary transition-all shadow-sm"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <ModulePageHeader
        title={t("admin.users.detail.title")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.users.detail.title") }]} />}
      />
        </div>
        <div className="flex items-center gap-3">
          {removal ? (
            <button
              type="button"
              onClick={() => void handleRestore()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-200 bg-white text-green-700 text-sm font-semibold hover:bg-green-50 transition-colors shadow-sm"
              data-testid="user-restore"
            >
              <span className="material-symbols-outlined text-[18px]">restore</span>
              {t("admin.users.restore")}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">person_off</span>
                {t("admin.users.detail.deactivateUser")}
              </button>
              <button
                type="button"
                onClick={() => void handleRemove()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm"
                data-testid="user-delete"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                {t("admin.users.detail.deleteUser")}
              </button>
            </>
          )}
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
            {t("admin.users.detail.saveChanges")}
          </button>
        </div>
      </div>

      {removal && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="status" data-testid="user-removed-banner">
          {t("admin.users.detail.removedBanner", { date: removal.at ? formatDateShort(removal.at) : "—", email: removal.email || "—" })}
        </div>
      )}

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
                {form.is_active ? t("admin.common.active") : t("admin.common.inactive")}
              </span>
              <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-center gap-2">
                <span className="badge badge-primary">{form.role}</span>
              </div>
            </div>
          </div>

          {invitation && invitationState(invitation).action && (() => {
            const inv = invitationState(invitation);
            const invLabel = inv.kind === "expired"
              ? t("admin.users.inv.expired")
              : inv.kind === "sent"
                ? t("admin.users.inv.sent")
                : t("admin.users.inv.notInvited");
            const invAction = t(inv.kind === "not_invited" ? "admin.users.inv.send" : "admin.users.inv.resend");
            return (
              <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm space-y-3" data-testid="user-invitation-panel">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-neutral-900">{t("admin.users.detail.inv.title")}</h3>
                  <span className={`badge ${inv.badge}`}>{invLabel}</span>
                </div>
                <p className="text-xs text-neutral-500">
                  {inv.kind === "not_invited" && t("admin.users.detail.inv.notInvitedDesc")}
                  {inv.kind === "sent" && t("admin.users.detail.inv.sentDesc", { date: formatDateShort(inv.expiresAt) })}
                  {inv.kind === "expired" && t("admin.users.detail.inv.expiredDesc")}
                </p>
                <button
                  type="button"
                  onClick={() => void handleInvite()}
                  disabled={inviting}
                  className="btn-primary w-full justify-center text-sm py-2 flex items-center gap-2 disabled:opacity-50"
                  data-testid="user-invite-button"
                >
                  <span className="material-symbols-outlined text-[18px]">forward_to_inbox</span>
                  {inviting ? t("admin.users.detail.inv.sending") : invAction}
                </button>
              </div>
            );
          })()}

          <div className="bg-white rounded-2xl border border-neutral-200 p-2 shadow-sm">
            {[
              { id: "profile", label: "admin.users.detail.tab.profile", icon: "person" },
              { id: "security", label: "admin.users.detail.tab.security", icon: "admin_panel_settings" },
              { id: "permissions", label: "admin.users.detail.tab.permissions", icon: "key" },
              { id: "documents", label: "admin.users.detail.tab.documents", icon: "folder_open" },
              { id: "activity", label: "admin.users.detail.tab.activity", icon: "history" },
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
                {t(tab.label)}
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
                    {t("admin.users.detail.generalInfo")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-full-name" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.fullName")} <span className="text-red-500">*</span></label>
                      <input id="admin-users-detail-full-name" type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} required />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-email-address" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.email")} <span className="text-red-500">*</span></label>
                      <input id="admin-users-detail-email-address" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} required />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-employee-number" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.employeeNumber")}</label>
                      <input id="admin-users-detail-employee-number" type="text" placeholder={t("admin.users.detail.employeeNumberPlaceholder")} value={form.employee_number} onChange={(e) => set("employee_number", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-primary-phone" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.primaryPhone")}</label>
                      <input id="admin-users-detail-primary-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-date-of-birth" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.dateOfBirth")}</label>
                      <input id="admin-users-detail-date-of-birth" type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-gender" className="text-sm font-bold text-neutral-700 ml-1">{t("profile.field.gender")}</label>
                      <select id="admin-users-detail-gender" value={form.gender} onChange={(e) => set("gender", e.target.value)} className={inputCls}>
                        <option value="">{t("admin.users.detail.selectGender")}</option>
                        <option value="Male">{t("profile.gender.male")}</option>
                        <option value="Female">{t("profile.gender.female")}</option>
                        <option value="Other">{t("profile.gender.other")}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-nationality" className="text-sm font-bold text-neutral-700 ml-1">{t("profile.field.nationality")}</label>
                      <input id="admin-users-detail-nationality" type="text" placeholder={t("admin.users.detail.nationalityPlaceholder")} value={form.nationality} onChange={(e) => set("nationality", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-marital-status" className="text-sm font-bold text-neutral-700 ml-1">{t("profile.field.maritalStatus")}</label>
                      <select id="admin-users-detail-marital-status" value={form.marital_status} onChange={(e) => set("marital_status", e.target.value)} className={inputCls}>
                        <option value="">{t("admin.users.detail.selectPlaceholder")}</option>
                        <option value="Single">{t("profile.marital.single")}</option>
                        <option value="Married">{t("profile.marital.married")}</option>
                        <option value="Divorced">{t("profile.marital.divorced")}</option>
                        <option value="Widowed">{t("profile.marital.widowed")}</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* Professional Details */}
                <section className="pt-8 border-t border-neutral-100">
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">business_center</span>
                    {t("admin.users.detail.professionalDetails")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-department" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.department")}</label>
                      <select id="admin-users-detail-department" value={form.department_id} onChange={(e) => set("department_id", e.target.value)} className={inputCls}>
                        <option value="">{t("admin.users.detail.selectDepartment")}</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-establishment-position" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.position")}</label>
                      <select id="admin-users-detail-establishment-position" value={form.position_id} onChange={(e) => set("position_id", e.target.value)} className={inputCls}>
                        <option value="">{t("admin.users.detail.noPosition")}</option>
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
                      <label htmlFor="admin-users-detail-official-job-title" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.jobTitle")}</label>
                      <input id="admin-users-detail-official-job-title" type="text" placeholder={t("admin.users.detail.jobTitlePlaceholder")} value={form.job_title} onChange={(e) => set("job_title", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-join-date" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.joinDate")}</label>
                      <input id="admin-users-detail-join-date" type="date" value={form.join_date} onChange={(e) => set("join_date", e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  {/* Portfolios */}
                  <div className="mt-6 space-y-2">
                    <p className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.portfolios")}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {portfolios.length === 0 && (
                        <p className="text-xs text-neutral-400 italic py-2">{t("admin.users.detail.noPortfolios")}</p>
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
                    {t("admin.users.detail.address")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 space-y-2">
                      <label htmlFor="admin-users-detail-address-line-1" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.addressLine1")}</label>
                      <input id="admin-users-detail-address-line-1" type="text" placeholder={t("admin.users.detail.addressPlaceholder")} value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-city" className="text-sm font-bold text-neutral-700 ml-1">{t("profile.field.city")}</label>
                      <input id="admin-users-detail-city" type="text" placeholder={t("admin.users.detail.cityPlaceholder")} value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-country" className="text-sm font-bold text-neutral-700 ml-1">{t("profile.field.country")}</label>
                      <input id="admin-users-detail-country" type="text" placeholder={t("admin.users.detail.countryPlaceholder")} value={form.country} onChange={(e) => set("country", e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </section>

                {/* Emergency Contact */}
                <section className="pt-8 border-t border-neutral-100">
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">contact_emergency</span>
                    {t("admin.users.detail.emergencyContact")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-contact-name" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.contactName")}</label>
                      <input id="admin-users-detail-contact-name" type="text" placeholder={t("admin.users.detail.fullNamePlaceholder")} value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-relationship" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.relationship")}</label>
                      <input id="admin-users-detail-relationship" type="text" placeholder={t("admin.users.detail.relationshipPlaceholder")} value={form.emergency_contact_relationship} onChange={(e) => set("emergency_contact_relationship", e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-contact-phone" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.contactPhone")}</label>
                      <input id="admin-users-detail-contact-phone" type="tel" placeholder="+264..." value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </section>

                {/* Bio */}
                <section className="pt-8 border-t border-neutral-100">
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">description</span>
                    {t("profile.field.bio")}
                  </h3>
                  <textarea
                    rows={4}
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    placeholder={t("admin.users.detail.bioPlaceholder")}
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
                    {t("admin.users.detail.systemRole")}
                  </h3>
                  <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-4">
                    <p className="text-sm text-neutral-600 leading-relaxed">
                      {t("admin.users.detail.systemRoleIntro")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {availableRoles.map((role) => (
                        <label htmlFor={`admin-users-detail-role-${role.id}`} key={role.id} className={cn(
                          "cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all",
                          assignedRoles.includes(role.name)
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-neutral-200 bg-white hover:border-neutral-300"
                        )}>
                          <div className="flex items-center gap-3">
                            <input id={`admin-users-detail-role-${role.id}`} type="checkbox" name="roles" value={role.name} checked={assignedRoles.includes(role.name)} onChange={() => setAssignedRoles((current) => current.includes(role.name) ? current.filter((item) => item !== role.name) : [...current, role.name])} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                            <span className="text-sm font-bold text-neutral-900">{role.name}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                    {otherRoles.length > 0 && (
                      <p className="text-xs text-neutral-600" data-testid="user-other-roles">
                        {t(otherRoles.length === 1 ? "admin.users.detail.otherRolesOne" : "admin.users.detail.otherRolesMany", { roles: otherRoles.join(", ") })}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500">{t("admin.users.detail.selectedRoles", { count: assignedRoles.length })}</p>
                  </div>
                </section>

                {/* Published catalogue roles (e.g. Unaro) */}
                <section className="pt-8 border-t border-neutral-100">
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">workspace_premium</span>
                    {t("admin.users.detail.catalogueRoles")}
                  </h3>
                  <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-4">
                    <p className="text-sm text-neutral-600 leading-relaxed">
                      {t("admin.users.detail.catalogueIntro")}
                    </p>
                    <div className="space-y-2">
                      <label htmlFor="user-catalogue-role-reason" className="text-sm font-bold text-neutral-700 ml-1">
                        {t("admin.users.detail.assignmentReason")}
                      </label>
                      <input
                        id="user-catalogue-role-reason"
                        type="text"
                        value={catalogueReason}
                        onChange={(e) => setCatalogueReason(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-3">
                      {catalogueRoles
                        .filter(
                          (role) =>
                            role.status === "active" &&
                            role.current_version &&
                            !availableRoles.some((sys) => sys.name === role.name),
                        )
                        .map((role) => {
                          const version = role.current_version!;
                          const assignment = roleAssignments.find(
                            (item) =>
                              item.role_version?.catalogue?.id === role.id &&
                              (item.status === "active" || item.status === "pending_approval"),
                          );
                          return (
                            <div
                              key={role.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4"
                            >
                              <div>
                                <p className="text-sm font-bold text-neutral-900">{role.name}</p>
                                <p className="text-xs text-neutral-500">
                                  {assignment
                                    ? t("admin.users.detail.statusLine", { status: assignment.status.replaceAll("_", " ") })
                                    : t("admin.users.detail.versionLine", { version: version.version, risk: role.risk_level ?? "medium" })}
                                </p>
                              </div>
                              {!assignment ? (
                                <button
                                  type="button"
                                  disabled={catalogueBusy}
                                  onClick={() => handleAssignCatalogue(role)}
                                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                                >
                                  {catalogueBusy ? t("admin.users.detail.assigning") : t("admin.users.detail.assign")}
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                  {assignment.status === "active" ? t("admin.users.detail.assigned") : t("admin.users.detail.pendingApproval")}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    {(roleAssignments.some((item) => item.status === "pending_approval") ||
                      pendingRoleSyncs.length > 0) && (
                      <div className="space-y-3 pt-2">
                        <h4 className="text-sm font-bold text-neutral-900">{t("admin.users.detail.pendingSecondAdmin")}</h4>
                        {roleAssignments
                          .filter((item) => item.status === "pending_approval")
                          .map((item) => {
                            const canApprove = viewerId != null && viewerId !== item.requested_by;
                            return (
                              <div
                                key={`cat-${item.id}`}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
                              >
                                <div>
                                  <p className="text-sm font-bold text-neutral-900">
                                    {item.role_version?.catalogue?.name ?? t("admin.users.detail.catalogueRole")}
                                  </p>
                                  <p className="text-xs text-neutral-500">{t("admin.users.detail.requestedBy", { id: item.requested_by ?? "" })}</p>
                                </div>
                                {canApprove ? (
                                  <button
                                    type="button"
                                    disabled={catalogueBusy}
                                    onClick={() => handleApproveCatalogue(item.id)}
                                    className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                                  >
                                    {catalogueBusy ? t("admin.users.detail.approving") : t("common.approve")}
                                  </button>
                                ) : (
                                  <p className="text-sm text-neutral-500">{t("admin.users.detail.waitingSecondAdmin")}</p>
                                )}
                              </div>
                            );
                          })}
                        {pendingRoleSyncs.map((item) => {
                          const canApprove = viewerId != null && viewerId !== item.requested_by;
                          return (
                            <div
                              key={`sync-${item.id}`}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
                            >
                              <div>
                                <p className="text-sm font-bold text-neutral-900">
                                  {item.roles?.length
                                    ? t("admin.users.detail.roleChangeWithRoles", { roles: item.roles.join(", ") })
                                    : t("admin.users.detail.roleChange")}
                                </p>
                                <p className="text-xs text-neutral-500">{t("admin.users.detail.requestedBy", { id: item.requested_by ?? "" })}</p>
                              </div>
                              {canApprove ? (
                                <button
                                  type="button"
                                  disabled={catalogueBusy}
                                  onClick={() => handleApproveRoleSync(item.id)}
                                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                                >
                                  {catalogueBusy ? t("admin.users.detail.approving") : t("common.approve")}
                                </button>
                              ) : (
                                <p className="text-sm text-neutral-500">{t("admin.users.detail.waitingSecondAdmin")}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>

                {/* Account Status */}
                <section className="pt-8 border-t border-neutral-100">
                  <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">verified_user</span>
                    {t("admin.users.detail.accountStatus")}
                  </h3>
                  <div className="flex items-center gap-6">
                    <label htmlFor="admin-users-detail-set-is-active-true-classname-w-4-h-4-text-primar" className="flex items-center gap-3 cursor-pointer group">
                      <input id="admin-users-detail-set-is-active-true-classname-w-4-h-4-text-primar"
                        type="radio"
                        checked={form.is_active}
                        onChange={() => set("is_active", true)}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-900 group-hover:text-primary transition-colors">{t("admin.common.active")}</span>
                        <span className="text-xs text-neutral-400">{t("admin.users.detail.activeDesc")}</span>
                      </div>
                    </label>
                    <label htmlFor="admin-users-detail-set-is-active-false-classname-w-4-h-4-text-red-6" className="flex items-center gap-3 cursor-pointer group">
                      <input id="admin-users-detail-set-is-active-false-classname-w-4-h-4-text-red-6"
                        type="radio"
                        checked={!form.is_active}
                        onChange={() => set("is_active", false)}
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-900 group-hover:text-red-600 transition-colors">{t("admin.common.inactive")}</span>
                        <span className="text-xs text-neutral-400">{t("admin.users.detail.inactiveDesc")}</span>
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
                    {t("admin.users.detail.securitySettings")}
                  </h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label htmlFor="admin-users-detail-data-classification-level" className="text-sm font-bold text-neutral-700 ml-1">{t("admin.users.detail.classificationLevel")}</label>
                      <select id="admin-users-detail-data-classification-level" value={form.classification} onChange={(e) => set("classification", e.target.value)} className={inputCls}>
                        {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <p className="text-xs text-neutral-400 ml-1">{t("admin.users.detail.classificationHint")}</p>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{t("admin.users.detail.mfa")}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{t("admin.users.detail.mfaDesc")}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => set("mfa_enabled", !form.mfa_enabled)}
                        role="switch"
                        aria-checked={form.mfa_enabled}
                        aria-label={t("admin.users.detail.mfa")}
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
              <div className="p-8 space-y-5">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><span className="material-symbols-outlined text-primary">lock_open</span>{t("admin.users.detail.effectiveAccess")}</h3><p className="mt-1 text-sm text-neutral-500">{t("admin.users.detail.effectiveAccessDesc")}</p></div><Link href="/admin/access/roles" className="btn-secondary text-xs">{t("admin.users.detail.manageRoles")}</Link></div>
                {effectivePermissions.length === 0 ? <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-500">{t("admin.users.detail.noPermissions")}</p> : <div className="grid gap-3 md:grid-cols-2">{Object.entries(effectivePermissions.reduce<Record<string, string[]>>((groups, permission) => { const meta = permissionRegistry[permission]; const group = meta ? `${meta.module} / ${meta.feature}` : permission.split(".").slice(0, 2).join(" / "); (groups[group] ??= []).push(meta?.display_name || permission); return groups; }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => <div key={group} className="rounded-xl border border-neutral-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{group}</p><div className="mt-2 flex flex-wrap gap-1.5">{items.map((item) => <span key={item} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{item}</span>)}</div></div>)}</div>}
                <p className="text-xs text-neutral-500">{t("admin.users.detail.permissionsFooter")}</p>
              </div>
            )}

            {/* ── Documents Tab ──────────────────────────────────────────── */}
            {activeTab === "documents" && (
              <div className="p-8 animate-in fade-in duration-300">
                <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">folder_open</span>
                  {t("admin.users.detail.staffDocuments")}
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
                      success(t("admin.users.detail.uploaded"), t("admin.users.detail.uploadedDesc"));
                    } catch {
                      toastError(t("admin.users.detail.uploadFailed"), t("admin.users.detail.uploadFailedDesc"));
                    } finally {
                      setDocsUploading(false);
                    }
                  }}
                  onDelete={async (docId) => {
                    await adminUserDocumentsApi.delete(Number(id), docId);
                    setDocuments(prev => prev.filter(d => d.id !== docId));
                    success(t("admin.users.detail.deleted"), t("admin.users.detail.deletedDesc"));
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
                  {t("admin.users.detail.activityTitle")}
                </h3>

                {auditLoading && (
                  <div className="flex items-center justify-center py-12">
                    <span className="material-symbols-outlined animate-spin text-primary text-2xl mr-3">progress_activity</span>
                    <span className="text-sm text-neutral-500">{t("admin.users.detail.loadingActivity")}</span>
                  </div>
                )}

                {!auditLoading && auditLogs.length === 0 && (
                  <div className="py-12 text-center text-sm text-neutral-400 italic">
                    {t("admin.users.detail.noActivity")}
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
                            <p className="text-sm font-semibold text-neutral-900">{label || t("admin.users.detail.systemAction")}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {log.ip_address && (
                                <span className="text-xs text-neutral-400">{t("admin.users.detail.ip", { ip: log.ip_address })}</span>
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
