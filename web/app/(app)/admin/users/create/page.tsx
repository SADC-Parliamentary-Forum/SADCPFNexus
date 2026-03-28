"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminApi, lookupsApi, positionsApi, type Department, type Role, type Portfolio, type Position } from "@/lib/api";

// ─── Module Permission Matrix ────────────────────────────────────────────────
export interface ModulePermission {
  module: string;
  icon: string;
  actions: string[];
  granted: string[];
}

const MODULE_DEFINITIONS: Omit<ModulePermission, "granted">[] = [
  { module: "Dashboard", icon: "dashboard", actions: ["view"] },
  { module: "Alerts", icon: "notifications_active", actions: ["view"] },
  { module: "Travel", icon: "flight_takeoff", actions: ["view", "create", "edit", "approve", "admin"] },
  { module: "Leave", icon: "event_available", actions: ["view", "create", "edit", "approve", "admin"] },
  { module: "Finance", icon: "payments", actions: ["view", "create", "edit", "approve", "admin"] },
  { module: "Imprest", icon: "account_balance_wallet", actions: ["view", "create", "edit", "approve", "admin"] },
  { module: "Programmes", icon: "account_tree", actions: ["view", "create", "edit", "admin"] },
  { module: "Workplan", icon: "calendar_month", actions: ["view", "create", "edit", "admin"] },
  { module: "HR", icon: "people", actions: ["view", "create", "edit", "approve", "admin"] },
  { module: "Reports", icon: "assessment", actions: ["view", "export"] },
  { module: "Assets", icon: "inventory_2", actions: ["view", "create", "edit", "admin"] },
  { module: "Governance", icon: "policy", actions: ["view", "create", "edit", "admin"] },
  { module: "SRHR", icon: "biotech", actions: ["view", "create", "edit", "admin"] },
  { module: "Admin", icon: "admin_panel_settings", actions: ["view", "users", "roles", "settings", "audit"] },
];

const ACTION_LABELS: Record<string, string> = {
  view: "View", create: "Create", edit: "Edit", approve: "Approve",
  admin: "Admin", export: "Export", users: "Manage Users",
  roles: "Manage Roles", settings: "System Settings", audit: "Audit Logs",
};

const ACTION_COLOR: Record<string, string> = {
  view: "bg-neutral-100 text-neutral-600",
  create: "bg-blue-50 text-blue-700",
  edit: "bg-amber-50 text-amber-700",
  approve: "bg-green-50 text-green-700",
  admin: "bg-red-50 text-red-700",
  export: "bg-teal-50 text-teal-700",
  users: "bg-purple-50 text-purple-700",
  roles: "bg-indigo-50 text-indigo-700",
  settings: "bg-amber-50 text-amber-700",
  audit: "bg-neutral-100 text-neutral-600",
};

// Preset role templates — auto-populate module permissions
const ROLE_PRESETS: Record<string, Record<string, string[]>> = {
  Administrator: {
    Dashboard: ["view"], Alerts: ["view"],
    Travel: ["view", "create", "edit", "approve", "admin"], Leave: ["view", "create", "edit", "approve", "admin"],
    Finance: ["view", "create", "edit", "approve", "admin"], Imprest: ["view", "create", "edit", "approve", "admin"],
    Programmes: ["view", "create", "edit", "admin"], Workplan: ["view", "create", "edit", "admin"],
    HR: ["view", "create", "edit", "approve", "admin"], Reports: ["view", "export"],
    Assets: ["view", "create", "edit", "admin"], Governance: ["view", "create", "edit", "admin"],
    SRHR: ["view", "create", "edit", "admin"],
    Admin: ["view", "users", "roles", "settings", "audit"],
  },
  "Finance Officer": {
    Dashboard: ["view"], Alerts: ["view"],
    Travel: ["view", "approve"], Leave: ["view"],
    Finance: ["view", "create", "edit", "approve"], Imprest: ["view", "create", "edit", "approve"],
    Programmes: ["view"], Workplan: ["view"],
    HR: ["view"], Reports: ["view", "export"],
    Assets: ["view"], Governance: ["view"],
    SRHR: [], Admin: [],
  },
  "HR Officer": {
    Dashboard: ["view"], Alerts: ["view"],
    Travel: ["view", "approve"], Leave: ["view", "create", "edit", "approve"],
    Finance: ["view"], Imprest: ["view"],
    Programmes: ["view"], Workplan: ["view"],
    HR: ["view", "create", "edit", "approve"], Reports: ["view", "export"],
    Assets: ["view"], Governance: ["view"],
    SRHR: [], Admin: ["view"],
  },
  Staff: {
    Dashboard: ["view"], Alerts: ["view"],
    Travel: ["view", "create"], Leave: ["view", "create"],
    Finance: ["view"], Imprest: ["view", "create"],
    Programmes: ["view"], Workplan: ["view"],
    HR: ["view"], Reports: ["view"],
    Assets: ["view"], Governance: ["view"],
    SRHR: [], Admin: [],
  },
  "Read Only": {
    Dashboard: ["view"], Alerts: ["view"],
    Travel: ["view"], Leave: ["view"],
    Finance: ["view"], Imprest: ["view"],
    Programmes: ["view"], Workplan: ["view"],
    HR: ["view"], Reports: ["view"],
    Assets: ["view"], Governance: ["view"],
    SRHR: [], Admin: [],
  },
  "SRHR Researcher": {
    Dashboard: ["view"], Alerts: ["view"],
    Travel: ["view", "create"], Leave: ["view", "create"],
    Finance: ["view"], Imprest: ["view", "create"],
    Programmes: ["view"], Workplan: ["view"],
    HR: ["view"], Reports: ["view", "export"],
    Assets: ["view"], Governance: ["view"],
    SRHR: ["view", "create", "edit"],
    Admin: [],
  },
};

