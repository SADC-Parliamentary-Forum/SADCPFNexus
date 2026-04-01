import axios from "axios";

const AUTH_COOKIE = "sadcpf_authenticated";
const COOKIE_MAX_AGE_DAYS = 7;

export function setAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE_DAYS * 86400}; SameSite=Lax`;
}

export function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// In-memory token cache — avoids synchronous localStorage read on every request
let _cachedToken: string | null | undefined = undefined; // undefined = not yet loaded
function getToken(): string | null {
  if (_cachedToken === undefined) {
    _cachedToken = typeof window !== "undefined" ? localStorage.getItem("sadcpf_token") : null;
  }
  return _cachedToken;
}
export function setToken(token: string | null): void {
  _cachedToken = token;
  if (typeof window !== "undefined") {
    if (token) localStorage.setItem("sadcpf_token", token);
    else localStorage.removeItem("sadcpf_token");
  }
}

// Attach Sanctum token on each request (from memory cache, not localStorage)
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      setToken(null);
      localStorage.removeItem("sadcpf_user");
      clearAuthCookie();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

// Typed API helpers
export const authApi = {
  login: (email: string, password: string, deviceName?: string) =>
    api.post<{ token: string; user: AuthUser }>("/auth/login", {
      email,
      password,
      device_name: deviceName ?? "web",
    }),
  logout: () => api.post("/auth/logout"),
  me: () => api.get<AuthUser>("/auth/me"),
};

export interface DashboardStats {
  app_name: string;
  pending_approvals: number;
  active_travels: number;
  leave_requests: number;
  open_requisitions: number;
}

export interface UpcomingSocialEvent {
  id: string;
  date: string;
  title: string;
  type: "birthday";
}

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>("/dashboard/stats"),
  getUpcomingSocial: () =>
    api.get<{ data: UpcomingSocialEvent[] }>("/dashboard/upcoming-social"),
};

export interface TenantUserOption {
  id: number;
  name: string;
  email: string;
  job_title?: string | null;
}

export const tenantUsersApi = {
  list: (params?: { search?: string }) =>
    api.get<{ data: TenantUserOption[] }>("/tenant-users", { params }),
};

// ─── Calendar (Public Holidays, UN Days) ─────────────────────────────────────

export interface CalendarEntryInput {
  type: "sadc_holiday" | "un_day" | "sadc_calendar";
  country_code?: string | null;
  date: string;
  title: string;
  description?: string | null;
  is_alert?: boolean;
}

export interface CalendarEntry {
  id: number;
  type: string;
  country_code: string | null;
  date: string;
  title: string;
  description: string | null;
  is_alert: boolean;
}

export const calendarApi = {
  list: (params?: { year?: number; month?: number; type?: string; country_code?: string; per_page?: number }) =>
    api.get<{ data: CalendarEntry[] }>("/calendar/entries", { params }),
  get: (id: number) => api.get<CalendarEntry>(`/calendar/entries/${id}`),
  create: (data: CalendarEntryInput) =>
    api.post<{ data: CalendarEntry; message: string }>("/calendar/entries", data),
  update: (id: number, data: Partial<CalendarEntryInput>) =>
    api.put<{ data: CalendarEntry; message: string }>(`/calendar/entries/${id}`, data),
  delete: (id: number) => api.delete<{ message: string }>(`/calendar/entries/${id}`),
  upload: (entries: CalendarEntryInput[]) =>
    api.post<{ message: string; data: CalendarEntry[] }>("/calendar/entries/upload", {
      entries,
    }),
};

export interface Lookups {
  budget_lines?: string[];
  advance_types?: { value: string; label: string; desc?: string; icon?: string }[];
  classifications?: string[];
  leave_types?: { value: string; label: string; icon?: string }[];
  timesheet_projects?: string[];
}

export const lookupsApi = {
  get: (keys?: string[]) =>
    api.get<Lookups>("/lookups", { params: keys ? { keys: keys.join(",") } : undefined }),
};

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  tenant_id: number;
  classification: string;
  roles: string[];
  permissions: string[];
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
  email: string;
  employee_number: string | null;
  job_title: string | null;
  department_id: number | null;
  department?: { id: number; name: string };
  roles: string[];
  classification: string;
  is_active: boolean;
  mfa_enabled: boolean;
  bio?: string | null;
  date_of_birth?: string | null;
  join_date?: string | null;
  phone?: string | null;
  nationality?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_relationship?: string | null;
  emergency_contact_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  country?: string | null;
  skills?: string[] | null;
  qualifications?: { title: string; institution: string; year: string }[] | null;
  portfolios?: Portfolio[];
  created_at: string;
}

export interface Portfolio {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  users_count?: number;
  users?: User[];
}

export interface Department {
  id: number;
  name: string;
  code: string;
  parent_id?: number | null;
  supervisor_id?: number | null;
  parent?: Department;
  supervisor?: User;
  children?: Department[];
  users_count?: number;
}

export interface Role {
  id: number;
  name: string;
  permissions: string[] | { id?: number; name: string }[];
}

export interface ApprovalWorkflow {
  id: number;
  name: string;
  module_type: string;
  is_active: boolean;
  target_type?: "programme" | "department" | null;
  target_id?: number | null;
  steps: ApprovalStep[];
}

export interface ApprovalStep {
  id: number;
  workflow_id: number;
  step_order: number;
  approver_type: 'supervisor' | 'up_the_chain' | 'specific_role' | 'specific_user';
  role_id?: number | null;
  user_id?: number | null;
  role?: { id: number; name: string };
  user?: User;
}

export interface ApprovalRequest {
  id: number;
  approvable_type: string;
  approvable_id: number;
  workflow_id: number;
  current_step_index: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approvable?: any;
  workflow?: ApprovalWorkflow;
  history?: ApprovalHistory[];
}

export interface ApprovalHistory {
  id: number;
  approval_request_id: number;
  user_id: number;
  action: 'approve' | 'reject';
  comment?: string;
  created_at: string;
  user?: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export const adminApi = {
  // Users
  listUsers: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<User>>("/admin/users", { params }),
  getUser: (id: number) => api.get<User>(`/admin/users/${id}`),
  createUser: (data: Partial<User> & { password?: string; role?: string; portfolio_ids?: number[] }) =>
    api.post<{ user: User; message: string }>("/admin/users", data),
  updateUser: (id: number, data: Partial<User> & { role?: string; portfolio_ids?: number[] }) =>
    api.put<{ user: User; message: string }>(`/admin/users/${id}`, data),
  deactivateUser: (id: number) => api.delete(`/admin/users/${id}`),
  reactivateUser: (id: number) => api.post(`/admin/users/${id}/reactivate`),
  changeUserPassword: (id: number, password: string, passwordConfirmation: string) =>
    api.post<{ message: string }>(`/admin/users/${id}/change-password`, {
      password,
      password_confirmation: passwordConfirmation,
    }),
  getUserAudit: (id: number) => api.get(`/admin/users/${id}/audit`),

  // Departments
  listDepartments: () => api.get<PaginatedResponse<Department>>("/admin/departments"),
  createDepartment: (data: Partial<Department>) =>
    api.post("/admin/departments", data),
  updateDepartment: (id: number, data: Partial<Department>) =>
    api.put(`/admin/departments/${id}`, data),
  deleteDepartment: (id: number) => api.delete(`/admin/departments/${id}`),

  // Portfolios
  listPortfolios: () => api.get<Portfolio[]>("/admin/portfolios"),
  getPortfolio: (id: number) => api.get<Portfolio>(`/admin/portfolios/${id}`),
  createPortfolio: (data: Partial<Portfolio>) => api.post<Portfolio>("/admin/portfolios", data),
  updatePortfolio: (id: number, data: Partial<Portfolio>) => api.put<Portfolio>(`/admin/portfolios/${id}`, data),
  deletePortfolio: (id: number) => api.delete(`/admin/portfolios/${id}`),

  // Roles & Permissions (CRUD; assign role to user via updateUser with role field)
  listRoles: () => api.get<{ roles: Role[]; permissions: { id: number; name: string }[] }>("/admin/roles"),
  getRole: (id: number) => api.get<{ data: Role }>(`/admin/roles/${id}`),
  createRole: (data: { name: string; permissions?: string[] }) =>
    api.post<{ data: Role; message: string }>("/admin/roles", data),
  updateRole: (id: number, data: { name: string }) =>
    api.put<{ data: Role; message: string }>(`/admin/roles/${id}`, data),
  deleteRole: (id: number) => api.delete<{ message: string }>(`/admin/roles/${id}`),
  syncRolePermissions: (roleId: number, permissions: string[]) =>
    api.put<{ data: Role; message: string }>(`/admin/roles/${roleId}/permissions`, { permissions }),
  // Workflows
  listWorkflows: () => api.get<{ data: ApprovalWorkflow[] }>("/admin/workflows"),
  createWorkflow: (data: any) => api.post("/admin/workflows", data),
  updateWorkflow: (id: number, data: any) => api.put(`/admin/workflows/${id}`, data),
  deleteWorkflow: (id: number) => api.delete(`/admin/workflows/${id}`),

  // Payslips (list, filter, get one, download, upload, delete)
  listPayslips: (params?: {
    per_page?: number;
    page?: number;
    user_id?: number;
    employee_number?: string;
    search?: string;
  }) =>
    api.get<PaginatedResponse<AdminPayslip>>("/admin/payslips", { params }),
  getPayslip: (id: number) => api.get<AdminPayslip>(`/admin/payslips/${id}`),
  downloadPayslip: (id: number) =>
    api
      .get<Blob>(`/admin/payslips/${id}/download`, { responseType: "blob" })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payslip-${id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }),
  uploadPayslip: (formData: FormData) =>
    api.post<{ data: AdminPayslip; message: string }>("/admin/payslips", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deletePayslip: (id: number) => api.delete(`/admin/payslips/${id}`),

  // Timesheet projects (admin CRUD)
  listTimesheetProjects: () =>
    api.get<{ data: TimesheetProject[] }>("/admin/timesheet-projects"),
  createTimesheetProject: (data: { label: string; sort_order?: number }) =>
    api.post<{ data: TimesheetProject; message: string }>("/admin/timesheet-projects", data),
  updateTimesheetProject: (id: number, data: { label?: string; sort_order?: number }) =>
    api.put<{ data: TimesheetProject; message: string }>(`/admin/timesheet-projects/${id}`, data),
  deleteTimesheetProject: (id: number) =>
    api.delete(`/admin/timesheet-projects/${id}`),
};

// ─── Positions (Establishment Register) ──────────────────────────────────────

export interface Position {
  id: number;
  tenant_id: number;
  department_id: number;
  title: string;
  grade: string | null;
  description: string | null;
  headcount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: { id: number; name: string; code: string };
  users?: { id: number; name: string; email: string }[];
}

export const positionsApi = {
  list: (params?: { department_id?: number; active?: boolean; search?: string; all?: boolean; per_page?: number; page?: number }) =>
    api.get<{ data: Position[] }>("/admin/positions", { params }),
  get: (id: number) => api.get<{ data: Position }>(`/admin/positions/${id}`),
  create: (data: { department_id: number; title: string; grade?: string; description?: string; headcount?: number; is_active?: boolean }) =>
    api.post<{ data: Position; message: string }>("/admin/positions", data),
  update: (id: number, data: { department_id?: number; title?: string; grade?: string | null; description?: string | null; headcount?: number; is_active?: boolean }) =>
    api.put<{ data: Position; message: string }>(`/admin/positions/${id}`, data),
  delete: (id: number) => api.delete<{ message: string }>(`/admin/positions/${id}`),
  assign: (positionId: number, userId: number) =>
    api.post<{ message: string }>(`/admin/positions/${positionId}/assign`, { user_id: userId }),
};

/** Payslip with user relation (admin list/detail). */
export type AdminPayslip = Payslip & {
  user_id?: number;
  user?: { id: number; name: string; email: string; employee_number?: string | null };
};

export interface TimesheetProject {
  id: number;
  tenant_id?: number | null;
  label: string;
  sort_order: number;
}

export const profileApi = {
  get: () => api.get<User>("/profile"),
  update: (data: Partial<User>) => api.put<{ message: string; user: User }>("/profile", data),
  updatePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    api.put<{ message: string }>("/profile/password", {
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: confirmPassword,
    }),
};

// ─── Profile Change Requests ───────────────────────────────────────────────────

export interface ProfileChangeDiff {
  old: string | null;
  new: string | null;
}

export interface ProfileChangeRequest {
  id: number;
  user_id: number;
  requested_changes: Record<string, ProfileChangeDiff>;
  notes: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  user?: Pick<User, "id" | "name" | "email" | "job_title"> & { department?: { id: number; name: string } };
  reviewer?: Pick<User, "id" | "name">;
}

export const profileChangeRequestApi = {
  get: () => api.get<{ data: ProfileChangeRequest | null }>("/profile/change-request"),
  submit: (changes: Partial<User> & { notes?: string }) =>
    api.post<{ message: string; data: ProfileChangeRequest }>("/profile/change-request", changes),
  cancel: (id: number) => api.delete(`/profile/change-request/${id}`),
};

export const hrProfileRequestApi = {
  list: (status: "pending" | "approved" | "rejected" | "all" = "pending") =>
    api.get<{ data: ProfileChangeRequest[]; total: number; per_page: number; current_page: number }>("/hr/profile-requests", { params: { status } }),
  show: (id: number) => api.get<{ data: ProfileChangeRequest }>(`/hr/profile-requests/${id}`),
  approve: (id: number, review_notes?: string) =>
    api.post<{ message: string; data: ProfileChangeRequest }>(`/hr/profile-requests/${id}/approve`, { review_notes }),
  reject: (id: number, review_notes: string) =>
    api.post<{ message: string; data: ProfileChangeRequest }>(`/hr/profile-requests/${id}/reject`, { review_notes }),
};

// ─── Profile Documents ────────────────────────────────────────────────────
export const PROFILE_DOCUMENT_TYPES = [
  { value: 'cv',                   label: 'Curriculum Vitae (CV)',      icon: 'description' },
  { value: 'qualification',        label: 'Academic Qualification',     icon: 'school' },
  { value: 'id_document',          label: 'ID / Passport',              icon: 'badge' },
  { value: 'employment_contract',  label: 'Employment Contract',        icon: 'work' },
  { value: 'training_certificate', label: 'Training Certificate',       icon: 'verified' },
  { value: 'performance_review',   label: 'Performance Review',         icon: 'star' },
  { value: 'recommendation',       label: 'Recommendation Letter',      icon: 'recommend' },
  { value: 'photo',                label: 'Profile Photo',              icon: 'photo_camera' },
  { value: 'other',                label: 'Other Document',             icon: 'attach_file' },
] as const;

export type ProfileDocumentType = typeof PROFILE_DOCUMENT_TYPES[number]['value'];

export interface UserDocument {
  id: number;
  document_type: ProfileDocumentType;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  uploader?: { id: number; name: string };
}

export const profileDocumentsApi = {
  list: () => api.get<{ data: UserDocument[] }>('/profile/documents'),
  upload: (file: File, document_type: ProfileDocumentType, title?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('document_type', document_type);
    if (title) form.append('title', title);
    return api.post<{ message: string; data: UserDocument }>('/profile/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id: number) => api.delete(`/profile/documents/${id}`),
  downloadUrl: (id: number) => `${api.defaults.baseURL}/profile/documents/${id}/download`,
};

export const adminUserDocumentsApi = {
  list: (userId: number) => api.get<{ data: UserDocument[] }>(`/admin/users/${userId}/documents`),
  upload: (userId: number, file: File, document_type: ProfileDocumentType, title?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('document_type', document_type);
    if (title) form.append('title', title);
    return api.post<{ message: string; data: UserDocument }>(`/admin/users/${userId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (userId: number, docId: number) => api.delete(`/admin/users/${userId}/documents/${docId}`),
  downloadUrl: (userId: number, docId: number) => `${api.defaults.baseURL}/admin/users/${userId}/documents/${docId}/download`,
};