function buildDefaultPermissions(): ModulePermission[] {
  return MODULE_DEFINITIONS.map((m) => ({ ...m, granted: m.module === "Dashboard" || m.module === "Alerts" ? ["view"] : [] }));
}

function applyPreset(preset: string): ModulePermission[] {
  const presetMap = ROLE_PRESETS[preset] ?? {};
  return MODULE_DEFINITIONS.map((m) => ({
    ...m,
    granted: presetMap[m.module] ?? [],
  }));
}

// ─── Steps ───────────────────────────────────────────────────────────────────
const STEPS = ["Account Basic", "Personal & Emergency", "Role & Security", "Module Permissions"];

interface FormData {
  name: string;
  email: string;
  employee_number: string;
  job_title: string;
  department_id: string;
  phone: string;
  role: string;
  classification: string;
  mfa_enabled: boolean;
  bio: string;
  date_of_birth: string;
  join_date: string;
  nationality: string;
  gender: string;
  marital_status: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  country: string;
  portfolio_ids: number[];
}

export default function AdminUserCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [classifications] = useState(["UNCLASSIFIED", "RESTRICTED", "CONFIDENTIAL", "SECRET"]);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<ModulePermission[]>(buildDefaultPermissions());
  const [form, setForm] = useState<FormData>({
    name: "", email: "", employee_number: "", job_title: "",
    department_id: "", phone: "", role: "Staff",
    classification: "UNCLASSIFIED", mfa_enabled: true,
    bio: "", date_of_birth: "", join_date: "",
    nationality: "", gender: "", marital_status: "",
    emergency_contact_name: "", emergency_contact_relationship: "", emergency_contact_phone: "",
    address_line1: "", address_line2: "", city: "", country: "",
    portfolio_ids: [],
  });
  const [positions, setPositions] = useState<Position[]>([]);
  const [isCreatingDept, setIsCreatingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [isCreatingJobTitle, setIsCreatingJobTitle] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState("");

  useEffect(() => {
    Promise.all([
      adminApi.listDepartments(),
      adminApi.listRoles(),
      adminApi.listPortfolios(),
      positionsApi.list({ all: true }),
      lookupsApi.get(["classifications"])
    ])
      .then(([deptRes, rolesRes, portRes, posRes]) => {
        setDepartments(deptRes.data.data ?? []);
        setRoles(rolesRes.data.roles ?? []);
        setPortfolios(portRes.data ?? []);
        setPositions((posRes.data as any).data ?? []);
      })
      .catch(() => setError("Failed to load departments, roles, and portfolios."));
  }, []);

  const handleCreateJobTitle = async () => {
    if (!newJobTitle.trim()) return;
    try {
      await positionsApi.create({
        title: newJobTitle.trim(),
        department_id: form.department_id ? Number(form.department_id) : undefined as any,
        headcount: 1,
        is_active: true,
      });
      const posRes = await positionsApi.list({ all: true });
      setPositions((posRes.data as any).data ?? []);
      set("job_title", newJobTitle.trim());
      setIsCreatingJobTitle(false);
      setNewJobTitle("");
    } catch {
      setError("Failed to create job title.");
    }
  };

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) return;
    try {
      const res = await adminApi.createDepartment({ name: newDeptName.trim(), code: newDeptName.trim().substring(0, 3).toUpperCase() });
      const newDept = res.data.data || res.data.department || res.data;

      const deptRes = await adminApi.listDepartments();
      setDepartments(deptRes.data.data ?? []);

      const createdDept = deptRes.data.data?.find((d: Department) => d.name === newDeptName.trim()) || newDept;
      if (createdDept?.id) {
        set("department_id", createdDept.id.toString());
      }

      setIsCreatingDept(false);
      setNewDeptName("");
      setError(null);
    } catch (err) {
      setError("Failed to create department.");
    }
  };

  const set = (field: keyof FormData, value: string | boolean | number[]) =>
    setForm((p) => ({ ...p, [field]: value }));

  const setRole = (role: string) => {
    set("role", role);
    if (ROLE_PRESETS[role]) {
      setPermissions(applyPreset(role));
    }
  };

  const toggleAction = (module: string, action: string) => {
    setPermissions((prev) =>
      prev.map((p) => {
        if (p.module !== module) return p;
        const has = p.granted.includes(action);
        let updated = has ? p.granted.filter((a) => a !== action) : [...p.granted, action];
        if (!has && action !== "view" && !updated.includes("view")) updated = ["view", ...updated];
        return { ...p, granted: updated };
      })
    );
  };

  const toggleAllModule = (module: string, check: boolean) => {
    setPermissions((prev) =>
      prev.map((p) => p.module === module ? { ...p, granted: check ? [...p.actions] : [] } : p)
    );
  };

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.email.trim() && form.department_id;
    if (step === 2) return !!form.role;
    return true;
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await adminApi.createUser({
        name: form.name, email: form.email,
        employee_number: form.employee_number || undefined,
        job_title: form.job_title || undefined,
        department_id: form.department_id ? Number(form.department_id) : undefined,
        role: form.role || undefined,
        classification: form.classification || undefined,
        mfa_enabled: form.mfa_enabled,
        bio: form.bio || undefined,
        date_of_birth: form.date_of_birth || undefined,
        join_date: form.join_date || undefined,
        phone: form.phone || undefined,
        nationality: form.nationality || undefined,
        gender: form.gender || undefined,
        marital_status: form.marital_status || undefined,
        emergency_contact_name: form.emergency_contact_name || undefined,
        emergency_contact_relationship: form.emergency_contact_relationship || undefined,
        emergency_contact_phone: form.emergency_contact_phone || undefined,
        address_line1: form.address_line1 || undefined,
        address_line2: form.address_line2 || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        portfolio_ids: form.portfolio_ids.length > 0 ? form.portfolio_ids : undefined,
      });
      router.push("/admin/users");
    } catch {
      setError("Failed to create user. Ensure email is unique.");
      setSubmitting(false);
    }
  };

  const totalGranted = permissions.reduce((s, p) => s + p.granted.length, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/admin/users" className="hover:text-primary transition-colors">User Management</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">New User</span>
      </div>
      <div>
        <h1 className="page-title">Create User Account</h1>
        <p className="page-subtitle">Add a new staff member with their role, security settings, and module access.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>{error}
        </div>
      )}

      {/* Step indicator */}
      <div className="card p-5">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold flex-shrink-0 transition-colors ${i < step ? "bg-green-500 text-white" : i === step ? "bg-primary text-white" : "bg-neutral-100 text-neutral-400"}`}>
                  {i < step ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block truncate ${i === step ? "text-primary" : i < step ? "text-neutral-700" : "text-neutral-400"}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${i < step ? "bg-green-400" : "bg-neutral-200"}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Step 0: Account Basic ────────────────────────────────────────── */}
      {step === 0 && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">person</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">Personal & Contact Details</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Full Name <span className="text-red-500">*</span></label>
              <input className="form-input" placeholder="e.g. Sarah Jenkins" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Email Address <span className="text-red-500">*</span></label>
              <input type="email" className="form-input" placeholder="user@sadcpf.org" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Employee Number</label>
              <input className="form-input" placeholder="EMP-0001" value={form.employee_number} onChange={(e) => set("employee_number", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Department <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select className="form-input flex-1" value={form.department_id} onChange={(e) => set("department_id", e.target.value)} disabled={isCreatingDept}>
                  <option value="">Select department…</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {isCreatingDept ? (
                  <div className="flex gap-2 flex-1">
                    <input autoFocus className="form-input flex-1" placeholder="Department Name" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateDepartment())} />
                    <button type="button" onClick={handleCreateDepartment} className="btn-primary px-3 text-xs" disabled={!newDeptName.trim()}>Save</button>
                    <button type="button" onClick={() => (setIsCreatingDept(false), setNewDeptName(""))} className="btn-secondary px-3 text-xs">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setIsCreatingDept(true)} className="btn-secondary px-3 flex items-center gap-1 text-xs whitespace-nowrap">
                    <span className="material-symbols-outlined text-[16px]">add</span> New
                  </button>
                )}
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Job Title</label>
              <div className="flex gap-2">
                <select
                  className="form-input flex-1"
                  value={form.job_title}
                  onChange={(e) => set("job_title", e.target.value)}
                  disabled={isCreatingJobTitle}
                >
                  <option value="">Select job title…</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.title}>{p.title}{p.department ? ` — ${p.department.name}` : ""}</option>
                  ))}
                  {form.job_title && !positions.some((p) => p.title === form.job_title) && (
                    <option value={form.job_title}>{form.job_title}</option>
                  )}
                </select>
                {isCreatingJobTitle ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      autoFocus
                      className="form-input flex-1"
                      placeholder="e.g. Finance Officer"
                      value={newJobTitle}
                      onChange={(e) => setNewJobTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateJobTitle())}
                    />
                    <button type="button" onClick={handleCreateJobTitle} className="btn-primary px-3 text-xs" disabled={!newJobTitle.trim()}>Save</button>
                    <button type="button" onClick={() => { setIsCreatingJobTitle(false); setNewJobTitle(""); }} className="btn-secondary px-3 text-xs">Cancel</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreatingJobTitle(true)}
                    title={!form.department_id ? "Select a department first" : "Create a new job title"}
                    className="btn-secondary px-3 flex items-center gap-1 text-xs whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span> New
                  </button>
                )}
              </div>
              {!form.department_id && isCreatingJobTitle && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">info</span>
                  Select a department first — the new position will be linked to it.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Phone Number</label>
              <input type="tel" className="form-input" placeholder="+264 61 000 0000" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Date of Birth</label>
              <input type="date" className="form-input" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Join Date</label>
              <input type="date" className="form-input" value={form.join_date} onChange={(e) => set("join_date", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Bio</label>
              <textarea className="form-input" placeholder="A brief biography" value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={3} />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: Personal & Emergency ────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
                <span className="material-symbols-outlined text-green-600 text-[18px]">demography</span>
              </div>
              <h3 className="text-sm font-semibold text-neutral-900">Demographics & Address</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Nationality</label>
                <input className="form-input" placeholder="e.g. Namibian" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Gender</label>
                <select className="form-input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">Select…</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Marital Status</label>
                <select className="form-input" value={form.marital_status} onChange={(e) => set("marital_status", e.target.value)}>
                  <option value="">Select…</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Residential Address Line 1</label>
                <input className="form-input" placeholder="Street name and number" value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">City</label>
                <input className="form-input" placeholder="Windhoek" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Country</label>
                <input className="form-input" placeholder="Namibia" value={form.country} onChange={(e) => set("country", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
                <span className="material-symbols-outlined text-red-600 text-[18px]">contact_emergency</span>
              </div>
              <h3 className="text-sm font-semibold text-neutral-900">Emergency Contact</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Contact Name</label>
                <input className="form-input" placeholder="Full Name" value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Relationship</label>
                <input className="form-input" placeholder="e.g. Spouse" value={form.emergency_contact_relationship} onChange={(e) => set("emergency_contact_relationship", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Contact Phone</label>
                <input type="tel" className="form-input" placeholder="+264..." value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Role & Security ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                <span className="material-symbols-outlined text-indigo-600 text-[18px]">hub</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Portfolios & Committees</h3>
                <p className="text-xs text-neutral-500">Assign the user to organisational thematic areas or committees.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {portfolios.length === 0 && <p className="text-xs text-neutral-400 italic py-2">No portfolios defined.</p>}
              {portfolios.map(p => (
                <button key={p.id} type="button"
                  onClick={() => {
                    const ids = form.portfolio_ids.includes(p.id) ? form.portfolio_ids.filter(id => id !== p.id) : [...form.portfolio_ids, p.id];
                    set("portfolio_ids", ids);
                  }}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 border transition-all text-xs font-medium ${form.portfolio_ids.includes(p.id) ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-neutral-200 text-neutral-500 hover:border-neutral-300"}`}
                >
                  <div className="size-2 rounded-full" style={{ backgroundColor: p.color || "#ccc" }} />
                  {p.name}
                  {form.portfolio_ids.includes(p.id) && <span className="material-symbols-outlined text-[14px]">check</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                <span className="material-symbols-outlined text-purple-600 text-[18px]">badge</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">System Role</h3>
                <p className="text-xs text-neutral-500">Selecting a role pre-fills module permissions.</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.keys(ROLE_PRESETS).map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${form.role === r ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"}`}>
                  <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${form.role === r ? "border-primary" : "border-neutral-300"}`}>
                    {form.role === r && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{r}</p>
                  </div>
                </button>
              ))}
              {roles.filter((r) => !ROLE_PRESETS[r.name]).map((r) => (
                <button key={r.id} type="button" onClick={() => setRole(r.name)}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${form.role === r.name ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-neutral-200 hover:border-neutral-300"}`}>
                  <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${form.role === r.name ? "border-primary" : "border-neutral-300"}`}>
                    {form.role === r.name && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{r.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                <span className="material-symbols-outlined text-amber-600 text-[18px]">security</span>
              </div>
              <h3 className="text-sm font-semibold text-neutral-900">Security Settings</h3>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Data Classification Level</label>
              <select className="form-input" value={form.classification} onChange={(e) => set("classification", e.target.value)}>
                {classifications.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 p-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Multi-Factor Authentication</p>
                <p className="text-xs text-neutral-500 mt-0.5">Require MFA on every login</p>
              </div>
              <button type="button" onClick={() => set("mfa_enabled", !form.mfa_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.mfa_enabled ? "bg-primary" : "bg-neutral-200"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.mfa_enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Module Permissions ──────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Module Access Matrix</p>
              <p className="text-xs text-neutral-500 mt-0.5">Role: <span className="font-semibold text-primary">{form.role}</span> · {totalGranted} granted</p>
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-neutral-600 w-44">Module</th>
                    <th className="text-center px-2 py-3 text-xs font-bold text-neutral-400 w-12">All</th>
                    {["view", "create", "edit", "approve", "admin", "export", "users", "roles", "settings", "audit"].map((a) => (
                      <th key={a} className="text-center px-2 py-3 text-xs font-semibold text-neutral-400 min-w-[56px] capitalize">{ACTION_LABELS[a]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {permissions.map((perm) => {
                    const allChecked = perm.actions.every((a) => perm.granted.includes(a));
                    return (
                      <tr key={perm.module} className="hover:bg-neutral-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <span className="material-symbols-outlined text-neutral-400 text-[16px]">{perm.icon}</span>
                            {perm.module}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button type="button" onClick={() => toggleAllModule(perm.module, !allChecked)}
                            className={`h-4 w-4 rounded border-2 flex items-center justify-center mx-auto ${allChecked ? "bg-neutral-700 border-neutral-700" : "border-neutral-300"}`}>
                            {allChecked && <span className="material-symbols-outlined text-white text-[11px]">check</span>}
                          </button>
                        </td>
                        {["view", "create", "edit", "approve", "admin", "export", "users", "roles", "settings", "audit"].map((action) => (
                          <td key={action} className="px-2 py-3 text-center">
                            {perm.actions.includes(action) ? (
                              <button type="button" onClick={() => toggleAction(perm.module, action)}
                                className={`h-5 w-5 rounded border-2 flex items-center justify-center mx-auto ${perm.granted.includes(action) ? `border-transparent ${ACTION_COLOR[action].split(" ")[0]}` : "border-neutral-200"}`}>
                                {perm.granted.includes(action) && <span className="material-symbols-outlined text-[12px] text-white">check</span>}
                              </button>
                            ) : <span className="text-neutral-200">—</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)}
              className="btn-secondary px-4 py-2.5 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>Back
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <Link href="/admin/users" className="btn-secondary px-4 py-2.5 text-sm">Cancel</Link>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canNext()}
              className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
              Next Step<span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
              {submitting ? "Creating…" : "Create User"}
              <span className="material-symbols-outlined text-[18px]">person_add</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