// ─── Governance (resolutions, meetings) ───────────────────────────────────────

export interface GovernanceDocument {
  id: number;
  language: "en" | "fr" | "pt";
  document_type: string;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface GovernanceResolution {
  id: number;
  reference_number: string | null;
  title: string;
  description: string | null;
  status: string;
  adopted_at: string | null;
  type?: string | null;
  committee?: string | null;
  lead_member?: string | null;
  lead_role?: string | null;
  documents?: GovernanceDocument[];
  created_at?: string;
  updated_at?: string;
}

export interface GovernanceMeeting {
  id: number;
  title: string;
  date: string | null;
  end_date: string | null;
  description: string | null;
  responsible: string | null;
  type: string;
  status: string;
}

// ─── Meeting Minutes ──────────────────────────────────────────────────────────

export interface MeetingActionItem {
  id: number;
  meeting_minutes_id: number;
  description: string;
  responsible_id: number | null;
  responsible_name: string | null;
  deadline: string | null;
  assignment_id: number | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
  responsible?: { id: number; name: string; job_title?: string };
  assignment?: { id: number; reference_number: string; status: string; progress_percent: number };
}

export interface MeetingMinutesRecord {
  id: number;
  title: string;
  meeting_date: string;
  location: string | null;
  meeting_type: string;
  status: "draft" | "final";
  chairperson: string | null;
  attendees: string[];
  apologies: string[];
  notes: string | null;
  workplan_event_id: number | null;
  created_by: number;
  created_at: string;
  creator?: { id: number; name: string; job_title?: string };
  action_items?: MeetingActionItem[];
  attachments?: Array<{
    id: number;
    original_filename: string;
    mime_type: string | null;
    size_bytes: number | null;
    created_at: string;
  }>;
}

export const minutesApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<MeetingMinutesRecord>>("/governance/minutes", { params }),
  get: (id: number) => api.get<MeetingMinutesRecord>(`/governance/minutes/${id}`),
  create: (data: Partial<MeetingMinutesRecord>) =>
    api.post<{ message: string; data: MeetingMinutesRecord }>("/governance/minutes", data),
  update: (id: number, data: Partial<MeetingMinutesRecord>) =>
    api.put<{ message: string; data: MeetingMinutesRecord }>(`/governance/minutes/${id}`, data),
  delete: (id: number) => api.delete<{ message: string }>(`/governance/minutes/${id}`),
  uploadDocument: (id: number, formData: FormData) =>
    api.post(`/governance/minutes/${id}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteDocument: (id: number, attachmentId: number) =>
    api.delete(`/governance/minutes/${id}/documents/${attachmentId}`),
  downloadUrl: (id: number, attachmentId: number) =>
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/governance/minutes/${id}/documents/${attachmentId}/download`,
  addActionItem: (id: number, data: Partial<MeetingActionItem>) =>
    api.post<{ message: string; data: MeetingActionItem }>(`/governance/minutes/${id}/action-items`, data),
  updateActionItem: (id: number, itemId: number, data: Partial<MeetingActionItem>) =>
    api.put<{ message: string; data: MeetingActionItem }>(`/governance/minutes/${id}/action-items/${itemId}`, data),
  deleteActionItem: (id: number, itemId: number) =>
    api.delete(`/governance/minutes/${id}/action-items/${itemId}`),
  assignActionItem: (id: number, itemId: number, data: { assigned_to?: number; due_date: string; priority?: string; description?: string }) =>
    api.post<{ message: string; data: MeetingActionItem; assignment: unknown }>(`/governance/minutes/${id}/action-items/${itemId}/assign`, data),
};

export const governanceApi = {
  resolutions: (params?: { status?: string; type?: string; per_page?: number; page?: number }) =>
    api.get<{ data: GovernanceResolution[]; current_page: number; last_page: number; per_page: number; total: number }>(
      "/governance/resolutions",
      { params }
    ),
  createResolution: (data: Partial<GovernanceResolution>) =>
    api.post<{ message: string; data: GovernanceResolution }>("/governance/resolutions", data),
  updateResolution: (id: number, data: Partial<GovernanceResolution>) =>
    api.put<{ message: string; data: GovernanceResolution }>(`/governance/resolutions/${id}`, data),
  deleteResolution: (id: number) =>
    api.delete<{ message: string }>(`/governance/resolutions/${id}`),
  uploadDocument: (resolutionId: number, formData: FormData) =>
    api.post<{ message: string; data: GovernanceDocument }>(
      `/governance/resolutions/${resolutionId}/documents`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    ),
  deleteDocument: (resolutionId: number, documentId: number) =>
    api.delete<{ message: string }>(`/governance/resolutions/${resolutionId}/documents/${documentId}`),
  getDocumentUrl: (resolutionId: number, documentId: number) =>
    `/governance/resolutions/${resolutionId}/documents/${documentId}/download`,
  meetings: (params?: { status?: string; per_page?: number; page?: number }) =>
    api.get<{
      data: GovernanceMeeting[];
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    }>("/governance/meetings", { params }),
};

export interface GovernanceCommittee {
  id: number;
  tenant_id: number;
  name: string;
  color: string; // hex e.g. "#3b82f6"
  is_active: boolean;
  sort_order: number;
}

export interface GovernanceMeetingType {
  id: number;
  tenant_id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export const committeeApi = {
  list: () => api.get<{ data: GovernanceCommittee[] }>("/governance/committees"),
  create: (data: { name: string; color?: string; is_active?: boolean; sort_order?: number }) =>
    api.post<{ data: GovernanceCommittee }>("/governance/committees", data),
  update: (id: number, data: Partial<GovernanceCommittee>) =>
    api.put<{ data: GovernanceCommittee }>(`/governance/committees/${id}`, data),
  remove: (id: number) => api.delete<{ message: string }>(`/governance/committees/${id}`),
};

export const governanceMeetingTypeApi = {
  list: () => api.get<{ data: GovernanceMeetingType[] }>("/governance/meeting-types"),
  create: (data: { name: string; is_active?: boolean; sort_order?: number }) =>
    api.post<{ data: GovernanceMeetingType }>("/governance/meeting-types", data),
  update: (id: number, data: Partial<GovernanceMeetingType>) =>
    api.put<{ data: GovernanceMeetingType }>(`/governance/meeting-types/${id}`, data),
  remove: (id: number) => api.delete<{ message: string }>(`/governance/meeting-types/${id}`),
};

export const workflowApi = {
  getPending: () => api.get<{ data: ApprovalRequest[] }>("/approvals/pending"),
  approve: (id: number, comment?: string) => api.post(`/approvals/${id}/approve`, { comment }),
  reject: (id: number, comment: string) => api.post(`/approvals/${id}/reject`, { comment }),
  getHistory: (id: number) => api.get<{ data: ApprovalHistory[] }>(`/approvals/${id}/history`),
};

// ─── Travel ──────────────────────────────────────────────────────────────────

export interface TravelRequest {
  id: number;
  reference_number: string;
  purpose: string;
  destination_country: string;
  destination_city: string | null;
  departure_date: string;
  return_date: string;
  estimated_dsa: number;
  currency: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "cancelled";
  justification: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  requester?: User;
  approver?: User;
  itineraries?: TravelItinerary[];
}

export interface TravelItinerary {
  id: number;
  from_location: string;
  to_location: string;
  travel_date: string;
  transport_mode: string;
  dsa_rate: number;
  days_count: number;
  calculated_dsa: number;
}

export const travelApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<TravelRequest>>("/travel/requests", { params }),
  get: (id: number) => api.get<TravelRequest>(`/travel/requests/${id}`),
  create: (data: Omit<Partial<TravelRequest>, "itineraries"> & { itineraries?: Partial<TravelItinerary>[] }) =>
    api.post<{ data: TravelRequest; message: string }>("/travel/requests", data),
  update: (id: number, data: Partial<TravelRequest>) =>
    api.put<{ data: TravelRequest; message: string }>(`/travel/requests/${id}`, data),
  delete: (id: number) => api.delete(`/travel/requests/${id}`),
  submit: (id: number) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/submit`),
  approve: (id: number) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/approve`),
  reject: (id: number, reason: string) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/reject`, { reason }),
};

// ─── Imprest ─────────────────────────────────────────────────────────────────

export interface ImprestRequest {
  id: number;
  reference_number: string;
  budget_line: string;
  amount_requested: number;
  amount_approved: number | null;
  amount_liquidated: number | null;
  currency: string;
  expected_liquidation_date: string;
  purpose: string;
  justification: string | null;
  status: "draft" | "submitted" | "approved" | "rejected" | "liquidated";
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  liquidated_at: string | null;
  created_at: string;
  requester?: User;
  approver?: User;
}

export const imprestApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<ImprestRequest>>("/imprest/requests", { params }),
  get: (id: number) => api.get<ImprestRequest>(`/imprest/requests/${id}`),
  create: (data: Partial<ImprestRequest>) =>
    api.post<{ data: ImprestRequest; message: string }>("/imprest/requests", data),
  update: (id: number, data: Partial<ImprestRequest>) =>
    api.put<{ data: ImprestRequest; message: string }>(`/imprest/requests/${id}`, data),
  delete: (id: number) => api.delete(`/imprest/requests/${id}`),
  submit: (id: number) =>
    api.post<{ data: ImprestRequest; message: string }>(`/imprest/requests/${id}/submit`),
  approve: (id: number, amount_approved?: number) =>
    api.post<{ data: ImprestRequest; message: string }>(`/imprest/requests/${id}/approve`, { amount_approved }),
  reject: (id: number, reason: string) =>
    api.post<{ data: ImprestRequest; message: string }>(`/imprest/requests/${id}/reject`, { reason }),
  retire: (id: number, data: { amount_liquidated: number; notes?: string; receipts_attached?: boolean }) =>
    api.post<{ data: ImprestRequest; message: string }>(`/imprest/requests/${id}/retire`, data),
};

// ─── Asset Categories ────────────────────────────────────────────────────────

export interface AssetCategory {
  id: number;
  tenant_id: number;
  name: string;
  code: string;
  sort_order: number;
}

export const assetCategoriesApi = {
  list: () => api.get<{ data: AssetCategory[] }>("/asset-categories"),
  create: (data: { name: string; code: string; sort_order?: number }) =>
    api.post<{ data: AssetCategory; message: string }>("/asset-categories", data),
  update: (id: number, data: { name?: string; code?: string; sort_order?: number }) =>
    api.put<{ data: AssetCategory; message: string }>(`/asset-categories/${id}`, data),
  delete: (id: number) => api.delete<{ message: string }>(`/asset-categories/${id}`),
};

// ─── Assets & Asset Requests ─────────────────────────────────────────────────

export interface Asset {
  id: number;
  asset_code: string;
  name: string;
  category: string;
  status: string;
  assigned_to: number | null;
  issued_at: string | null;
  value: number | null;
  notes: string | null;
  invoice_number?: string | null;
  invoice_path?: string | null;
  purchase_date?: string | null;
  purchase_value?: number | null;
  useful_life_years?: number | null;
  salvage_value?: number | null;
  depreciation_method?: string | null;
  age_years?: number | null;
  age_display?: string | null;
  current_value?: number | null;
  qr_path?: string | null;
  qr_url?: string | null;
}

export interface AssetRequest {
  id: number;
  tenant_id: number;
  requester_id: number;
  justification: string;
  status: "pending" | "approved" | "rejected";
  document_path: string | null;
  created_at: string;
  updated_at: string;
  requester?: { id: number; name: string; email: string };
}

export const assetsApi = {
  list: (params?: { assigned_to?: string; category?: string; per_page?: number; page?: number }) =>
    api.get<PaginatedResponse<Asset>>("/assets", { params }),
  get: (id: number) => api.get<Asset>(`/assets/${id}`),
  update: (id: number, data: {
    asset_code: string;
    name: string;
    category: string;
    status?: string;
    assigned_to?: number;
    issued_at?: string;
    value?: number;
    notes?: string;
    invoice_number?: string;
    invoice_path?: string;
    purchase_date?: string;
    purchase_value?: number;
    useful_life_years?: number;
    salvage_value?: number;
    depreciation_method?: string;
  }) => api.put<Asset>(`/assets/${id}`, data),
  create: (data: {
    asset_code: string;
    name: string;
    category: string;
    status?: string;
    assigned_to?: number;
    issued_at?: string;
    value?: number;
    notes?: string;
    invoice_number?: string;
    invoice_path?: string;
    purchase_date?: string;
    purchase_value?: number;
    useful_life_years?: number;
    salvage_value?: number;
    depreciation_method?: string;
  }) => api.post<Asset>("/assets", data),
  uploadInvoice: (assetId: number, file: File) => {
    const formData = new FormData();
    formData.append("invoice", file);
    return api.post<Asset>(`/assets/${assetId}/invoice`, formData);
  },
};

export const assetRequestsApi = {
  list: (params?: { per_page?: number; page?: number }) =>
    api.get<PaginatedResponse<AssetRequest>>("/asset-requests", { params }),
  create: (data: { justification: string; document_path?: string }) =>
    api.post<AssetRequest>("/asset-requests", data),
};

// ─── Reports (hub endpoints for report types) ───────────────────────────────────

export const reportsApi = {
  summary: () => api.get<{ report_types: { id: string; label: string; count: number }[] }>("/reports/summary"),
  assets: (params?: { category?: string; period_from?: string; period_to?: string; per_page?: number }) =>
    api.get<PaginatedResponse<Asset>>("/reports/assets", { params }),
};

// ─── Leave ───────────────────────────────────────────────────────────────────

export interface LeaveRequest {
  id: number;
  reference_number: string;
  leave_type: "annual" | "sick" | "lil" | "special" | "maternity" | "paternity";
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: "draft" | "submitted" | "approved" | "rejected" | "cancelled";
  rejection_reason: string | null;
  has_lil_linking: boolean;
  lil_hours_required: number | null;
  lil_hours_linked: number | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  requester?: User;
  approver?: User;
}

export const leaveApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<LeaveRequest>>("/leave/requests", { params }),
  get: (id: number) => api.get<LeaveRequest>(`/leave/requests/${id}`),
  create: (data: Partial<LeaveRequest> & { lil_linkings?: object[] }) =>
    api.post<{ data: LeaveRequest; message: string }>("/leave/requests", data),
  update: (id: number, data: Partial<LeaveRequest>) =>
    api.put<{ data: LeaveRequest; message: string }>(`/leave/requests/${id}`, data),
  delete: (id: number) => api.delete(`/leave/requests/${id}`),
  submit: (id: number) =>
    api.post<{ data: LeaveRequest; message: string }>(`/leave/requests/${id}/submit`),
  approve: (id: number) =>
    api.post<{ data: LeaveRequest; message: string }>(`/leave/requests/${id}/approve`),
  reject: (id: number, reason: string) =>
    api.post<{ data: LeaveRequest; message: string }>(`/leave/requests/${id}/reject`, { reason }),
  listLilAccruals: () => api.get<{ data: LilAccrual[] }>("/leave/lil-accruals"),
  getBalances: () =>
    api.get<{ annual_balance_days: number; lil_hours_available: number; sick_leave_used_days: number; period_year: number }>("/leave/balances"),
};

export interface LilAccrual {
  id: string;
  code: string;
  description: string;
  hours: number;
  date: string;
  approved_by: string | null;
  is_verified: boolean;
}

// ─── Procurement ─────────────────────────────────────────────────────────────

export interface ProcurementItem {
  id: number;
  description: string;
  quantity: number;
  unit: string;
  estimated_unit_price: number;
  total_price: number;
}

export interface ProcurementQuote {
  id: number;
  vendor_name: string;
  quoted_amount: number;
  currency?: string;
  is_recommended: boolean;
  notes: string | null;
}

export interface ProcurementRequest {
  id: number;
  reference_number: string;
  title: string;
  description: string | null;
  category: string;
  estimated_value: number;
  currency: string;
  procurement_method: string;
  budget_line: string | null;
  justification: string | null;
  required_by_date: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "cancelled" | "awarded";
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  awarded_quote_id: number | null;
  awarded_at: string | null;
  award_notes: string | null;
  requester?: User;
  approver?: User;
  items?: ProcurementItem[];
  quotes?: ProcurementQuote[];
}

export const procurementApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<ProcurementRequest>>("/procurement/requests", { params }),
  get: (id: number) => api.get<ProcurementRequest>(`/procurement/requests/${id}`),
  create: (data: Partial<ProcurementRequest>) =>
    api.post<{ data: ProcurementRequest; message: string }>("/procurement/requests", data),
  update: (id: number, data: Partial<ProcurementRequest>) =>
    api.put<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}`, data),
  delete: (id: number) => api.delete(`/procurement/requests/${id}`),
  submit: (id: number) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/submit`),
  approve: (id: number) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/approve`),
  reject: (id: number, reason: string) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/reject`, { reason }),
  award: (id: number, quoteId: number, awardNotes?: string) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/award`, { quote_id: quoteId, award_notes: awardNotes }),
};

export interface Vendor {
  id: number;
  name: string;
  registration_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  is_approved: boolean;
  is_active: boolean;
  quotes_count?: number;
  created_at?: string;
  recent_quotes?: VendorQuote[];
}

export interface VendorQuote {
  id: number;
  vendor_name: string;
  quoted_amount: number;
  currency: string;
  is_recommended: boolean;
  notes: string | null;
  quote_date: string | null;
  created_at: string;
  procurement_request?: {
    id: number;
    reference_number: string;
    title: string;
    status: string;
    category: string;
    estimated_value: number;
    currency: string;
  };
}

export const vendorsApi = {
  list: (params?: { search?: string; status?: string }) =>
    api.get<{ data: Vendor[] }>("/procurement/vendors", { params }),
  get: (id: number) =>
    api.get<{ data: Vendor }>(`/procurement/vendors/${id}`),
  create: (data: Partial<Vendor>) =>
    api.post<{ data: Vendor; message: string }>("/procurement/vendors", data),
  update: (id: number, data: Partial<Vendor>) =>
    api.put<{ data: Vendor; message: string }>(`/procurement/vendors/${id}`, data),
  destroy: (id: number) =>
    api.delete<{ message: string }>(`/procurement/vendors/${id}`),
  approve: (id: number) =>
    api.post<{ data: Vendor; message: string }>(`/procurement/vendors/${id}/approve`),
  reject: (id: number, reason: string) =>
    api.post<{ data: Vendor; message: string }>(`/procurement/vendors/${id}/reject`, { reason }),
};

// ─── Purchase Orders ─────────────────────────────────────────────────────────

export interface PurchaseOrderItem {
  id: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

export interface PurchaseOrder {
  id: number;
  reference_number: string;
  title: string;
  description: string | null;
  delivery_address: string | null;
  payment_terms: string;
  total_amount: number;
  currency: string;
  status: "draft" | "issued" | "partially_received" | "received" | "invoiced" | "closed" | "cancelled";
  issued_at: string | null;
  expected_delivery_date: string | null;
  cancellation_reason: string | null;
  vendor?: Vendor;
  items?: PurchaseOrderItem[];
  procurement_request?: ProcurementRequest;
  created_at?: string;
}

export interface GoodsReceiptItem {
  id: number;
  purchase_order_item_id: number;
  quantity_ordered: number;
  quantity_received: number;
  quantity_accepted: number;
  condition_notes: string | null;
  purchase_order_item?: PurchaseOrderItem;
}

export interface GoodsReceiptNote {
  id: number;
  reference_number: string;
  purchase_order_id: number;
  received_date: string;
  delivery_note_number: string | null;
  notes: string | null;
  status: "pending" | "inspected" | "accepted" | "rejected";
  items?: GoodsReceiptItem[];
  purchase_order?: PurchaseOrder;
  received_by?: { id: number; name: string };
  created_at?: string;
}

export const purchaseOrdersApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<PurchaseOrder>>("/procurement/purchase-orders", { params }),
  get: (id: number) =>
    api.get<{ data: PurchaseOrder }>(`/procurement/purchase-orders/${id}`),
  create: (data: Partial<PurchaseOrder> & { procurement_request_id: number; vendor_id: number; items?: Partial<PurchaseOrderItem>[] }) =>
    api.post<{ data: PurchaseOrder; message: string }>("/procurement/purchase-orders", data),
  update: (id: number, data: Partial<PurchaseOrder>) =>
    api.put<{ data: PurchaseOrder; message: string }>(`/procurement/purchase-orders/${id}`, data),
  issue: (id: number) =>
    api.post<{ data: PurchaseOrder; message: string }>(`/procurement/purchase-orders/${id}/issue`),
  cancel: (id: number, reason: string) =>
    api.post<{ data: PurchaseOrder; message: string }>(`/procurement/purchase-orders/${id}/cancel`, { reason }),
};

export const goodsReceiptsApi = {
  listAll: (params?: { status?: string; po_id?: number }) =>
    api.get<{ data: GoodsReceiptNote[] }>("/procurement/receipts", { params }),
  list: (poId: number) =>
    api.get<{ data: GoodsReceiptNote[] }>(`/procurement/purchase-orders/${poId}/receipts`),
  get: (poId: number, grnId: number) =>
    api.get<{ data: GoodsReceiptNote }>(`/procurement/purchase-orders/${poId}/receipts/${grnId}`),
  create: (poId: number, data: { received_date: string; notes?: string; items: { purchase_order_item_id: number; quantity_received: number; quantity_accepted?: number }[] }) =>
    api.post<{ data: GoodsReceiptNote; message: string }>(`/procurement/purchase-orders/${poId}/receipts`, data),
  accept: (poId: number, grnId: number) =>
    api.post<{ data: GoodsReceiptNote; message: string }>(`/procurement/purchase-orders/${poId}/receipts/${grnId}/accept`),
  reject: (poId: number, grnId: number, reason: string) =>
    api.post<{ data: GoodsReceiptNote; message: string }>(`/procurement/purchase-orders/${poId}/receipts/${grnId}/reject`, { reason }),
};

// ─── Procurement — Invoices ───────────────────────────────────────────────────

export interface Invoice {
  id: number;
  tenant_id: number;
  purchase_order_id: number;
  goods_receipt_note_id: number | null;
  vendor_id: number;
  reference_number: string;
  vendor_invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  currency: string;
  status: "received" | "matched" | "approved" | "rejected" | "paid";
  match_status: "pending" | "matched" | "variance";
  match_notes: string | null;
  rejection_reason: string | null;
  reviewed_by?: { id: number; name: string } | null;
  reviewed_at: string | null;
  vendor?: Vendor;
  purchase_order?: PurchaseOrder;
  goods_receipt_note?: GoodsReceiptNote;
  created_at?: string;
}

export const invoicesApi = {
  list: (params?: { status?: string }) =>
    api.get<{ data: Invoice[] }>("/procurement/invoices", { params }),
  get: (id: number) =>
    api.get<{ data: Invoice }>(`/procurement/invoices/${id}`),
  create: (data: {
    purchase_order_id: number;
    vendor_id: number;
    goods_receipt_note_id?: number;
    vendor_invoice_number: string;
    invoice_date: string;
    due_date: string;
    amount: number;
    currency?: string;
  }) =>
    api.post<{ data: Invoice; message: string }>("/procurement/invoices", data),
  approve: (id: number) =>
    api.post<{ data: Invoice; message: string }>(`/procurement/invoices/${id}/approve`),
  reject: (id: number, reason: string) =>
    api.post<{ data: Invoice; message: string }>(`/procurement/invoices/${id}/reject`, { reason }),
};

// ─── Finance (Salary Advances) ───────────────────────────────────────────────

export interface SalaryAdvanceRequest {
  id: number;
  reference_number: string;
  advance_type: string;
  amount: number;
  currency: string;
  repayment_months: number;
  purpose: string;
  justification: string | null;
  status: "draft" | "submitted" | "approved" | "rejected" | "paid";
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  requester?: User;
  approver?: User;
}

export interface Payslip {
  id: number;
  period_month: number;
  period_year: number;
  gross_amount: number;
  net_amount: number;
  currency: string;
  period_label?: string;
  issued_at: string | null;
}

export interface FinanceSummary {
  current_net_salary: number | null;
  current_gross_salary: number | null;
  ytd_gross: number | null;
  currency: string;
}

export interface BudgetLine {
  id: number;
  budget_id: number;
  category: string;
  account_code: string | null;
  description: string | null;
  amount_allocated: number;
  amount_spent: number;
  amount_remaining: number;
}

export interface Budget {
  id: number;
  tenant_id: number;
  year: string;
  name: string;
  type: "core" | "project";
  currency: string;
  total_amount: number;
  description: string | null;
  created_by: number | null;
  lines?: BudgetLine[];
  creator?: User;
}

export const financeApi = {
  getSummary: () => api.get<FinanceSummary>("/finance/summary"),

  // Budgets
  listBudgets: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Budget>>("/finance/budgets", { params }),
  getBudget: (id: number) => api.get<{ success: boolean; data: Budget }>(`/finance/budgets/${id}`),
  createBudget: (data: Partial<Budget>) =>
    api.post<{ success: boolean; data: Budget; message: string }>("/finance/budgets", data),
  updateBudget: (id: number, data: Partial<Budget>) =>
    api.put<{ success: boolean; data: Budget; message: string }>(`/finance/budgets/${id}`, data),
  deleteBudget: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/finance/budgets/${id}`),
  listPayslips: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Payslip>>("/finance/payslips", { params }),
  getPayslip: (id: number) => api.get<Payslip>(`/finance/payslips/${id}`),
  /** Fetches payslip file with auth; returns blob for download. */
  downloadPayslip: (id: number) =>
    api.get<Blob>(`/finance/payslips/${id}/download`, { responseType: "blob" }),
  listAdvances: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<SalaryAdvanceRequest>>("/finance/advances", { params }),
  getAdvance: (id: number) => api.get<SalaryAdvanceRequest>(`/finance/advances/${id}`),
  createAdvance: (data: Partial<SalaryAdvanceRequest> & { advance_type: string; amount: number; purpose: string; justification: string }) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>("/finance/advances", data),
  updateAdvance: (id: number, data: Partial<SalaryAdvanceRequest>) =>
    api.put<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}`, data),
  deleteAdvance: (id: number) => api.delete(`/finance/advances/${id}`),
  submitAdvance: (id: number) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/submit`),
  approveAdvance: (id: number) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/approve`),
  rejectAdvance: (id: number, reason: string) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/reject`, { reason }),
};

// ─── HR (Timesheets) ────────────────────────────────────────────────────────

export interface TimesheetEntry {
  id?: number;
  work_date: string;
  hours: number;
  overtime_hours?: number;
  description?: string | null;
  // Phase 1 classification fields
  project_id?: number | null;
  work_bucket?: 'delivery' | 'meeting' | 'communication' | 'administration' | 'other' | null;
  activity_type?: string | null;
  work_assignment_id?: number | null;
  project?: TimesheetProject;
  work_assignment?: { id: number; title: string; estimated_hours: number | null };
}

export interface Timesheet {
  id: number;
  week_start: string;
  week_end: string;
  total_hours: number;
  overtime_hours: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  user?: User;
  approver?: User;
  entries?: TimesheetEntry[];
}

export interface HrSummary {
  hours_this_month: number;
  overtime_mtd: number;
  annual_leave_left: number;
  lil_hours_available: number;
}

export const hrApi = {
  getSummary: () => api.get<HrSummary>("/hr/summary"),
  listTimesheets: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Timesheet>>("/hr/timesheets", { params }),
  getTimesheet: (id: number) => api.get<Timesheet>(`/hr/timesheets/${id}`),
  createTimesheet: (data: { week_start: string; week_end: string; entries: TimesheetEntry[] }) =>
    api.post<{ data: Timesheet; message: string }>("/hr/timesheets", data),
  updateTimesheet: (id: number, data: { entries: TimesheetEntry[] }) =>
    api.put<{ data: Timesheet; message: string }>(`/hr/timesheets/${id}`, data),
  submitTimesheet: (id: number) =>
    api.post<{ data: Timesheet; message: string }>(`/hr/timesheets/${id}/submit`),
  approveTimesheet: (id: number) =>
    api.post<{ data: Timesheet; message: string }>(`/hr/timesheets/${id}/approve`),
  rejectTimesheet: (id: number, reason: string) =>
    api.post<{ data: Timesheet; message: string }>(`/hr/timesheets/${id}/reject`, { reason }),
  importTimesheets: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{ message: string; imported: number; errors?: string[] }>("/hr/timesheets/import", form);
  },
  listTeamTimesheets: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Timesheet>>("/hr/timesheets/team", { params }),
  getTimesheetLeaveDays: (weekStart: string, weekEnd: string) =>
    api.get<{ data: Record<string, { leave_type: string; status: string }> }>(
      "/hr/timesheets/leave-days",
      { params: { week_start: weekStart, week_end: weekEnd } }
    ),
};

// ─── Programmes (PIF) ────────────────────────────────────────────────────────

export interface ProgrammeActivity {
  id: number;
  programme_id: number;
  name: string;
  description: string | null;
  budget_allocation: number;
  responsible: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  status: "draft" | "approved" | "in_progress" | "completed" | "postponed" | "cancelled";
}

export interface ProgrammeMilestone {
  id: number;
  programme_id: number;
  name: string;
  target_date: string;
  achieved_date: string | null;
  completion_pct: number;
  status: "pending" | "achieved" | "missed";
}

export interface ProgrammeDeliverable {
  id: number;
  programme_id: number;
  name: string;
  description: string | null;
  due_date: string;
  status: "pending" | "submitted" | "accepted";
}

export interface ProgrammeBudgetLine {
  id: number;
  programme_id: number;
  category: string;
  description: string;
  amount: number;
  actual_spent: number;
  funding_source: "core_budget" | "donor" | "cost_sharing" | "other";
  account_code: string | null;
}

export interface ProgrammeProcurementItem {
  id: number;
  programme_id: number;
  description: string;
  estimated_cost: number;
  method: "direct_purchase" | "three_quotations" | "tender";
  vendor: string | null;
  delivery_date: string | null;
  status: "pending" | "ordered" | "delivered" | "cancelled";
}

export interface ProgrammeFundingSource {
  name: string;
  budget_amount?: number | null;
  pays_for?: string | null;
}

export interface Programme {
  id: number;
  reference_number: string;
  title: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "active" | "on_hold" | "completed" | "financially_closed" | "archived";
  strategic_alignment: string[] | null;
  strategic_pillar: string | null;
  strategic_pillars: string[] | null;
  implementing_department: string | null;
  implementing_departments: string[] | null;
  supporting_departments: string[] | null;
  background: string | null;
  overall_objective: string | null;
  specific_objectives: string[] | null;
  expected_outputs: string[] | null;
  target_beneficiaries: string[] | null;
  gender_considerations: string | null;
  primary_currency: string;
  base_currency: string;
  exchange_rate: number;
  contingency_pct: number;
  total_budget: number;
  funding_source: string | null;
  funding_sources: ProgrammeFundingSource[] | null;
  responsible_officer: string | null;
  responsible_officer_id: number | null;
  responsible_officer_ids: number[] | null;
  start_date: string | null;
  end_date: string | null;
  travel_required: boolean;
  delegates_count: number | null;
  member_states: string[] | null;
  travel_services: string[] | null;
  procurement_required: boolean;
  media_options: string[] | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  creator?: User;
  approver?: User;
  responsible_officer_user?: User;
  activities?: ProgrammeActivity[];
  milestones?: ProgrammeMilestone[];
  deliverables?: ProgrammeDeliverable[];
  budget_lines?: ProgrammeBudgetLine[];
  procurement_items?: ProgrammeProcurementItem[];
}

export type ProgrammeAttachmentType =
  | "concept_note"
  | "memo"
  | "hotel_quote"
  | "transport_quote"
  | "other";

export interface ProgrammeAttachment {
  id: number;
  document_type: ProgrammeAttachmentType | null;
  original_filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: number;
  created_at: string;
  uploader?: { id: number; name: string };
  is_chosen_quote?: boolean;
  selection_reason?: string | null;
}

/** Document types that can be marked as chosen quote with a reason */
export const QUOTE_ATTACHMENT_TYPES: ProgrammeAttachmentType[] = [
  "hotel_quote",
  "transport_quote",
  "other",
];

export const programmeApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Programme>>("/programmes", { params }),
  get: (id: number) => api.get<Programme>(`/programmes/${id}`),
  create: (data: Partial<Programme> & { title: string }) =>
    api.post<{ data: Programme; message: string }>("/programmes", data),
  update: (id: number, data: Partial<Programme>) =>
    api.put<{ data: Programme; message: string }>(`/programmes/${id}`, data),
  delete: (id: number) => api.delete(`/programmes/${id}`),
  submit: (id: number) =>
    api.post<{ data: Programme; message: string }>(`/programmes/${id}/submit`),
  approve: (id: number) =>
    api.post<{ data: Programme; message: string }>(`/programmes/${id}/approve`),
  reject: (id: number, reason: string) =>
    api.post<{ data: Programme; message: string }>(`/programmes/${id}/reject`, { reason }),

  // Activities
  addActivity: (programmeId: number, data: Partial<ProgrammeActivity>) =>
    api.post<{ data: ProgrammeActivity; message: string }>(`/programmes/${programmeId}/activities`, data),
  updateActivity: (programmeId: number, activityId: number, data: Partial<ProgrammeActivity>) =>
    api.put<{ data: ProgrammeActivity; message: string }>(`/programmes/${programmeId}/activities/${activityId}`, data),
  deleteActivity: (programmeId: number, activityId: number) =>
    api.delete(`/programmes/${programmeId}/activities/${activityId}`),

  // Milestones
  addMilestone: (programmeId: number, data: Partial<ProgrammeMilestone>) =>
    api.post<{ data: ProgrammeMilestone; message: string }>(`/programmes/${programmeId}/milestones`, data),
  updateMilestone: (programmeId: number, milestoneId: number, data: Partial<ProgrammeMilestone>) =>
    api.put<{ data: ProgrammeMilestone; message: string }>(`/programmes/${programmeId}/milestones/${milestoneId}`, data),
  deleteMilestone: (programmeId: number, milestoneId: number) =>
    api.delete(`/programmes/${programmeId}/milestones/${milestoneId}`),

  // Deliverables
  addDeliverable: (programmeId: number, data: Partial<ProgrammeDeliverable>) =>
    api.post<{ data: ProgrammeDeliverable; message: string }>(`/programmes/${programmeId}/deliverables`, data),
  updateDeliverable: (programmeId: number, deliverableId: number, data: Partial<ProgrammeDeliverable>) =>
    api.put<{ data: ProgrammeDeliverable; message: string }>(`/programmes/${programmeId}/deliverables/${deliverableId}`, data),
  deleteDeliverable: (programmeId: number, deliverableId: number) =>
    api.delete(`/programmes/${programmeId}/deliverables/${deliverableId}`),

  // Budget lines
  addBudgetLine: (programmeId: number, data: Partial<ProgrammeBudgetLine>) =>
    api.post<{ data: ProgrammeBudgetLine; message: string }>(`/programmes/${programmeId}/budget-lines`, data),
  updateBudgetLine: (programmeId: number, lineId: number, data: Partial<ProgrammeBudgetLine>) =>
    api.put<{ data: ProgrammeBudgetLine; message: string }>(`/programmes/${programmeId}/budget-lines/${lineId}`, data),
  deleteBudgetLine: (programmeId: number, lineId: number) =>
    api.delete(`/programmes/${programmeId}/budget-lines/${lineId}`),

  // Procurement items
  addProcurementItem: (programmeId: number, data: Partial<ProgrammeProcurementItem>) =>
    api.post<{ data: ProgrammeProcurementItem; message: string }>(`/programmes/${programmeId}/procurement`, data),
  updateProcurementItem: (programmeId: number, itemId: number, data: Partial<ProgrammeProcurementItem>) =>
    api.put<{ data: ProgrammeProcurementItem; message: string }>(`/programmes/${programmeId}/procurement/${itemId}`, data),
  deleteProcurementItem: (programmeId: number, itemId: number) =>
    api.delete(`/programmes/${programmeId}/procurement/${itemId}`),

  // Attachments (Concept Notes, memos, hotel/transport quotes)
  listAttachments: (programmeId: number) =>
    api.get<{ data: ProgrammeAttachment[] }>(`/programmes/${programmeId}/attachments`),
  uploadAttachment: (programmeId: number, file: File, documentType: ProgrammeAttachmentType) => {
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", documentType);
    return api.post<{ data: ProgrammeAttachment; message: string }>(
      `/programmes/${programmeId}/attachments`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },
  deleteAttachment: (programmeId: number, attachmentId: number) =>
    api.delete(`/programmes/${programmeId}/attachments/${attachmentId}`),
  updateAttachment: (
    programmeId: number,
    attachmentId: number,
    data: { is_chosen_quote?: boolean; selection_reason?: string | null }
  ) =>
    api.put<{ data: ProgrammeAttachment; message: string }>(
      `/programmes/${programmeId}/attachments/${attachmentId}`,
      data
    ),
  downloadAttachment: (programmeId: number, attachmentId: number, filename: string) =>
    api
      .get<Blob>(`/programmes/${programmeId}/attachments/${attachmentId}/download`, {
        responseType: "blob",
      })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || "download";
        a.click();
        URL.revokeObjectURL(url);
      }),
};

// ─── Workplan ─────────────────────────────────────────────────────────────────

export interface MeetingType {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  sort_order: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface WorkplanAttachment {
  id: number;
  attachable_type: string;
  attachable_id: number;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  uploaded_by?: { id: number; name: string };
}

export interface WorkplanEvent {
  id: number;
  title: string;
  type: "meeting" | "travel" | "leave" | "milestone" | "deadline";
  meeting_type_id?: number | null;
  date: string;
  end_date: string | null;
  description: string | null;
  responsible: string | null;
  linked_module: string | null;
  linked_id: number | null;
  created_at: string;
  creator?: User;
  meeting_type?: MeetingType | null;
  responsible_users?: { id: number; name: string; email: string }[];
  attachments?: WorkplanAttachment[];
}

export const workplanMeetingTypesApi = {
  list: () => api.get<{ data: MeetingType[] }>("/workplan/meeting-types"),
  create: (data: { name: string; description?: string; sort_order?: number }) =>
    api.post<{ data: MeetingType; message: string }>("/workplan/meeting-types", data),
  update: (id: number, data: { name?: string; description?: string; sort_order?: number }) =>
    api.put<{ data: MeetingType; message: string }>(`/workplan/meeting-types/${id}`, data),
  delete: (id: number) => api.delete(`/workplan/meeting-types/${id}`),
};

export interface WorkplanEventType {
  id: number;
  tenant_id: number;
  name: string;
  slug: string;
  icon: string;
  color: string;
  is_system: boolean;
  sort_order: number;
}

export const workplanEventTypesApi = {
  list: () => api.get<{ data: WorkplanEventType[] }>("/workplan/event-types"),
  create: (data: { name: string; icon?: string; color?: string; sort_order?: number }) =>
    api.post<{ data: WorkplanEventType; message: string }>("/workplan/event-types", data),
  update: (id: number, data: { name?: string; icon?: string; color?: string; sort_order?: number }) =>
    api.put<{ data: WorkplanEventType; message: string }>(`/workplan/event-types/${id}`, data),
  delete: (id: number) => api.delete(`/workplan/event-types/${id}`),
};

export const workplanApi = {
  list: (params?: { year?: number; month?: number; type?: string }) =>
    api.get<WorkplanEvent[]>("/workplan/events", { params }),
  get: (id: number) => api.get<WorkplanEvent>(`/workplan/events/${id}`),
  create: (data: Partial<WorkplanEvent> & { title: string; type: string; date: string; meeting_type_id?: number; responsible_user_ids?: number[] }) =>
    api.post<{ data: WorkplanEvent; message: string }>("/workplan/events", data),
  update: (id: number, data: Partial<WorkplanEvent> & { meeting_type_id?: number | null; responsible_user_ids?: number[] }) =>
    api.put<{ data: WorkplanEvent; message: string }>(`/workplan/events/${id}`, data),
  delete: (id: number) => api.delete(`/workplan/events/${id}`),
};

export const workplanAttachmentsApi = {
  list: (eventId: number) =>
    api.get<{ data: WorkplanAttachment[] }>(`/workplan/events/${eventId}/attachments`),
  upload: (eventId: number, file: File, documentType?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (documentType) form.append("document_type", documentType);
    return api.post<{ data: WorkplanAttachment; message: string }>(`/workplan/events/${eventId}/attachments`, form);
  },
  delete: (eventId: number, attachmentId: number) =>
    api.delete(`/workplan/events/${eventId}/attachments/${attachmentId}`),
  /** Fetch attachment as blob (use with createObjectURL + link click to download). */
  downloadBlob: (eventId: number, attachmentId: number) =>
    api.get<Blob>(`/workplan/events/${eventId}/attachments/${attachmentId}/download`, { responseType: "blob" }).then((r) => r.data),
};

// ─── Alerts ───────────────────────────────────────────────────────────────────

export interface AlertsAwayEntry {
  id: number;
  name: string;
  type: "leave" | "travel";
  from_date: string;
  to_date: string;
}

export interface AlertsMission {
  id: number;
  reference_number: string;
  purpose: string;
  destination_country: string;
  departure_date: string;
  return_date: string;
  requester_name: string;
}

export interface AlertsDeadline {
  id: number;
  reference_number?: string;
  module: string;
  title: string;
  deadline_date: string;
  responsible: string | null;
}

export interface AlertsWeekEvent {
  id: number;
  title: string;
  type: string;
  date: string;
  responsible: string | null;
  description: string | null;
}

export interface AlertsSummary {
  away_today: AlertsAwayEntry[];
  active_missions: AlertsMission[];
  upcoming_deadlines: AlertsDeadline[];
  events_this_week: AlertsWeekEvent[];
}

export const alertsApi = {
  getSummary: () => api.get<AlertsSummary>("/alerts/summary"),
};

// ─── Performance Tracker ──────────────────────────────────────────────────────

export interface PerformanceTracker {
  id: number;
  employee_id: number;
  supervisor_id: number | null;
  cycle_start: string;
  cycle_end: string;
  status: "excellent" | "strong" | "satisfactory" | "watchlist" | "at_risk" | "critical_review_required";
  trend: "improving" | "stable" | "declining" | "inconsistent" | "insufficient_data";
  output_score: number | null;
  timeliness_score: number | null;
  quality_score: number | null;
  workload_score: number | null;
  update_compliance_score: number | null;
  development_progress_score: number | null;
  recognition_indicator: boolean;
  conduct_risk_indicator: boolean;
  overdue_task_count: number;
  blocked_task_count: number;
  completed_task_count: number;
  assignment_completion_rate: number | null;
  average_closure_delay_days: number | null;
  timesheet_hours_logged: number;
  commendation_count: number;
  disciplinary_case_count: number;
  active_warning_flag: boolean;
  active_development_action_count: number;
  probation_flag: boolean;
  hr_attention_required: boolean;
  management_attention_required: boolean;
  supervisor_summary: string | null;
  hr_summary: string | null;
  last_recalculated_at: string | null;
  created_at: string;
  employee?: { id: number; name: string; email: string };
  supervisor?: { id: number; name: string; email: string } | null;
}

export const performanceTrackerApi = {
  list: (params?: { status?: string; employee_id?: number; per_page?: number; page?: number }) =>
    api.get<{ data: PerformanceTracker[]; current_page: number; last_page: number; total: number }>("/hr/performance", { params }),
  get: (id: number) => api.get<PerformanceTracker>(`/hr/performance/${id}`),
  create: (data: Partial<PerformanceTracker> & { employee_id: number; cycle_start: string; cycle_end: string }) =>
    api.post<PerformanceTracker>("/hr/performance", data),
  update: (id: number, data: Partial<PerformanceTracker>) =>
    api.put<PerformanceTracker>(`/hr/performance/${id}`, data),
  team: () => api.get<{ data: PerformanceTracker[] }>("/hr/performance/team"),
  overview: () =>
    api.get<{
      status_counts: Record<string, number>;
      watchlist: PerformanceTracker[];
      attention_required: PerformanceTracker[];
    }>("/hr/performance/overview"),
};

// ─── HR Personal File ─────────────────────────────────────────────────────────

export interface HrPersonalFile {
  id: number;
  employee_id: number;
  file_status: "active" | "probation" | "suspended" | "separated" | "archived";
  confidentiality_classification: "standard" | "restricted" | "confidential";
  staff_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  id_passport_number: string | null;
  marital_status: string | null;
  residential_address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  next_of_kin_details: string | null;
  appointment_date: string | null;
  employment_status: "permanent" | "contract" | "secondment" | "acting" | "probation" | "separated";
  contract_type: string | null;
  probation_status: "on_probation" | "confirmed" | "extended" | "terminated" | "not_applicable";
  confirmation_date: string | null;
  current_position: string | null;
  grade_scale: string | null;
  department_id: number | null;
  supervisor_id: number | null;
  contract_expiry_date: string | null;
  separation_date: string | null;
  separation_reason: string | null;
  promotion_history: Array<{ date: string; from_position: string; to_position: string; notes?: string }> | null;
  transfer_history: Array<{ date: string; from_dept: string; to_dept: string; reason?: string }> | null;
  payroll_number: string | null;
  latest_appraisal_summary: string | null;
  active_warning_flag: boolean;
  commendation_count: number;
  open_development_action_count: number;
  training_hours_current_cycle: number;
  last_file_review_date: string | null;
  archival_status: boolean;
  created_at: string;
  employee?: { id: number; name: string; email: string };
  department?: { id: number; name: string } | null;
  supervisor?: { id: number; name: string; email: string } | null;
}

export interface HrFileDocument {
  id: number;
  hr_file_id: number;
  document_type: string;
  title: string;
  description: string | null;
  file_name: string | null;
  file_size: number | null;
  confidentiality_level: "standard" | "restricted" | "confidential";
  issue_date: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  verified_at: string | null;
  source_module: string | null;
  version: number;
  tags: string[] | null;
  remarks: string | null;
  created_at: string;
  uploaded_by?: { id: number; name: string; email: string };
  verified_by?: { id: number; name: string; email: string } | null;
}

export interface HrFileTimelineEvent {
  id: number;
  hr_file_id: number;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string;
  source_module: string | null;
  created_at: string;
  recorded_by?: { id: number; name: string; email: string };
}

export const hrFilesApi = {
  list: (params?: { file_status?: string; employment_status?: string; department_id?: number; search?: string; per_page?: number; page?: number }) =>
    api.get<{ data: HrPersonalFile[]; current_page: number; last_page: number; total: number }>("/hr/files", { params }),
  get: (id: number, params?: { with_documents?: boolean; with_timeline?: boolean }) =>
    api.get<HrPersonalFile>(`/hr/files/${id}`, { params }),
  create: (data: Partial<HrPersonalFile> & { employee_id: number }) =>
    api.post<HrPersonalFile>("/hr/files", data),
  update: (id: number, data: Partial<HrPersonalFile>) =>
    api.put<HrPersonalFile>(`/hr/files/${id}`, data),
  getTimeline: (id: number) =>
    api.get<{ data: HrFileTimelineEvent[] }>(`/hr/files/${id}/timeline`),
  addTimelineEvent: (id: number, data: { event_type: string; title: string; description?: string; event_date: string }) =>
    api.post<HrFileTimelineEvent>(`/hr/files/${id}/timeline`, data),
  getDocuments: (id: number, params?: { document_type?: string }) =>
    api.get<{ data: HrFileDocument[] }>(`/hr/files/${id}/documents`, { params }),
  uploadDocument: (id: number, data: Partial<HrFileDocument> & { document_type: string; title: string }) =>
    api.post<HrFileDocument>(`/hr/files/${id}/documents`, data),
  deleteDocument: (fileId: number, docId: number) =>
    api.delete(`/hr/files/${fileId}/documents/${docId}`),
};

// ─── Performance Appraisal ────────────────────────────────────────────────────

export interface AppraisalCycle {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  period_start: string;
  period_end: string;
  submission_deadline: string | null;
  status: string;
  created_by: number;
  created_at: string;
  created_by_user?: { id: number; name: string; email: string };
}

export interface AppraisalKra {
  id: number;
  appraisal_id: number;
  title: string;
  description: string | null;
  weight: number | null;
  sort_order: number | null;
  self_rating: number | null;
  self_comments: string | null;
  supervisor_rating: number | null;
  supervisor_comments: string | null;
}

export interface AppraisalEvidenceLink {
  url: string;
  title?: string;
}

export interface AppraisalAttachment {
  id: number;
  attachable_type: string;
  attachable_id: number;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  uploaded_by?: { id: number; name: string };
}

export interface Appraisal {
  id: number;
  tenant_id: number;
  cycle_id: number;
  employee_id: number;
  supervisor_id: number | null;
  hod_id: number | null;
  status: string;
  self_assessment: string | null;
  self_overall_rating: number | null;
  supervisor_comments: string | null;
  supervisor_rating: number | null;
  supervisor_reviewed_at: string | null;
  hod_comments: string | null;
  hod_rating: number | null;
  hod_reviewed_at: string | null;
  hr_comments: string | null;
  overall_rating: number | null;
  overall_rating_label: string | null;
  development_plan: string | null;
  evidence_links: AppraisalEvidenceLink[] | null;
  sg_decision: string | null;
  submitted_at: string | null;
  finalized_at: string | null;
  employee_acknowledged: boolean;
  employee_acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
  cycle?: AppraisalCycle;
  employee?: { id: number; name: string; email: string };
  supervisor?: { id: number; name: string; email: string } | null;
  hod?: { id: number; name: string; email: string } | null;
  kras?: AppraisalKra[];
  attachments?: AppraisalAttachment[];
}

export const appraisalApi = {
  cycles: () => api.get<AppraisalCycle[]>("/hr/appraisal-cycles"),
  list: (params?: { cycle_id?: number; employee_id?: number; status?: string; per_page?: number; page?: number }) =>
    api.get<{ data: Appraisal[]; current_page: number; last_page: number; total: number }>("/hr/appraisals", { params }),
  get: (id: number) => api.get<Appraisal>(`/hr/appraisals/${id}`),
  create: (data: {
    cycle_id: number;
    employee_id: number;
    supervisor_id?: number;
    hod_id?: number;
    status?: string;
    evidence_links?: AppraisalEvidenceLink[];
    kras?: Array<{ title: string; description?: string; weight?: number; sort_order?: number }>;
  }) => api.post<Appraisal>("/hr/appraisals", data),
  update: (id: number, data: Partial<Appraisal> & { evidence_links?: AppraisalEvidenceLink[] }) =>
    api.put<Appraisal>(`/hr/appraisals/${id}`, data),
  submitSelfAssessment: (id: number, data: {
    self_assessment: string;
    self_overall_rating: number;
    evidence_links?: AppraisalEvidenceLink[];
    kras?: Array<{ id: number; self_rating?: number; self_comments?: string }>;
  }) => api.post<Appraisal>(`/hr/appraisals/${id}/submit-self-assessment`, data),
  supervisorReview: (id: number, data: { supervisor_comments: string; supervisor_rating: number; kras?: Array<{ id: number; supervisor_rating?: number; supervisor_comments?: string }> }) =>
    api.post<Appraisal>(`/hr/appraisals/${id}/supervisor-review`, data),
  hodReview: (id: number, data: { hod_comments: string; hod_rating: number }) =>
    api.post<Appraisal>(`/hr/appraisals/${id}/hod-review`, data),
  finalize: (id: number, data: { overall_rating: number; overall_rating_label: string; hr_comments?: string; development_plan?: string; sg_decision?: string }) =>
    api.post<Appraisal>(`/hr/appraisals/${id}/finalize`, data),
  acknowledge: (id: number) =>
    api.post<Appraisal>(`/hr/appraisals/${id}/acknowledge`),
};

export const appraisalAttachmentsApi = {
  list: (appraisalId: number) =>
    api.get<{ data: AppraisalAttachment[] }>(`/hr/appraisals/${appraisalId}/attachments`),
  upload: (appraisalId: number, file: File, documentType?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (documentType) form.append("document_type", documentType);
    return api.post<{ data: AppraisalAttachment; message: string }>(`/hr/appraisals/${appraisalId}/attachments`, form);
  },
  delete: (appraisalId: number, attachmentId: number) =>
    api.delete(`/hr/appraisals/${appraisalId}/attachments/${attachmentId}`),
  downloadBlob: (appraisalId: number, attachmentId: number) =>
    api.get<Blob>(`/hr/appraisals/${appraisalId}/attachments/${attachmentId}/download`, { responseType: "blob" }).then((r) => r.data),
};

// ─── Conduct, Discipline & Recognition ───────────────────────────────────────

export interface ConductRecord {
  id: number;
  tenant_id: number;
  employee_id: number;
  recorded_by_id: number;
  reviewed_by_id: number | null;
  hr_file_id: number | null;
  record_type: string;
  status: string;
  title: string;
  description: string;
  incident_date: string | null;
  issue_date: string;
  outcome: string | null;
  appeal_notes: string | null;
  resolution_date: string | null;
  is_confidential: boolean;
  created_at: string;
  updated_at: string;
  employee?: { id: number; name: string; email: string };
  recorded_by?: { id: number; name: string; email: string };
  reviewed_by?: { id: number; name: string; email: string } | null;
}

export const conductApi = {
  list: (params?: { employee_id?: number; record_type?: string; status?: string; per_page?: number; page?: number }) =>
    api.get<{ data: ConductRecord[]; current_page: number; last_page: number; total: number }>("/hr/conduct", { params }),
  get: (id: number) => api.get<ConductRecord>(`/hr/conduct/${id}`),
  create: (data: {
    employee_id: number;
    record_type: string;
    title: string;
    description: string;
    issue_date: string;
    incident_date?: string;
    status?: string;
    outcome?: string;
    is_confidential?: boolean;
    hr_file_id?: number;
  }) => api.post<ConductRecord>("/hr/conduct", data),
  update: (id: number, data: {
    status?: string;
    outcome?: string;
    appeal_notes?: string;
    resolution_date?: string;
    reviewed_by?: number;
  }) => api.put<ConductRecord>(`/hr/conduct/${id}`, data),
};

// ─── Work Assignments ─────────────────────────────────────────────────────────

export interface WorkAssignment {
  id: number;
  assigned_to: number;
  assigned_by: number;
  department_id: number | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "draft" | "assigned" | "in_progress" | "pending_review" | "completed" | "overdue" | "cancelled";
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  timesheet_linked: boolean;
  estimated_hours: number | null;
  actual_hours: number;
  linked_module: string | null;
  linked_id: number | null;
  completion_notes: string | null;
  is_overdue: boolean;
  created_at: string;
  assigned_to_user?: { id: number; name: string; email: string };
  assigned_by_user?: { id: number; name: string; email: string };
  updates?: WorkAssignmentUpdate[];
}

export interface WorkAssignmentUpdate {
  id: number;
  assignment_id: number;
  update_type: "progress" | "blocker" | "completion" | "comment" | "review";
  content: string;
  hours_logged: number | null;
  new_status: string | null;
  created_at: string;
  user?: { id: number; name: string; email: string };
}

export const workAssignmentsApi = {
  list: (params?: { assigned_to?: number; assigned_by?: number; status?: string; priority?: string; overdue?: boolean; per_page?: number; page?: number }) =>
    api.get<{ data: WorkAssignment[]; current_page: number; last_page: number; total: number }>("/hr/assignments", { params }),
  get: (id: number) => api.get<WorkAssignment>(`/hr/assignments/${id}`),
  create: (data: { title: string; assigned_to: number; description?: string; priority?: string; due_date?: string; estimated_hours?: number; department_id?: number }) =>
    api.post<WorkAssignment>("/hr/assignments", data),
  update: (id: number, data: Partial<WorkAssignment>) => api.put<WorkAssignment>(`/hr/assignments/${id}`, data),
  addUpdate: (id: number, data: { update_type: string; content: string; hours_logged?: number }) =>
    api.post<WorkAssignmentUpdate>(`/hr/assignments/${id}/updates`, data),
  start: (id: number) => api.post<WorkAssignment>(`/hr/assignments/${id}/start`, {}),
  complete: (id: number, completion_notes?: string) => api.post<WorkAssignment>(`/hr/assignments/${id}/complete`, { completion_notes }),
  stats: () => api.get<{ total: number; by_status: Record<string, number>; overdue: number; my_assignments: number }>("/hr/assignments/stats"),
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export interface AuditLogEntry {
  id: number;
  timestamp?: string;
  created_at: string;
  user?: string;
  user_name: string | null;
  user_email?: string | null;
  action: string;
  module: string | null;
  description?: string | null;
  record_id?: string | null;
  ip_address?: string | null;
}

export const auditApi = {
  list: (params?: { user?: string; module?: string; action?: string; date_from?: string; date_to?: string; per_page?: number; page?: number }) =>
    api.get<{ data: AuditLogEntry[]; current_page: number; last_page: number; total: number }>("/admin/audit-logs", { params }),
};

// ─── System Settings ──────────────────────────────────────────────────────────
export interface SystemSettings {
  org_name: string;
  org_abbreviation: string;
  org_logo_url: string;
  org_address: string;
  fiscal_start_month: string;
  default_currency: string;
  timezone: string;
  letterhead_tagline?: string;
  letterhead_phone?: string;
  letterhead_fax?: string;
  letterhead_website?: string;
}

export const settingsApi = {
  get: () => api.get<SystemSettings>("/admin/settings"),
  update: (data: Partial<SystemSettings>) => api.put<SystemSettings>("/admin/settings", data),
};

// ─── Notification Templates ───────────────────────────────────────────────────
export interface NotifTemplate {
  id: number | null;
  name: string;
  trigger_key: string;
  subject: string;
  body: string;
  customised?: boolean;
}

export const notificationTemplatesApi = {
  list: () => api.get<NotifTemplate[]>("/admin/notification-templates"),
  update: (data: { trigger_key: string; subject: string; body: string }) =>
    api.put<NotifTemplate>("/admin/notification-templates", data),
  testSend: (data: { trigger_key: string }) =>
    api.post<{ message: string }>("/admin/notification-templates/test-send", data),
};

// ─── User Notifications ───────────────────────────────────────────────────────
export interface UserNotification {
  id: string;
  trigger_key: string | null;
  subject: string;
  body: string;
  meta: {
    module?: string;
    record_id?: number;
    url?: string;
  };
  read_at: string | null;
  created_at: string;
}

export interface NotificationPage {
  data: UserNotification[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export const userNotificationsApi = {
  list: (params?: { filter?: "all" | "unread" | "read"; per_page?: number; page?: number }) =>
    api.get<NotificationPage>("/notifications", { params }),
  unreadCount: () => api.get<{ count: number }>("/notifications/unread-count"),
  markRead: (id: string) => api.post<{ message: string }>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ message: string }>("/notifications/read-all"),
  destroy: (id: string) => api.delete<{ message: string }>(`/notifications/${id}`),
};

// ─── Governance Config ───────────────────────────────────────────────────────
export interface GovernanceConfig {
  datasets: Record<string, boolean>;
  redaction: Record<string, boolean>;
  formats: Record<string, boolean>;
  retention_days: number;
  min_group_size: number;
  granularity: string;
  variance_limit: number;
}

export const governanceConfigApi = {
  get: () => api.get<Record<string, unknown>>("/admin/settings").then((r) => {
    const s = r.data;
    const cfg: GovernanceConfig = {
      datasets: (s.governance_datasets as Record<string, boolean>) ?? { census: true, tax: true, infra: true, personnel: false },
      redaction: (s.governance_redaction as Record<string, boolean>) ?? { maskSSN: true, generalizeLocation: true, hideIncome: false, obscureNames: true },
      formats: (s.governance_formats as Record<string, boolean>) ?? { csv: true, pdf: true, json: false, xlsx: false },
      retention_days: Number(s.governance_retention_days ?? 30),
      min_group_size: Number(s.governance_min_group_size ?? 15),
      granularity: String(s.governance_granularity ?? "Weekly"),
      variance_limit: Number(s.governance_variance_limit ?? 5),
    };
    return { ...r, data: cfg };
  }),
  update: (cfg: GovernanceConfig) => api.put("/admin/settings", {
    governance_datasets: cfg.datasets,
    governance_redaction: cfg.redaction,
    governance_formats: cfg.formats,
    governance_retention_days: cfg.retention_days,
    governance_min_group_size: cfg.min_group_size,
    governance_granularity: cfg.granularity,
    governance_variance_limit: cfg.variance_limit,
  }),
};

// ─── Analytics ───────────────────────────────────────────────────────────────
export interface AnalyticsSummary {
  kpi: { total_submissions: number; approval_rate_pct: number; active_travel: number };
  by_module: { module: string; label: string; count: number }[];
  monthly_submissions: { month: string; label: string; count: number }[];
  activity_heatmap: { day: number; hour: number; count: number }[];
  recent_activity: { id: number; event: string; user: string; module: string; timestamp: string }[];
}

export const analyticsApi = {
  summary: () => api.get<AnalyticsSummary>("/analytics/summary"),
};

// ─── HR Incidents ─────────────────────────────────────────────────────────────

export interface HrIncident {
  id: number;
  tenant_id: number;
  reported_by: number;
  reference_number: string;
  subject: string;
  description: string | null;
  severity: "low" | "medium" | "high";
  status: "reported" | "under_review" | "resolved" | "closed";
  reported_at: string;
  created_at: string;
  reporter?: { id: number; name: string; email: string };
}

export const hrIncidentsApi = {
  list: (params?: { mine?: "1"; status?: string; per_page?: number; page?: number }) =>
    api.get<PaginatedResponse<HrIncident>>("/hr/incidents", { params }),
  get: (id: number) => api.get<HrIncident>(`/hr/incidents/${id}`),
  create: (data: { subject: string; description?: string; severity?: string }) =>
    api.post<{ data: HrIncident; message: string }>("/hr/incidents", data),
  update: (id: number, data: { status?: HrIncident["status"]; description?: string; severity?: HrIncident["severity"] }) =>
    api.put<{ data: HrIncident; message: string }>(`/hr/incidents/${id}`, data),
};

// ─── Support Tickets ───────────────────────────────────────────────────────────

export interface SupportTicket {
  id: number;
  tenant_id: number;
  user_id: number;
  reference_number: string;
  subject: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
}

export const supportTicketsApi = {
  list: (params?: { status?: string; per_page?: number; page?: number }) =>
    api.get<PaginatedResponse<SupportTicket>>("/support/tickets", { params }),
  get: (id: number) => api.get<SupportTicket>(`/support/tickets/${id}`),
  create: (data: { subject: string; description?: string; priority?: string }) =>
    api.post<{ data: SupportTicket; message: string }>("/support/tickets", data),
};

// ─── Assignments, Oversight & Accountability ──────────────────────────────────

export type AssignmentType = "individual" | "sector" | "collaborative";
export type AssignmentPriority = "low" | "medium" | "high" | "critical";
export type AssignmentStatus =
  | "draft" | "issued" | "awaiting_acceptance" | "accepted"
  | "active" | "at_risk" | "blocked" | "delayed"
  | "completed" | "closed" | "returned" | "cancelled";

export type AcceptanceDecision =
  | "accepted" | "clarification_requested" | "deadline_proposed" | "rejected";

export type UpdateType =
  | "update" | "comment" | "feedback" | "escalation" | "closure_request" | "system";

export type BlockerType =
  | "awaiting_approval" | "awaiting_funds" | "awaiting_information" | "external_dependency";

export interface AssignmentUpdate {
  id: number;
  assignment_id: number;
  submitted_by: number;
  type: UpdateType;
  progress_percent: number | null;
  notes: string;
  blocker_type: BlockerType | null;
  blocker_details: string | null;
  created_at: string;
  submitter?: User;
}

export interface Assignment {
  id: number;
  reference_number: string;
  title: string;
  description: string;
  objective: string | null;
  expected_output: string | null;
  type: AssignmentType;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  created_by: number;
  assigned_to: number | null;
  department_id: number | null;
  due_date: string;
  start_date: string | null;
  checkin_frequency: "daily" | "weekly" | "biweekly" | "monthly" | null;
  linked_programme_id: number | null;
  linked_event_id: number | null;
  is_confidential: boolean;
  progress_percent: number;
  acceptance_decision: AcceptanceDecision | null;
  acceptance_notes: string | null;
  proposed_deadline: string | null;
  accepted_at: string | null;
  blocker_type: BlockerType | null;
  blocker_details: string | null;
  closure_notes: string | null;
  rejection_reason: string | null;
  issued_at: string | null;
  closed_at: string | null;
  has_performance_note: boolean;
  completion_rating: number | null;
  created_at: string;
  creator?: User;
  assignee?: User;
  department?: { id: number; name: string };
  updates?: AssignmentUpdate[];
}

export interface AssignmentStats {
  total: number;
  active: number;
  overdue: number;
  due_soon: number;
  awaiting: number;
  blocked: number;
  completed: number;
  my_pending: number;
  by_priority: Record<string, number>;
  by_status: Record<string, number>;
}

export const assignmentsApi = {
  stats: () => api.get<AssignmentStats>("/assignments/stats"),
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Assignment>>("/assignments/", { params }),
  get: (id: number) =>
    api.get<Assignment>(`/assignments/${id}`),
  create: (data: Partial<Assignment>) =>
    api.post<{ data: Assignment; message: string }>("/assignments/", data),
  update: (id: number, data: Partial<Assignment>) =>
    api.put<{ data: Assignment; message: string }>(`/assignments/${id}`, data),
  delete: (id: number) =>
    api.delete(`/assignments/${id}`),
  issue: (id: number) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/issue`),
  accept: (id: number, data: { decision: AcceptanceDecision; notes?: string; proposed_deadline?: string }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/accept`, data),
  start: (id: number) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/start`),
  addUpdate: (id: number, data: { type?: UpdateType; progress_percent?: number; notes: string; blocker_type?: BlockerType; blocker_details?: string }) =>
    api.post<{ data: AssignmentUpdate; message: string }>(`/assignments/${id}/updates`, data),
  complete: (id: number, data?: { notes?: string }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/complete`, data),
  close: (id: number, data?: { notes?: string; rating?: number }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/close`, data),
  returnAssignment: (id: number, data: { reason: string }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/return`, data),
  cancel: (id: number, data?: { reason?: string }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/cancel`, data),
};

// ─── HR Settings — Master Data & Rules ───────────────────────────────────────

export type HrSettingsStatus = "draft" | "review" | "approved" | "published" | "archived";

export interface HrJobFamily {
  id: number;
  tenant_id: number;
  name: string;
  code: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  status: string;
  grade_bands_count?: number;
  created_at: string;
}

export interface HrGradeBand {
  id: number;
  tenant_id: number;
  code: string;
  label: string;
  band_group: "A" | "B" | "C" | "D";
  employment_category: "local" | "regional" | "researcher";
  min_notch: number;
  max_notch: number;
  probation_months: number;
  notice_period_days: number;
  leave_days_per_year: number;
  overtime_eligible: boolean;
  acting_allowance_rate: number | null;
  travel_class: "economy" | "business" | "first" | null;
  medical_aid_eligible: boolean;
  housing_allowance_eligible: boolean;
  job_family_id: number | null;
  job_family?: HrJobFamily;
  status: HrSettingsStatus;
  effective_from: string;
  effective_to: string | null;
  version_number: number;
  created_by: number | null;
  reviewed_by: number | null;
  approved_by: number | null;
  published_by: number | null;
  reviewed_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  notes: string | null;
  positions_count?: number;
  staff_count?: number;
  salary_scales?: HrSalaryScale[];
  reviewer?: Pick<User, "id" | "name">;
  approver?: Pick<User, "id" | "name">;
  publisher?: Pick<User, "id" | "name">;
  created_at: string;
}

export interface HrSalaryScaleNotch {
  notch: number;
  annual: number;
  monthly: number;
}

export interface HrSalaryScale {
  id: number;
  tenant_id: number;
  grade_band_id: number;
  grade_band?: HrGradeBand;
  currency: string;
  notches: HrSalaryScaleNotch[];
  status: HrSettingsStatus;
  effective_from: string;
  effective_to: string | null;
  version_number: number;
  created_by: number | null;
  reviewed_by: number | null;
  approved_by: number | null;
  published_by: number | null;
  reviewed_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  notes: string | null;
  approver?: Pick<User, "id" | "name">;
  publisher?: Pick<User, "id" | "name">;
  created_at: string;
}

export interface HrGradeBandImpact {
  positions_count: number;
  active_staff_count: number;
  positions: { id: number; title: string; department: string | null }[];
}

export interface HrContractType {
  id: number;
  tenant_id: number;
  code: string;
  name: string;
  description: string | null;
  is_permanent: boolean;
  has_probation: boolean;
  probation_months: number;
  notice_period_days: number;
  is_renewable: boolean;
  is_active: boolean;
  created_at: string;
}

export interface HrLeaveProfile {
  id: number;
  tenant_id: number;
  profile_code: string;
  profile_name: string;
  annual_leave_days: number;
  sick_leave_days: number;
  lil_days: number;
  special_leave_days: number;
  maternity_days: number;
  paternity_days: number;
  is_active: boolean;
  created_at: string;
}

export interface HrAllowanceProfile {
  id: number;
  tenant_id: number;
  profile_code: string;
  profile_name: string;
  currency: string;
  transport_allowance: number;
  housing_allowance: number;
  communication_allowance: number;
  medical_allowance: number;
  subsistence_allowance: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface HrAppraisalTemplate {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  cycle_frequency: "annual" | "bi_annual" | "quarterly";
  rating_scale_max: number;
  kra_count_default: number;
  is_probation_template: boolean;
  is_active: boolean;
  created_at: string;
}

export interface HrPersonnelFileSection {
  id: number;
  tenant_id: number;
  section_code: string;
  section_name: string;
  visibility: "employee" | "hr_only" | "supervisor" | "director" | "sg" | "hidden";
  is_editable_by_employee: boolean;
  is_mandatory: boolean;
  retention_months: number;
  confidentiality_level: "public" | "restricted" | "confidential";
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface HrApprovalMatrix {
  id: number;
  tenant_id: number;
  module: string;
  action_name: string;
  step_number: number;
  role_id: number | null;
  approver_user_id: number | null;
  role?: { id: number; name: string };
  approver_user?: { id: number; name: string };
  is_mandatory: boolean;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export const hrSettingsApi = {
  // ── Job Families ────────────────────────────────────────────────────────────
  listJobFamilies: () =>
    api.get<{ data: HrJobFamily[] }>("/admin/hr-settings/job-families"),
  createJobFamily: (data: Partial<HrJobFamily>) =>
    api.post<{ data: HrJobFamily; message: string }>("/admin/hr-settings/job-families", data),
  updateJobFamily: (id: number, data: Partial<HrJobFamily>) =>
    api.put<{ data: HrJobFamily; message: string }>(`/admin/hr-settings/job-families/${id}`, data),
  deleteJobFamily: (id: number) =>
    api.delete<{ message: string }>(`/admin/hr-settings/job-families/${id}`),

  // ── Grade Bands ─────────────────────────────────────────────────────────────
  listGradeBands: (params?: {
    status?: string;
    band_group?: string;
    employment_category?: string;
    search?: string;
    per_page?: number;
    page?: number;
  }) =>
    api.get<PaginatedResponse<HrGradeBand>>("/admin/hr-settings/grade-bands", { params }),
  getGradeBand: (id: number) =>
    api.get<{ data: HrGradeBand }>(`/admin/hr-settings/grade-bands/${id}`),
  createGradeBand: (data: Partial<HrGradeBand>) =>
    api.post<{ data: HrGradeBand; message: string }>("/admin/hr-settings/grade-bands", data),
  updateGradeBand: (id: number, data: Partial<HrGradeBand>) =>
    api.put<{ data: HrGradeBand; message: string }>(`/admin/hr-settings/grade-bands/${id}`, data),
  deleteGradeBand: (id: number) =>
    api.delete<{ message: string }>(`/admin/hr-settings/grade-bands/${id}`),
  submitGradeBand: (id: number) =>
    api.post<{ data: HrGradeBand; message: string }>(`/admin/hr-settings/grade-bands/${id}/submit`),
  approveGradeBand: (id: number) =>
    api.post<{ data: HrGradeBand; message: string }>(`/admin/hr-settings/grade-bands/${id}/approve`),
  publishGradeBand: (id: number) =>
    api.post<{ data: HrGradeBand; message: string }>(`/admin/hr-settings/grade-bands/${id}/publish`),
  archiveGradeBand: (id: number) =>
    api.post<{ data: HrGradeBand; message: string }>(`/admin/hr-settings/grade-bands/${id}/archive`),
  newVersionGradeBand: (id: number) =>
    api.post<{ data: HrGradeBand; message: string }>(`/admin/hr-settings/grade-bands/${id}/new-version`),
  impactCheckGradeBand: (id: number) =>
    api.get<{ data: HrGradeBandImpact }>(`/admin/hr-settings/grade-bands/${id}/impact`),

  // ── Salary Scales ───────────────────────────────────────────────────────────
  listSalaryScales: (params?: {
    grade_band_id?: number;
    status?: string;
    per_page?: number;
    page?: number;
  }) =>
    api.get<PaginatedResponse<HrSalaryScale>>("/admin/hr-settings/salary-scales", { params }),
  getSalaryScale: (id: number) =>
    api.get<{ data: HrSalaryScale }>(`/admin/hr-settings/salary-scales/${id}`),
  createSalaryScale: (data: Partial<HrSalaryScale> & { notches: HrSalaryScaleNotch[] }) =>
    api.post<{ data: HrSalaryScale; message: string }>("/admin/hr-settings/salary-scales", data),
  updateSalaryScale: (id: number, data: Partial<HrSalaryScale>) =>
    api.put<{ data: HrSalaryScale; message: string }>(`/admin/hr-settings/salary-scales/${id}`, data),
  deleteSalaryScale: (id: number) =>
    api.delete<{ message: string }>(`/admin/hr-settings/salary-scales/${id}`),
  submitSalaryScale: (id: number) =>
    api.post<{ data: HrSalaryScale; message: string }>(`/admin/hr-settings/salary-scales/${id}/submit`),
  approveSalaryScale: (id: number) =>
    api.post<{ data: HrSalaryScale; message: string }>(`/admin/hr-settings/salary-scales/${id}/approve`),
  publishSalaryScale: (id: number) =>
    api.post<{ data: HrSalaryScale; message: string }>(`/admin/hr-settings/salary-scales/${id}/publish`),

  // ── Contract Types ──────────────────────────────────────────────────────────
  listContractTypes: () =>
    api.get<{ data: HrContractType[] }>("/admin/hr-settings/contract-types"),
  createContractType: (data: Partial<HrContractType>) =>
    api.post<{ data: HrContractType; message: string }>("/admin/hr-settings/contract-types", data),
  updateContractType: (id: number, data: Partial<HrContractType>) =>
    api.put<{ data: HrContractType; message: string }>(`/admin/hr-settings/contract-types/${id}`, data),
  deleteContractType: (id: number) =>
    api.delete<{ message: string }>(`/admin/hr-settings/contract-types/${id}`),

  // ── Leave Profiles ──────────────────────────────────────────────────────────
  listLeaveProfiles: () =>
    api.get<{ data: HrLeaveProfile[] }>("/admin/hr-settings/leave-profiles"),
  createLeaveProfile: (data: Partial<HrLeaveProfile>) =>
    api.post<{ data: HrLeaveProfile; message: string }>("/admin/hr-settings/leave-profiles", data),
  updateLeaveProfile: (id: number, data: Partial<HrLeaveProfile>) =>
    api.put<{ data: HrLeaveProfile; message: string }>(`/admin/hr-settings/leave-profiles/${id}`, data),
  deleteLeaveProfile: (id: number) =>
    api.delete<{ message: string }>(`/admin/hr-settings/leave-profiles/${id}`),

  // ── Allowance Profiles ──────────────────────────────────────────────────────
  listAllowanceProfiles: () =>
    api.get<{ data: HrAllowanceProfile[] }>("/admin/hr-settings/allowance-profiles"),
  createAllowanceProfile: (data: Partial<HrAllowanceProfile>) =>
    api.post<{ data: HrAllowanceProfile; message: string }>("/admin/hr-settings/allowance-profiles", data),
  updateAllowanceProfile: (id: number, data: Partial<HrAllowanceProfile>) =>
    api.put<{ data: HrAllowanceProfile; message: string }>(`/admin/hr-settings/allowance-profiles/${id}`, data),
  deleteAllowanceProfile: (id: number) =>
    api.delete<{ message: string }>(`/admin/hr-settings/allowance-profiles/${id}`),

  // ── Appraisal Templates ─────────────────────────────────────────────────────
  listAppraisalTemplates: () =>
    api.get<{ data: HrAppraisalTemplate[] }>("/admin/hr-settings/appraisal-templates"),
  createAppraisalTemplate: (data: Partial<HrAppraisalTemplate>) =>
    api.post<{ data: HrAppraisalTemplate; message: string }>("/admin/hr-settings/appraisal-templates", data),
  updateAppraisalTemplate: (id: number, data: Partial<HrAppraisalTemplate>) =>
    api.put<{ data: HrAppraisalTemplate; message: string }>(`/admin/hr-settings/appraisal-templates/${id}`, data),
  deleteAppraisalTemplate: (id: number) =>
    api.delete<{ message: string }>(`/admin/hr-settings/appraisal-templates/${id}`),

  // ── Personnel File Sections ─────────────────────────────────────────────────
  listPersonnelFileSections: () =>
    api.get<{ data: HrPersonnelFileSection[] }>("/admin/hr-settings/personnel-file-sections"),
  createPersonnelFileSection: (data: Partial<HrPersonnelFileSection>) =>
    api.post<{ data: HrPersonnelFileSection; message: string }>("/admin/hr-settings/personnel-file-sections", data),
  updatePersonnelFileSection: (id: number, data: Partial<HrPersonnelFileSection>) =>
    api.put<{ data: HrPersonnelFileSection; message: string }>(`/admin/hr-settings/personnel-file-sections/${id}`, data),
  deletePersonnelFileSection: (id: number) =>
    api.delete<{ message: string }>(`/admin/hr-settings/personnel-file-sections/${id}`),
  reorderPersonnelFileSections: (items: { id: number; sort_order: number }[]) =>
    api.post<{ message: string }>("/admin/hr-settings/personnel-file-sections/reorder", { items }),

  // ── Approval Matrix ─────────────────────────────────────────────────────────
  listApprovalMatrix: (params?: { module?: string }) =>
    api.get<{ data: HrApprovalMatrix[] }>("/admin/hr-settings/approval-matrix", { params }),
  createApprovalMatrixEntry: (data: Partial<HrApprovalMatrix>) =>
    api.post<{ data: HrApprovalMatrix; message: string }>("/admin/hr-settings/approval-matrix", data),
  updateApprovalMatrixEntry: (id: number, data: Partial<HrApprovalMatrix>) =>
    api.put<{ data: HrApprovalMatrix; message: string }>(`/admin/hr-settings/approval-matrix/${id}`, data),
  deleteApprovalMatrixEntry: (id: number) =>
    api.delete<{ message: string }>(`/admin/hr-settings/approval-matrix/${id}`),

  // ── Settings Audit Log ──────────────────────────────────────────────────────
  listHrSettingsAudit: (params?: { page?: number; per_page?: number }) =>
    api.get<any>("/admin/audit-logs", { params: { ...params, tags: "hr_settings" } }),
};

// ── ICRMS — Correspondence & Registry ────────────────────────────────────────

export interface CorrespondenceLetter {
  id: number;
  reference_number: string | null;
  title: string;
  subject: string;
  body: string | null;
  type: "internal_memo" | "external" | "diplomatic_note" | "procurement";
  priority: "low" | "normal" | "high" | "urgent";
  language: "en" | "fr" | "pt";
  status: "draft" | "pending_review" | "pending_approval" | "approved" | "sent" | "archived";
  direction: "outgoing" | "incoming";
  file_code: string | null;
  signatory_code: string | null;
  department_id: number | null;
  department?: { id: number; name: string };
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  review_comment: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: { id: number; name: string; email: string };
  reviewer?: { id: number; name: string } | null;
  approver?: { id: number; name: string } | null;
  recipients?: CorrespondenceRecipient[];
}

export interface CorrespondenceRecipient {
  id: number;
  contact_id: number;
  recipient_type: "to" | "cc" | "bcc";
  email_status: string | null;
  email_sent_at: string | null;
  contact?: CorrespondenceContact;
}

export interface CorrespondenceContact {
  id: number;
  full_name: string;
  organization: string | null;
  country: string | null;
  email: string;
  phone: string | null;
  stakeholder_type: string;
  tags: string[];
}

export interface ContactGroup {
  id: number;
  name: string;
  description: string | null;
  contacts_count?: number;
  contacts?: CorrespondenceContact[];
}

export const correspondenceApi = {
  // Letters
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<CorrespondenceLetter>>("/correspondence/letters", { params }),
  create: (formData: FormData) =>
    api.post<{ data: CorrespondenceLetter; message: string }>("/correspondence/letters", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  get: (id: number) =>
    api.get<{ data: CorrespondenceLetter }>(`/correspondence/letters/${id}`),
  update: (id: number, data: FormData | Partial<CorrespondenceLetter>) =>
    api.put<{ data: CorrespondenceLetter }>(`/correspondence/letters/${id}`, data),
  delete: (id: number) => api.delete(`/correspondence/letters/${id}`),
  submit: (id: number) => api.post(`/correspondence/letters/${id}/submit`),
  review: (id: number, data: { action: "approve" | "reject"; comment?: string }) =>
    api.post(`/correspondence/letters/${id}/review`, data),
  approve: (id: number) => api.post(`/correspondence/letters/${id}/approve`),
  send: (id: number, recipients: { contact_id: number; type: "to" | "cc" | "bcc" }[]) =>
    api.post(`/correspondence/letters/${id}/send`, { recipients }),
  download: (id: number) =>
    api.get(`/correspondence/letters/${id}/download`, { responseType: "blob" }),

  // Contacts
  listContacts: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<CorrespondenceContact>>("/correspondence/contacts", { params }),
  getContact: (id: number) =>
    api.get<{ data: CorrespondenceContact }>(`/correspondence/contacts/${id}`),
  createContact: (data: Partial<CorrespondenceContact>) =>
    api.post<{ data: CorrespondenceContact; message: string }>("/correspondence/contacts", data),
  updateContact: (id: number, data: Partial<CorrespondenceContact>) =>
    api.put<{ data: CorrespondenceContact; message: string }>(`/correspondence/contacts/${id}`, data),
  deleteContact: (id: number) => api.delete(`/correspondence/contacts/${id}`),

  // Groups
  listGroups: () => api.get<{ data: ContactGroup[] }>("/correspondence/groups"),
  createGroup: (data: { name: string; description?: string }) =>
    api.post<{ data: ContactGroup; message: string }>("/correspondence/groups", data),
  updateGroup: (id: number, data: { name?: string; description?: string }) =>
    api.put<{ data: ContactGroup; message: string }>(`/correspondence/groups/${id}`, data),
  deleteGroup: (id: number) => api.delete(`/correspondence/groups/${id}`),
  addMembers: (groupId: number, contactIds: number[]) =>
    api.post(`/correspondence/groups/${groupId}/members`, { contact_ids: contactIds }),
  removeMembers: (groupId: number, contactIds: number[]) =>
    api.delete(`/correspondence/groups/${groupId}/members`, { data: { contact_ids: contactIds } }),
};

// ─── SAAM — Signature & Approval Authentication Module ────────────────────────
export interface SignatureVersion {
  id: number;
  profile_id: number;
  version_no: number;
  hash: string;
  effective_from: string;
  revoked_at: string | null;
  image_url?: string;
}

export interface SignatureProfile {
  id: number;
  user_id: number;
  type: "full" | "initials";
  status: "active" | "revoked";
  active_version?: SignatureVersion;
}

export interface SignatureEvent {
  id: number;
  signable_type: string;
  signable_id: number;
  step_key: string | null;
  action: string;
  comment: string | null;
  auth_level: string;
  signed_at: string;
  is_delegated: boolean;
  document_hash: string | null;
  signer?: { id: number; name: string; job_title?: string };
  signature_version?: SignatureVersion;
  delegated_authority?: { id: number; principal?: { id: number; name: string } };
}

export interface DelegatedAuthority {
  id: number;
  tenant_id: number;
  principal_user_id: number;
  delegate_user_id: number;
  start_date: string;
  end_date: string;
  role_scope: string | null;
  reason: string | null;
  principal?: { id: number; name: string; email?: string };
  delegate?: { id: number; name: string; email?: string };
}

export interface SignedDocument {
  id: number;
  signable_type: string;
  signable_id: number;
  version: number;
  hash: string;
  finalized_at: string;
}

export const saamApi = {
  getProfile: () =>
    api.get<{ data: SignatureProfile[] }>("/saam/profile"),

  draw: (type: "full" | "initials", imageDataUrl: string) =>
    api.post<{ message: string; data: SignatureVersion }>("/saam/profile/draw", {
      type,
      image_data_url: imageDataUrl,
    }),

  upload: (type: "full" | "initials", file: File) => {
    const fd = new FormData();
    fd.append("type", type);
    fd.append("file", file);
    return api.post<{ message: string; data: SignatureVersion }>("/saam/profile/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  revoke: (type: "full" | "initials") =>
    api.delete(`/saam/profile/${type}`),

  signDocument: (
    signableType: string,
    signableId: number,
    data: {
      action: string;
      step_key?: string;
      comment?: string;
      signature_type?: "full" | "initials";
      confirm_password: string;
    }
  ) =>
    api.post<{ message: string; data: SignatureEvent }>(
      `/saam/sign/${signableType}/${signableId}`,
      data
    ),

  getEvents: (signableType: string, signableId: number) =>
    api.get<{ data: SignatureEvent[] }>(`/saam/events/${signableType}/${signableId}`),

  listDelegations: () =>
    api.get<{ data: { outgoing: DelegatedAuthority[]; incoming: DelegatedAuthority[] } }>(
      "/saam/delegations"
    ),

  createDelegation: (data: {
    delegate_user_id: number;
    start_date: string;
    end_date: string;
    role_scope?: string;
    reason?: string;
  }) =>
    api.post<{ message: string; data: DelegatedAuthority }>("/saam/delegations", data),

  revokeDelegation: (id: number) =>
    api.delete(`/saam/delegations/${id}`),

  getSignedDocument: (signableType: string, signableId: number) =>
    api.get<{ data: SignedDocument | null }>(`/saam/documents/${signableType}/${signableId}`),

  generateDocument: (signableType: string, signableId: number) =>
    api.post<{ message: string; data: SignedDocument }>(
      `/saam/documents/generate/${signableType}/${signableId}`
    ),

  downloadDocument: (documentId: number) =>
    api.get(`/saam/documents/download/${documentId}`, { responseType: "blob" }),

  /** Build the image URL for a signature version (served via the secure image endpoint) */
  signatureImageUrl: (versionId: number): string =>
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/saam/signature-image/${versionId}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// SRHR — Field Researcher Deployment & Reporting Module
// ─────────────────────────────────────────────────────────────────────────────

export interface Parliament {
  id: number;
  tenant_id: number;
  name: string;
  country_code: string;
  country_name: string;
  city: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  deployments_count?: number;
  active_deployments_count?: number;
  active_deployments?: Array<{
    id: number;
    employee: { id: number; name: string; email: string; job_title?: string | null };
  }>;
}

export interface StaffDeployment {
  id: number;
  tenant_id: number;
  employee_id: number;
  parliament_id: number;
  reference_number: string;
  deployment_type: "field_researcher" | "srhr_researcher" | "secondment" | "other";
  research_area: string | null;
  research_focus: string | null;
  start_date: string;
  end_date: string | null;
  status: "active" | "completed" | "recalled" | "suspended";
  supervisor_name: string | null;
  supervisor_title: string | null;
  supervisor_email: string | null;
  supervisor_phone: string | null;
  terms_of_reference: string | null;
  hr_managed_externally: boolean;
  payroll_active: boolean;
  notes: string | null;
  recalled_at: string | null;
  recalled_reason: string | null;
  created_at: string;
  employee?: { id: number; name: string; email: string; job_title?: string | null };
  parliament?: Parliament;
  created_by_user?: { id: number; name: string };
  reports_count?: number;
  reports?: ResearcherReport[];
}

export interface ResearcherReportActivity {
  title: string;
  description?: string;
  date?: string;
  outcome?: string;
}

export interface ResearcherReportAttachment {
  id: number;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  document_type: string;
  created_at: string;
  uploader?: { id: number; name: string };
}

export interface ResearcherReport {
  id: number;
  tenant_id: number;
  deployment_id: number;
  employee_id: number;
  parliament_id: number;
  reference_number: string;
  report_type: "monthly" | "quarterly" | "annual" | "ad_hoc";
  period_start: string;
  period_end: string;
  title: string;
  status: "draft" | "submitted" | "acknowledged" | "revision_requested" | "archived";
  executive_summary: string | null;
  activities_undertaken: ResearcherReportActivity[] | null;
  challenges_faced: string | null;
  recommendations: string | null;
  next_period_plan: string | null;
  srhr_indicators: Record<string, string | number> | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  revision_notes: string | null;
  created_at: string;
  employee?: { id: number; name: string; email: string };
  parliament?: Parliament;
  deployment?: StaffDeployment;
  acknowledged_by_user?: { id: number; name: string };
  attachments?: ResearcherReportAttachment[];
}

export const parliamentsApi = {
  list: (params?: {
    country_code?: string;
    is_active?: boolean;
    search?: string;
    per_page?: number;
    page?: number;
  }) =>
    api.get<PaginatedResponse<Parliament>>("/srhr/parliaments", { params }),

  get: (id: number) =>
    api.get<{ data: Parliament }>(`/srhr/parliaments/${id}`),

  create: (data: Partial<Parliament>) =>
    api.post<{ message: string; data: Parliament }>("/srhr/parliaments", data),

  update: (id: number, data: Partial<Parliament>) =>
    api.put<{ message: string; data: Parliament }>(`/srhr/parliaments/${id}`, data),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/srhr/parliaments/${id}`),
};

export const deploymentsApi = {
  list: (params?: {
    parliament_id?: number;
    employee_id?: number;
    status?: string;
    deployment_type?: string;
    search?: string;
    per_page?: number;
    page?: number;
  }) =>
    api.get<PaginatedResponse<StaffDeployment>>("/srhr/deployments", { params }),

  get: (id: number) =>
    api.get<{ data: StaffDeployment }>(`/srhr/deployments/${id}`),

  create: (data: {
    employee_id: number;
    parliament_id: number;
    deployment_type?: string;
    research_area?: string;
    research_focus?: string;
    start_date: string;
    end_date?: string | null;
    supervisor_name?: string;
    supervisor_title?: string;
    supervisor_email?: string;
    supervisor_phone?: string;
    terms_of_reference?: string;
    payroll_active?: boolean;
    notes?: string;
  }) =>
    api.post<{ message: string; data: StaffDeployment }>("/srhr/deployments", data),

  update: (id: number, data: Partial<StaffDeployment>) =>
    api.put<{ message: string; data: StaffDeployment }>(`/srhr/deployments/${id}`, data),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/srhr/deployments/${id}`),

  recall: (id: number, recalled_reason: string) =>
    api.post<{ message: string; data: StaffDeployment }>(`/srhr/deployments/${id}/recall`, { recalled_reason }),

  complete: (id: number) =>
    api.post<{ message: string; data: StaffDeployment }>(`/srhr/deployments/${id}/complete`),
};

export const researcherReportsApi = {
  list: (params?: {
    deployment_id?: number;
    parliament_id?: number;
    employee_id?: number;
    status?: string;
    report_type?: string;
    search?: string;
    per_page?: number;
    page?: number;
  }) =>
    api.get<PaginatedResponse<ResearcherReport>>("/srhr/reports", { params }),

  get: (id: number) =>
    api.get<{ data: ResearcherReport }>(`/srhr/reports/${id}`),

  create: (data: {
    deployment_id: number;
    report_type: string;
    period_start: string;
    period_end: string;
    title: string;
    executive_summary?: string;
    activities_undertaken?: ResearcherReportActivity[];
    challenges_faced?: string;
    recommendations?: string;
    next_period_plan?: string;
    srhr_indicators?: Record<string, string | number>;
  }) =>
    api.post<{ message: string; data: ResearcherReport }>("/srhr/reports", data),

  update: (id: number, data: Partial<ResearcherReport>) =>
    api.put<{ message: string; data: ResearcherReport }>(`/srhr/reports/${id}`, data),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/srhr/reports/${id}`),

  submit: (id: number) =>
    api.post<{ message: string; data: ResearcherReport }>(`/srhr/reports/${id}/submit`),

  acknowledge: (id: number) =>
    api.post<{ message: string; data: ResearcherReport }>(`/srhr/reports/${id}/acknowledge`),

  requestRevision: (id: number, revision_notes: string) =>
    api.post<{ message: string; data: ResearcherReport }>(`/srhr/reports/${id}/request-revision`, { revision_notes }),

  listAttachments: (id: number) =>
    api.get<{ data: ResearcherReportAttachment[] }>(`/srhr/reports/${id}/attachments`),

  uploadAttachment: (id: number, file: File, document_type?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (document_type) form.append("document_type", document_type);
    return api.post<{ message: string; data: ResearcherReportAttachment }>(
      `/srhr/reports/${id}/attachments`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  deleteAttachment: (reportId: number, attachmentId: number) =>
    api.delete(`/srhr/reports/${reportId}/attachments/${attachmentId}`),

  downloadAttachment: (reportId: number, attachmentId: number, filename: string) =>
    api
      .get(`/srhr/reports/${reportId}/attachments/${attachmentId}/download`, { responseType: "blob" })
      .then((res) => {
        const url = URL.createObjectURL(res.data as Blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }),
};
