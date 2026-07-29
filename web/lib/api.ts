import axios from "axios";
import { clearStoredUser } from "@/lib/session";
import { captureClientException } from "@/lib/observability";
import { MFA_SETUP_PATH } from "@/lib/privilegedMfa";

const MUST_RESET_COOKIE = "sadcpf_must_reset";
const COOKIE_MAX_AGE_DAYS = 7;

export function setMustResetCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${MUST_RESET_COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE_DAYS * 86400}; SameSite=Lax`;
}

export function clearMustResetCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${MUST_RESET_COOKIE}=; path=/; max-age=0`;
}

const SETUP_COMPLETE_COOKIE = "sadcpf_setup_complete";

export function setSetupCompleteCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SETUP_COMPLETE_COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE_DAYS * 86400}; SameSite=Lax`;
}

export function clearSetupCompleteCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SETUP_COMPLETE_COOKIE}=; path=/; max-age=0`;
}

const AUTH_COOKIE = "sadcpf_authenticated";

export function setAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE_DAYS * 86400}; SameSite=Lax`;
}

export function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
}

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// FormData + default application/json makes axios JSON.stringify the body
// (File → {}), which Laravel rejects as "The file field is required."
// Drop Content-Type so the browser sets multipart/form-data with boundary.
api.interceptors.request.use((config) => {
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    const headers = config.headers;
    if (headers && typeof headers.setContentType === "function") {
      headers.setContentType(false);
    } else if (headers) {
      delete (headers as Record<string, unknown>)["Content-Type"];
      delete (headers as Record<string, unknown>)["content-type"];
    }
  }
  return config;
});

// In-memory token cache — avoids synchronous localStorage read on every request
let csrfBootstrapped = false;

export async function ensureCsrfCookie(): Promise<void> {
  if (csrfBootstrapped) return;
  await axios.get("/sanctum/csrf-cookie", { withCredentials: true });
  csrfBootstrapped = true;
}

// Handle 401 globally — flag prevents concurrent 401s from firing multiple hard reloads
let _redirecting401 = false;
let _redirectingMfaSetup = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      const status = error.response?.status;
      const data = error.response?.data as { mfa_setup_required?: boolean; message?: string } | undefined;

      // Privileged role without MFA — send user to security setup (API middleware).
      // Skip background notification polls and any call already on the security page.
      if (
        status === 403 &&
        data?.mfa_setup_required === true &&
        !_redirectingMfaSetup &&
        !window.location.pathname.startsWith(MFA_SETUP_PATH)
      ) {
        const failedUrl = (error.config?.url ?? "").toString();
        const isBackgroundNoise =
          failedUrl.includes("/notifications") ||
          failedUrl.includes("unread-count");
        if (!isBackgroundNoise) {
          _redirectingMfaSetup = true;
          window.location.href = MFA_SETUP_PATH;
        }
        return Promise.reject(error);
      }

      if (status === 401) {
        const path = window.location.pathname;
        // Public auth flows (forgot / request / email-token reset) must stay put
        // when a background /auth/me 401 fires — otherwise the form never loads.
        const isPublicAuthPath =
          path.startsWith("/login") ||
          path.startsWith("/forgot-password") ||
          path.startsWith("/request-password") ||
          path.startsWith("/activate-account") ||
          path.startsWith("/reset-password") ||
          path.startsWith("/setup") ||
          path.startsWith("/approval") ||
          path.startsWith("/supplier");

        if (!isPublicAuthPath && !_redirecting401) {
          _redirecting401 = true;
          clearStoredUser();
          clearAuthCookie();

          // Best-effort: invalidate the server-side session so Laravel emits a
          // Set-Cookie that wipes the httpOnly session cookie. Without this the
          // proxy could still see a stale session cookie and bounce us back.
          // Skip when the failing request was already /auth/logout to avoid
          // recursion.
          const failedUrl = (error.config?.url ?? "").toString();
          if (!failedUrl.includes("/auth/logout")) {
            // Fire-and-forget — don't block the redirect.
            axios.post("/api/v1/auth/logout", null, { withCredentials: true })
              .catch(() => { /* ignore — session is already invalid */ });
          }

          window.location.href = "/login";
        }
      } else if (status && status >= 500) {
        captureClientException(error, { status, url: error.config?.url });
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Typed API helpers
export const authApi = {
  login: async (email: string, password: string, code?: string) => {
    await ensureCsrfCookie();
    // Omit `code` entirely unless it is a valid 6-digit TOTP string — sending
    // `code: undefined` or empty string can make Laravel's optional `digits:6`
    // rule fail depending on JSON shape, and trimming email avoids 422 on
    // validation from whitespace.
    const trimmedEmail = email.trim();
    const body: Record<string, string> = {
      email: trimmedEmail,
      password,
      client_type: "browser",
      device_name: "web",
    };
    const c = code?.trim();
    if (c && /^\d{6}$/.test(c)) body.code = c;
    return api.post<{ user?: AuthUser; mfa_required?: boolean; message?: string }>("/auth/login", body);
  },
  logout: () => api.post("/auth/logout"),
  me: () => api.get<AuthUser>("/auth/me"),
  forgotPassword: async (email: string) => {
    await ensureCsrfCookie();
    return api.post<{ message: string }>("/auth/forgot-password", { email: email.trim() });
  },
  requestAccess: async (data: {
    full_name: string;
    official_email: string;
    position_title?: string;
    department_name?: string;
    supervisor_name?: string;
    reason?: string;
  }) => {
    await ensureCsrfCookie();
    return api.post<{ message: string }>("/auth/access-request", {
      ...data,
      official_email: data.official_email.trim(),
    });
  },
  getInvitation: async (token: string) =>
    api.get<{ data: { email: string; name?: string | null; expires_at?: string | null } }>(
      `/auth/invitations/${encodeURIComponent(token)}`
    ),
  activateInvitation: async (token: string, password: string, passwordConfirmation: string) => {
    await ensureCsrfCookie();
    return api.post<{ message: string }>(`/auth/invitations/${encodeURIComponent(token)}/activate`, {
      password,
      password_confirmation: passwordConfirmation,
      accepted_notices: true,
    });
  },
  resetPassword: async (token: string, email: string, password: string, passwordConfirmation: string) => {
    await ensureCsrfCookie();
    return api.post<{ message: string }>("/auth/reset-password", {
      token,
      email: email.trim(),
      password,
      password_confirmation: passwordConfirmation,
    });
  },
  forceResetPassword: async (password: string, passwordConfirmation: string) => {
    await ensureCsrfCookie();
    return api.post<{ message: string }>("/auth/force-reset-password", {
      password,
      password_confirmation: passwordConfirmation,
    });
  },
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
  vendor_id?: number | null;
  classification: string;
  account_status?: string;
  mfa_enabled?: boolean;
  must_reset_password?: boolean;
  setup_completed?: boolean;
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
  account_status?: string;
  latest_account_invitation?: {
    id: number;
    status: string;
    expires_at: string;
  } | null;
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

export interface AccessRequest {
  id: number;
  full_name: string;
  official_email: string;
  position_title?: string | null;
  department_name?: string | null;
  supervisor_name?: string | null;
  reason?: string | null;
  status: string;
  reviewed_at?: string | null;
  review_comment?: string | null;
  created_at?: string;
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
  step_name?: string | null;
  approver_type: 'supervisor' | 'up_the_chain' | 'specific_role' | 'specific_user';
  role_id?: number | null;
  user_id?: number | null;
  role?: { id: number; name: string };
  user?: User;
  allow_return: boolean;
  allow_reject: boolean;
  allow_delegate: boolean;
  sla_hours?: number | null;
  requires_comment: boolean;
}

export interface ApprovalRequest {
  id: number;
  approvable_type: string;
  approvable_id: number;
  workflow_id: number;
  current_step_index: number;
  status: 'pending' | 'approved' | 'rejected' | 'returned' | 'withdrawn';
  returned_count: number;
  created_at: string;
  approvable?: any;
  workflow?: ApprovalWorkflow;
  history?: ApprovalHistory[];
}

export interface ApprovalHistory {
  id: number;
  approval_request_id: number;
  user_id: number;
  step_index: number | null;
  action: 'approve' | 'reject' | 'return' | 'withdraw' | 'delegate' | 'resubmit';
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
  bulkDeactivateUsers: (ids: number[]) =>
    api.post<{
      message: string;
      deactivated: number[];
      deactivated_count: number;
      skipped: { id: number; reason: string }[];
      skipped_count: number;
    }>("/admin/users/bulk-deactivate", { ids }),
  reactivateUser: (id: number) => api.post(`/admin/users/${id}/reactivate`),
  changeUserPassword: (id: number, _password?: string, _passwordConfirmation?: string) =>
    api.post<{ message: string }>(`/admin/users/${id}/password-reset`),
  resendUserInvitation: (id: number) =>
    api.post<{ message: string; user: User }>(`/admin/users/${id}/resend-invitation`),
  updateUserStatus: (id: number, data: { status: string; reason?: string }) =>
    api.patch<{ message: string; user: User }>(`/admin/users/${id}/status`, data),
  getUserAudit: (id: number) => api.get(`/admin/users/${id}/audit`),
  listAccessRequests: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<AccessRequest>>("/admin/access-requests", { params }),
  approveAccessRequest: (id: number, data: {
    role: string;
    department_id?: number | null;
    employee_number?: string;
    job_title?: string;
    classification?: string;
    review_comment?: string;
  }) => api.post<{ message: string; user: User }>(`/admin/access-requests/${id}/approve`, data),
  rejectAccessRequest: (id: number, reason: string) =>
    api.post<{ message: string }>(`/admin/access-requests/${id}/reject`, { reason }),

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

  // Holiday Calendars
  listHolidayCalendars: () =>
    api.get<{ data: HolidayCalendar[] }>("/admin/holiday-calendars"),
  createHolidayCalendar: (data: { name: string; country_code?: string; is_default?: boolean }) =>
    api.post<{ data: HolidayCalendar; message: string }>("/admin/holiday-calendars", data),
  updateHolidayCalendar: (id: number, data: { name?: string; country_code?: string; is_default?: boolean }) =>
    api.put<{ data: HolidayCalendar; message: string }>(`/admin/holiday-calendars/${id}`, data),
  deleteHolidayCalendar: (id: number) =>
    api.delete(`/admin/holiday-calendars/${id}`),
  listHolidayDates: (calendarId: number, params?: { year?: number }) =>
    api.get<{ data: HolidayDate[] }>(`/admin/holiday-calendars/${calendarId}/dates`, { params }),
  bulkUpsertHolidayDates: (calendarId: number, dates: HolidayDateInput[]) =>
    api.post<{ data: HolidayDate[]; message: string }>(`/admin/holiday-calendars/${calendarId}/dates`, { dates }),
  deleteHolidayDate: (calendarId: number, dateId: number) =>
    api.delete(`/admin/holiday-calendars/${calendarId}/dates/${dateId}`),
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

// ─── Setup Wizard ─────────────────────────────────────────────────────────────

export interface SetupOptions {
  departments: { id: number; name: string; code: string }[];
  positions: { id: number; department_id: number; title: string; grade: string | null }[];
}

export const setupApi = {
  getOptions: () =>
    api.get<SetupOptions>("/setup/options"),
  updateIdentity: (data: {
    name: string;
    email: string;
    employee_number?: string | null;
    department_id?: number | null;
    position_id?: number | null;
  }) =>
    api.put<{ message: string; user: User }>("/setup/identity", data),
  complete: () =>
    api.post<{ message: string; setup_completed: boolean }>("/setup/complete"),
};

// ─── Profile Sessions ──────────────────────────────────────────────────────────

export interface UserSession {
  id: number;
  device: string;
  ip_address: string | null;
  last_active_at: string | null;
  created_at: string;
  is_current: boolean;
}

export const profileSessionsApi = {
  list: () => api.get<{ data: UserSession[] }>("/profile/sessions"),
  revoke: (id: number) => api.delete<{ message: string }>(`/profile/sessions/${id}`),
  revokeOthers: () => api.delete<{ message: string }>("/profile/sessions/others"),
};

// ─── Two-Factor Authentication ──────────────────────────────────────────────

export interface TwoFactorSetup {
  secret: string;
  qr_code_url: string;
}

export const twoFactorApi = {
  status: () => api.get<{ enabled: boolean }>("/profile/2fa/status"),
  enable: () => api.post<TwoFactorSetup>("/profile/2fa/enable"),
  confirm: (code: string) => api.post<{ message: string; enabled: boolean }>("/profile/2fa/confirm", { code }),
  disable: (password: string) => api.post<{ message: string; enabled: boolean }>("/profile/2fa/disable", { password }),
  verify: (code: string) => api.post<{ message: string; valid: boolean }>("/profile/2fa/verify", { code }),
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
  estimated_dsa: number | null;
  actual_dsa?: number | null;
  finance_dsa_total?: number | null;
  finance_status?: string | null;
  meal_deduction_total?: number | null;
  terminal_comms_total?: number | null;
  retirement_status?: string | null;
  retirement_due_at?: string | null;
  cabin_class?: string | null;
  host_organization?: string | null;
  vehicle_type?: string | null;
  programme_id?: number | null;
  mission_id?: number | null;
  prepared_by?: number | null;
  prepared_on_behalf_of?: number | null;
  is_emergency?: boolean;
  booking_committed_at?: string | null;
  currency: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "cancelled" | "returned_for_correction" | "withdrawn" | "resubmitted" | "amendment_pending";
  justification: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  requester?: User;
  approver?: User;
  workflow_stage?: string | null;
  workflow_status?: string | null;
  pending_with?: string[];
  pending_with_label?: string | null;
  itineraries?: TravelItinerary[];
  funding_lines?: { id: number; item: string; forum_amount: number; host_amount: number }[];
  dsa_lines?: TravelDsaLine[];
  amendments?: TravelAmendment[];
  imprest_requests?: Array<{ id: number; reference_number?: string; status?: string }>;
  vehicle_asset_id?: number | null;
  returned_at?: string | null;
  director_finance_confirmed_at?: string | null;
  visa_required?: boolean;
  visa_status?: string | null;
  visa_expiry_date?: string | null;
  visa_appointment_date?: string | null;
  visa_notes?: string | null;
  itinerary_version?: number;
  health_vaccination_required?: boolean;
  health_vaccination_status?: string | null;
  health_prophylaxis_required?: boolean;
  health_prophylaxis_status?: string | null;
  health_estimated_cost?: number | null;
  health_notes?: string | null;
  health_cleared_at?: string | null;
  procurement_request_id?: number | null;
  procurement_link_reason?: string | null;
  procurement_link_required?: boolean;
  procurement_link_suggested?: boolean;
  procurement_request?: { id: number; reference_number: string; title?: string } | null;
  mission?: { id: number; title: string } | null;
}

export interface TravelDsaLine {
  id?: number;
  date: string;
  destination?: string | null;
  rate_type: number;
  daily_rate: number;
  meal_deduction: number;
  adjustments: number;
  daily_payable?: number;
  is_personal?: boolean;
  notes?: string | null;
}

export interface TravelMission {
  id: number;
  title: string;
  destination_country?: string | null;
  destination_city?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  programme_id?: number | null;
  requests_count?: number;
  summary?: { travellers: number; ready: number; pending: number };
  travellers?: TravelMissionTraveller[];
}

export interface TravelMissionTraveller {
  travel_request_id: number;
  reference_number: string;
  traveller?: string | null;
  status: string;
  ticket: boolean;
  visa: boolean;
  hotel: boolean;
  dsa: boolean;
  ready: boolean;
  visa_status?: string | null;
  finance_status?: string | null;
  finance_dsa_total?: number | null;
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

export interface TravelAmendment {
  id: number;
  travel_request_id: number;
  created_by: number;
  status: string;
  proposed_changes: Record<string, unknown>;
  original_snapshot?: Record<string, unknown> | null;
  reason?: string | null;
  creator?: User;
  created_at?: string;
}

// ─── Generic Attachment ────────────────────────────────────────────────────

export interface ModuleAttachment {
  id: number;
  document_type: string | null;
  original_filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: number;
  uploader?: { id: number; name: string };
  created_at: string;
  updated_at: string;
}

export const TRAVEL_DOCUMENT_TYPES = [
  { value: "invitation",         label: "Invitation Letter" },
  { value: "agenda",             label: "Agenda / Programme" },
  { value: "concept_note",       label: "Concept Note" },
  { value: "approved_pif",       label: "Approved PIF" },
  { value: "travel_itinerary",   label: "Travel Itinerary" },
  { value: "visa_copy",          label: "Visa Copy" },
  { value: "flight_ticket",      label: "Flight Ticket" },
  { value: "hotel_booking",      label: "Hotel Booking" },
  { value: "travel_insurance",   label: "Travel Insurance" },
  { value: "donor_correspondence", label: "Donor Correspondence" },
  { value: "funding_confirmation", label: "Funding Confirmation" },
  { value: "mission_report",     label: "Mission Report" },
  { value: "receipt",            label: "Receipt" },
  { value: "other",              label: "Other" },
] as const;

export const LEAVE_DOCUMENT_TYPES = [
  { value: "medical_certificate", label: "Medical Certificate" },
  { value: "leave_supporting",    label: "Supporting Document" },
  { value: "other",               label: "Other" },
] as const;

export const travelApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<TravelRequest>>("/travel/requests", { params }),
  get: (id: number) => api.get<TravelRequest>(`/travel/requests/${id}`),
  create: (data: Omit<Partial<TravelRequest>, "itineraries"> & { itineraries?: Partial<TravelItinerary>[] }) =>
    api.post<{ data: TravelRequest; message: string }>("/travel/requests", data),
  update: (id: number, data: Omit<Partial<TravelRequest>, "itineraries"> & { itineraries?: Partial<TravelItinerary>[] }) =>
    api.put<{ data: TravelRequest; message: string }>(`/travel/requests/${id}`, data),
  delete: (id: number) => api.delete(`/travel/requests/${id}`),
  submit: (id: number, data?: { acknowledge_conflicts?: boolean; conflict_resolution_note?: string }) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/submit`, data ?? {}),
  approve: (id: number, comment?: string) =>
    api.post<{ data: TravelRequest; message: string; notified_approvers: string[] }>(`/travel/requests/${id}/approve`, comment ? { comment } : {}),
  reject: (id: number, reason: string) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/reject`, { reason }),
  returnForCorrection: (id: number, comment: string) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/return`, { comment }),
  withdraw: (id: number) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/withdraw`),
  resubmit: (id: number) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/resubmit`),
  certificate: (id: number) =>
    api.get<{ data: TravelRequest }>(`/travel/requests/${id}/certificate`),
  pdfUrl: (id: number) =>
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/travel/requests/${id}/pdf`,
  travelPackUrl: (id: number) =>
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/travel/requests/${id}/travel-pack`,
  dashboardTraveller: () => api.get<{ data: Record<string, number> }>("/travel/dashboards/traveller"),
  dashboardAdmin: () => api.get<{ data: Record<string, number> }>("/travel/dashboards/admin"),
  dashboardFinance: () => api.get<{ data: Record<string, unknown> }>("/travel/dashboards/finance"),
  calendar: (params?: { from?: string; to?: string }) =>
    api.get<{ data: Array<Record<string, unknown>> }>("/travel/calendar", { params }),
  reportsPack: () => api.get<{ data: Record<string, unknown> }>("/travel/reports/pack"),
  reportsPackExportUrl: (slice: string) =>
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/travel/reports/pack/export?slice=${encodeURIComponent(slice)}&format=csv`,
  travellers: () => api.get<{ data: Array<{ id: number; name: string; email?: string }> }>("/travel/travellers"),
  fleetVehicles: () => api.get<{ data: Array<{ id: number; asset_code: string; name: string; status: string }> }>("/travel/fleet-vehicles"),
  assignVehicle: (id: number, data: { vehicle_asset_id: number; acknowledge_conflicts?: boolean; conflict_resolution_note?: string }) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/assign-vehicle`, data),
  updatePersonalDays: (id: number, days: Array<{ date: string; type: "official" | "personal" }>) =>
    api.patch<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/personal-days`, { days }),
  linkImprest: (id: number, data?: Record<string, unknown>) =>
    api.post<{ data: { id: number; travel_request_id?: number; reference_number?: string }; message: string }>(`/travel/requests/${id}/link-imprest`, data ?? {}),
  cancel: (id: number, reason: string) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/cancel`, { reason }),
  listSponsoredRates: () =>
    api.get<{ data: Array<Record<string, unknown>> }>("/travel/sponsored-deduction-rates"),
  saveSponsoredRate: (data: Record<string, unknown>) =>
    api.post<{ data: Record<string, unknown>; message: string }>("/travel/sponsored-deduction-rates", data),
  addAccommodation: (id: number, data: Record<string, unknown>) =>
    api.post<{ data: unknown; message: string }>(`/travel/requests/${id}/accommodations`, data),
  updateVehicleMileage: (id: number, data: Record<string, unknown>) =>
    api.patch<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/vehicle-mileage`, data),
  // Attachments
  listAttachments: (id: number) =>
    api.get<{ data: ModuleAttachment[] }>(`/travel/requests/${id}/attachments`),
  uploadAttachment: (id: number, file: File, documentType: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("document_type", documentType);
    return api.post<{ data: ModuleAttachment; message: string }>(
      `/travel/requests/${id}/attachments`,
      fd,
      // Explicit multipart so we never inherit application/json defaults.
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  },
  deleteAttachment: (id: number, attachmentId: number) =>
    api.delete(`/travel/requests/${id}/attachments/${attachmentId}`),
  downloadAttachmentUrl: (id: number, attachmentId: number) =>
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/travel/requests/${id}/attachments/${attachmentId}/download`,
  saveDsa: (id: number, data: Record<string, unknown>) =>
    api.post<{ data: TravelRequest; message: string; warning?: unknown }>(`/travel/requests/${id}/dsa`, data),
  confirmFunds: (id: number, remarks?: string) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/confirm-funds`, remarks ? { remarks } : {}),
  markBooked: (id: number, data?: { emergency_commit?: boolean; emergency_reason?: string }) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/mark-booked`, data ?? {}),
  markReturned: (id: number) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/mark-returned`),
  completeRetirement: (id: number) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/complete-retirement`),
  requestAmendment: (id: number, data: { changes: Record<string, unknown>; reason?: string }) =>
    api.post<{ data: TravelAmendment; message: string }>(`/travel/requests/${id}/amendments`, data),
  approveAmendment: (amendmentId: number) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/amendments/${amendmentId}/approve`),
  updateVisa: (id: number, data: Record<string, unknown>) =>
    api.patch<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/visa`, data),
  registerExport: (params?: Record<string, string | number>) =>
    api.get<{ data: Record<string, unknown>[] }>("/travel/register/export", { params }),
  listDsaRates: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<unknown>>("/travel/dsa-rates", { params }),
  saveDsaRate: (data: Record<string, unknown>) =>
    api.post<{ data: unknown; message: string }>("/travel/dsa-rates", data),
  listToil: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<unknown>>("/travel/toil", { params }),
  toilAuthoriseOt: (id: number) => api.post(`/travel/toil/${id}/authorise-ot`),
  toilConfirmDuty: (id: number) => api.post(`/travel/toil/${id}/confirm-duty`),
  toilHrValidate: (id: number) => api.post(`/travel/toil/${id}/hr-validate`),
  toilReject: (id: number, reason: string) => api.post(`/travel/toil/${id}/reject`, { reason }),
  toilExtend: (id: number, payload?: { expires_at?: string; reason: string }) =>
    api.post(`/travel/toil/${id}/extend`, payload ?? { reason: "SG extension" }),
  listMissions: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<TravelMission>>("/travel/missions", { params }),
  getMission: (id: number) =>
    api.get<{ data: TravelMission }>(`/travel/missions/${id}`),
  analyticsSummary: () =>
    api.get<{ data: {
      by_status: Record<string, number>;
      cost_by_programme: { programme_id: number; programme_title?: string; programme_reference?: string; travel_count: number; dsa_total: number }[];
      cost_by_funding_agency: { funding_agency: string; amount_total: number; travel_count: number }[];
      totals: { requests: number; finance_dsa_total: number; estimated_dsa_total: number };
    } }>("/travel/analytics/summary"),
  visaReminders: () =>
    api.get<{ data: TravelRequest[] }>("/travel/visa-reminders"),
  parseItinerary: (id: number, raw_text: string) =>
    api.post<{ data: { parseable: boolean; legs: Record<string, unknown>[]; message?: string | null } }>(
      `/travel/requests/${id}/parse-itinerary`,
      { raw_text }
    ),
  applyItinerary: (id: number, raw_text: string) =>
    api.post<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/apply-itinerary`, { raw_text }),
  updateHealth: (id: number, data: Record<string, unknown>) =>
    api.patch<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/health`, data),
  updateProcurementLink: (id: number, data: Record<string, unknown>) =>
    api.patch<{ data: TravelRequest; message: string }>(`/travel/requests/${id}/procurement-link`, data),
  listFxRates: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<unknown>>("/travel/fx-rates", { params }),
  saveFxRate: (data: Record<string, unknown>) =>
    api.post<{ data: unknown; message: string }>("/travel/fx-rates", data),
};

// ─── Imprest ─────────────────────────────────────────────────────────────────

export interface ImprestRequest {
  id: number;
  reference_number: string;
  budget_line: string;
  budget_line_id?: number | null;
  amount_requested: number;
  amount_approved: number | null;
  amount_liquidated: number | null;
  currency: string;
  expected_liquidation_date: string;
  purpose: string;
  justification: string | null;
  status: "draft" | "submitted" | "approved" | "rejected" | "liquidated" | "returned_for_correction" | "withdrawn";
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  liquidated_at: string | null;
  created_at: string;
  requester?: User;
  approver?: User;
  org_budget_line?: OrgBudgetLine | null;
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
  approve: (id: number, amount_approved?: number, comment?: string) =>
    api.post<{ data: ImprestRequest; message: string; notified_approvers: string[] }>(`/imprest/requests/${id}/approve`, { amount_approved, comment }),
  reject: (id: number, reason: string) =>
    api.post<{ data: ImprestRequest; message: string }>(`/imprest/requests/${id}/reject`, { reason }),
  returnForCorrection: (id: number, comment: string) =>
    api.post<{ data: ImprestRequest; message: string }>(`/imprest/requests/${id}/return`, { comment }),
  withdraw: (id: number) =>
    api.post<{ data: ImprestRequest; message: string }>(`/imprest/requests/${id}/withdraw`),
  resubmit: (id: number) =>
    api.post<{ data: ImprestRequest; message: string }>(`/imprest/requests/${id}/resubmit`),
  certificate: (id: number) =>
    api.get<{ data: ImprestRequest }>(`/imprest/requests/${id}/certificate`),
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
  asset_class?: string | null;
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
  serial_number?: string | null;
  tag_number?: string | null;
  acknowledgement_at?: string | null;
  funding_source?: string | null;
  book_value?: number | null;
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
  list: (params?: { assigned_to?: string; category?: string; status?: string; search?: string; per_page?: number; page?: number }) =>
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
  capitalise: (id: number, data: {
    asset_code?: string;
    category: string;
    purchase_date: string;
    purchase_value: number;
    useful_life_years?: number;
    salvage_value?: number;
    depreciation_method?: string;
    notes?: string;
    asset_class?: string;
    force_controlled?: boolean;
    serial_number?: string;
    tag_number?: string;
    allow_serial_duplicate?: boolean;
    funding_source?: string;
    location_id?: number;
  }) => api.post<{ data: Asset; message: string }>(`/assets/${id}/capitalise`, data),
  rejectCapitalisation: (id: number, data: { reason: string }) =>
    api.post<{ data: Asset; message: string }>(`/assets/${id}/reject-capitalisation`, data),
  assign: (id: number, data: { assigned_to: number; department?: string; location_id?: number; notes?: string }) =>
    api.post<{ data: Asset; message: string }>(`/assets/${id}/assign`, data),
  acknowledge: (id: number) =>
    api.post<{ data: Asset; message: string }>(`/assets/${id}/acknowledge`, {}),
  transfer: (id: number, data: { to_user_id: number; department?: string; location_id?: number; notes?: string }) =>
    api.post<{ data: Asset; message: string }>(`/assets/${id}/transfer`, data),
  returnAsset: (id: number, data?: { location_id?: number; notes?: string }) =>
    api.post<{ data: Asset; message: string }>(`/assets/${id}/return`, data ?? {}),
  uploadInvoice: (assetId: number, file: File) => {
    const formData = new FormData();
    formData.append("invoice", file);
    return api.post<Asset>(`/assets/${assetId}/invoice`, formData);
  },
  insurancePolicies: (params?: Record<string, string | number>) =>
    api.get<{ success: boolean; data: AssetInsurancePolicy[] }>("/assets-meta/insurance/policies", { params }),
  createInsurancePolicy: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; data: AssetInsurancePolicy }>("/assets-meta/insurance/policies", data),
  updateInsurancePolicy: (id: number, data: Record<string, unknown>) =>
    api.put<{ success: boolean; data: AssetInsurancePolicy }>(`/assets-meta/insurance/policies/${id}`, data),
  insuranceClaims: (params?: Record<string, string | number>) =>
    api.get<{ success: boolean; data: AssetInsuranceClaim[] }>("/assets-meta/insurance/claims", { params }),
  createInsuranceClaim: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; data: AssetInsuranceClaim }>("/assets-meta/insurance/claims", data),
  updateInsuranceClaim: (id: number, data: Record<string, unknown>) =>
    api.put<{ success: boolean; data: AssetInsuranceClaim }>(`/assets-meta/insurance/claims/${id}`, data),
};

export interface AssetInsurancePolicy {
  id: number;
  policy_number: string;
  insurer_name: string;
  coverage_type: string;
  effective_from: string;
  effective_to: string;
  sum_insured?: number | null;
  premium_amount?: number | null;
  currency: string;
  status: string;
  asset_id?: number | null;
  notes?: string | null;
  asset?: { id: number; asset_code: string; name: string } | null;
  claims?: AssetInsuranceClaim[];
}

export interface AssetInsuranceClaim {
  id: number;
  policy_id: number;
  asset_id?: number | null;
  claim_number: string;
  incident_date: string;
  filed_at?: string | null;
  claim_amount?: number | null;
  settled_amount?: number | null;
  currency: string;
  status: string;
  description?: string | null;
  outcome_notes?: string | null;
  policy?: { id: number; policy_number: string; insurer_name: string } | null;
  asset?: { id: number; asset_code: string; name: string } | null;
}

export const assetRequestsApi = {
  list: (params?: { per_page?: number; page?: number }) =>
    api.get<PaginatedResponse<AssetRequest>>("/asset-requests", { params }),
  create: (data: { justification: string; document_path?: string }) =>
    api.post<AssetRequest>("/asset-requests", data),
};

// ─── Asset Movements ──────────────────────────────────────────────────────────

export interface AssetMovement {
  id: number;
  tenant_id: number;
  asset_id: number;
  from_user_id: number | null;
  to_user_id: number | null;
  recorded_by: number;
  movement_type: "transfer" | "maintenance" | "disposal" | "storage" | "return";
  reason: string | null;
  notes: string | null;
  movement_date: string;
  created_at: string;
  asset?: Pick<Asset, "id" | "asset_code" | "name" | "category">;
  from_user?: Pick<User, "id" | "name" | "email"> | null;
  to_user?: Pick<User, "id" | "name" | "email"> | null;
  recorder?: Pick<User, "id" | "name" | "email">;
}

export const assetMovementsApi = {
  list: (params?: { asset_id?: number; movement_type?: string; per_page?: number; page?: number }) =>
    api.get<PaginatedResponse<AssetMovement>>("/assets/movements/list", { params }),
  create: (data: {
    asset_id: number;
    from_user_id?: number;
    to_user_id?: number;
    movement_type: AssetMovement["movement_type"];
    reason?: string;
    notes?: string;
    movement_date: string;
  }) => api.post<{ data: AssetMovement; message: string }>("/assets/movements", data),
  get: (id: number) => api.get<AssetMovement>(`/assets/movements/${id}`),
};

// ─── Consumables / Stock Register (separate from Fixed Assets) ────────────────

export interface StockCategory {
  id: number;
  tenant_id: number;
  name: string;
  code: string;
  sort_order: number;
  items_count?: number;
}

export interface StockUnit {
  id: number;
  tenant_id: number;
  code: string;
  name: string;
  base_unit_id?: number | null;
  conversion_factor?: number | string | null;
  is_active: boolean;
  sort_order: number;
}

export interface StockLocation {
  id: number;
  tenant_id: number;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
}

export type StockReasonCode =
  | "receipt"
  | "issue"
  | "return"
  | "transfer"
  | "shortage"
  | "damaged"
  | "expired"
  | "write_off"
  | "stocktake"
  | "other";

export interface StockItem {
  id: number;
  tenant_id: number;
  stock_category_id: number | null;
  item_code: string;
  name: string;
  description: string | null;
  unit: string | null;
  stock_unit_id?: number | null;
  unit_cost: number | string | null;
  current_balance: number;
  quantity_reserved?: number;
  quantity_quarantined?: number;
  available_quantity?: number;
  reorder_level: number;
  max_level?: number | null;
  tracks_batches?: boolean;
  storage_location: string | null;
  stock_location_id?: number | null;
  vendor_id: number | null;
  procurement_request_id: number | null;
  purchase_order_id: number | null;
  status: string;
  notes: string | null;
  is_low_stock?: boolean;
  stock_value?: number | null;
  category?: Pick<StockCategory, "id" | "name" | "code"> | null;
  unit_of_measure?: Pick<StockUnit, "id" | "code" | "name"> | null;
  location?: Pick<StockLocation, "id" | "code" | "name"> | null;
  vendor?: { id: number; name: string } | null;
  transactions?: StockTransaction[];
  created_at?: string;
  updated_at?: string;
}

export interface StockTransaction {
  id: number;
  tenant_id: number;
  stock_item_id: number;
  type: "in" | "out" | "adjustment";
  quantity: number;
  balance_after: number;
  issued_to_user_id: number | null;
  issued_to_department_id: number | null;
  issued_to_other: string | null;
  unit_cost: number | string | null;
  reference: string | null;
  reason: string | null;
  reason_code?: StockReasonCode | null;
  stock_location_id?: number | null;
  goods_receipt_note_id?: number | null;
  notes: string | null;
  transaction_date: string;
  recorded_by: number;
  created_at?: string;
  item?: Pick<StockItem, "id" | "item_code" | "name" | "unit">;
  issued_to_user?: Pick<User, "id" | "name" | "email"> | null;
  issued_to_department?: { id: number; name: string } | null;
  recorder?: Pick<User, "id" | "name" | "email">;
  location?: Pick<StockLocation, "id" | "code" | "name"> | null;
}

export interface StockItemInput {
  item_code: string;
  name: string;
  stock_category_id?: number | null;
  description?: string | null;
  unit?: string | null;
  stock_unit_id?: number | null;
  unit_cost?: number | null;
  opening_balance?: number;
  reorder_level?: number;
  storage_location?: string | null;
  stock_location_id?: number | null;
  vendor_id?: number | null;
  procurement_request_id?: number | null;
  purchase_order_id?: number | null;
  status?: string;
  notes?: string | null;
}

export interface StockDashboard {
  active_items: number;
  low_stock_count: number;
  total_stock_value: number;
  issues_last_30_days: number;
  loss_movements_90d: number;
  open_stocktakes: number;
  low_stock_items: StockItem[];
}

export interface StocktakeLine {
  id: number;
  stocktake_id: number;
  stock_item_id: number;
  system_qty: number | null;
  counted_qty: number | null;
  variance: number | null;
  notes?: string | null;
  item?: Pick<StockItem, "id" | "item_code" | "name" | "unit" | "current_balance">;
}

export interface Stocktake {
  id: number;
  tenant_id: number;
  reference_number: string;
  name: string;
  stock_location_id: number | null;
  status: "draft" | "in_progress" | "pending_approval" | "completed" | "cancelled";
  is_blind?: boolean;
  count_date: string;
  notes?: string | null;
  created_by: number;
  completed_by?: number | null;
  completed_at?: string | null;
  lines_count?: number;
  location?: Pick<StockLocation, "id" | "code" | "name"> | null;
  creator?: Pick<User, "id" | "name"> | null;
  completer?: Pick<User, "id" | "name"> | null;
  lines?: StocktakeLine[];
}

export const stockCategoriesApi = {
  list: () => api.get<{ data: StockCategory[] }>("/stock/categories"),
  create: (data: { name: string; code: string; sort_order?: number }) =>
    api.post<{ data: StockCategory; message: string }>("/stock/categories", data),
  update: (id: number, data: { name?: string; code?: string; sort_order?: number }) =>
    api.put<{ data: StockCategory; message: string }>(`/stock/categories/${id}`, data),
  delete: (id: number) => api.delete<{ message: string }>(`/stock/categories/${id}`),
};

export const stockUnitsApi = {
  list: () => api.get<{ data: StockUnit[] }>("/stock/units"),
  create: (data: { code: string; name: string; is_active?: boolean; sort_order?: number }) =>
    api.post<{ data: StockUnit; message: string }>("/stock/units", data),
  update: (id: number, data: Partial<{ code: string; name: string; is_active: boolean; sort_order: number }>) =>
    api.put<{ data: StockUnit; message: string }>(`/stock/units/${id}`, data),
  delete: (id: number) => api.delete<{ message: string }>(`/stock/units/${id}`),
};

export const stockLocationsApi = {
  list: () => api.get<{ data: StockLocation[] }>("/stock/locations"),
  create: (data: { code: string; name: string; description?: string; is_active?: boolean; sort_order?: number }) =>
    api.post<{ data: StockLocation; message: string }>("/stock/locations", data),
  update: (id: number, data: Partial<{ code: string; name: string; description: string; is_active: boolean; sort_order: number }>) =>
    api.put<{ data: StockLocation; message: string }>(`/stock/locations/${id}`, data),
  delete: (id: number) => api.delete<{ message: string }>(`/stock/locations/${id}`),
};

export interface StockDemandRow {
  stock_item_id: number;
  item_code: string;
  name: string;
  unit?: string | null;
  location?: string | null;
  available_quantity: number;
  reorder_level: number;
  lookback_days: number;
  usage_qty: number;
  avg_daily_usage: number;
  days_of_cover: number | null;
  suggested_reorder_qty: number;
  needs_reorder: boolean;
}

export const stockDemandApi = {
  forecast: (params?: { lookback_days?: number }) =>
    api.get<{ success: boolean; data: StockDemandRow[]; meta?: { lookback_days: number } }>(
      "/stock/demand-forecast",
      { params },
    ),
};

export const stockItemsApi = {
  list: (params?: {
    category_id?: number;
    status?: string;
    search?: string;
    low_stock?: number | boolean;
    per_page?: number;
    page?: number;
  }) => api.get<PaginatedResponse<StockItem>>("/stock/items", { params }),
  get: (id: number) => api.get<{ data: StockItem }>(`/stock/items/${id}`),
  create: (data: StockItemInput) =>
    api.post<{ data: StockItem; message: string }>("/stock/items", data),
  update: (id: number, data: Partial<StockItemInput>) =>
    api.put<{ data: StockItem; message: string }>(`/stock/items/${id}`, data),
  delete: (id: number) => api.delete<{ message: string }>(`/stock/items/${id}`),
};

export const stockTransactionsApi = {
  list: (params?: {
    stock_item_id?: number;
    type?: string;
    reason_code?: string;
    issued_to_user_id?: number;
    issued_to_department_id?: number;
    date_from?: string;
    date_to?: string;
    per_page?: number;
    page?: number;
  }) => api.get<PaginatedResponse<StockTransaction>>("/stock/transactions", { params }),
  create: (data: {
    stock_item_id: number;
    type: StockTransaction["type"];
    quantity: number;
    issued_to_user_id?: number | null;
    issued_to_department_id?: number | null;
    issued_to_other?: string | null;
    unit_cost?: number | null;
    reference?: string | null;
    reason?: string | null;
    reason_code?: StockReasonCode | null;
    stock_location_id?: number | null;
    notes?: string | null;
    transaction_date: string;
  }) => api.post<{ data: StockTransaction; message: string }>("/stock/transactions", data),
  get: (id: number) => api.get<{ data: StockTransaction }>(`/stock/transactions/${id}`),
};

export const stockDashboardApi = {
  get: () => api.get<{ data: StockDashboard }>("/stock/dashboard"),
};

export const stocktakesApi = {
  list: (params?: { status?: string; per_page?: number; page?: number }) =>
    api.get<PaginatedResponse<Stocktake>>("/stock/stocktakes", { params }),
  get: (id: number) => api.get<{ data: Stocktake }>(`/stock/stocktakes/${id}`),
  create: (data: {
    name: string;
    count_date: string;
    stock_location_id?: number | null;
    notes?: string | null;
    is_blind?: boolean;
    include_all_active?: boolean;
    stock_item_ids?: number[];
  }) => api.post<{ data: Stocktake; message: string }>("/stock/stocktakes", data),
  updateCounts: (id: number, lines: { id: number; counted_qty?: number | null; notes?: string | null }[]) =>
    api.put<{ data: Stocktake; message: string }>(`/stock/stocktakes/${id}/counts`, { lines }),
  complete: (id: number) =>
    api.post<{ data: Stocktake; message: string }>(`/stock/stocktakes/${id}/complete`),
  approveVariances: (id: number) =>
    api.post<{ data: Stocktake; message: string }>(`/stock/stocktakes/${id}/approve-variances`),
  cancel: (id: number) =>
    api.post<{ data: Stocktake; message: string }>(`/stock/stocktakes/${id}/cancel`),
};

export interface StockRequestLine {
  id: number;
  stock_item_id: number;
  quantity_requested: number;
  quantity_approved?: number | null;
  quantity_issued?: number;
  item?: Pick<StockItem, "id" | "item_code" | "name" | "unit" | "current_balance" | "available_quantity">;
}

export interface StockRequest {
  id: number;
  reference_number: string;
  status: string;
  purpose?: string | null;
  notes?: string | null;
  lines?: StockRequestLine[];
  requester?: { id: number; name: string };
  created_at?: string;
}

export interface StockIssue {
  id: number;
  voucher_number: string;
  status: string;
  issue_date: string;
  stock_request_id?: number | null;
  issued_to_user?: { id: number; name: string } | null;
  lines?: Array<{ id: number; stock_item_id: number; quantity: number; item?: Pick<StockItem, "id" | "item_code" | "name"> }>;
}

export interface StockTransfer {
  id: number;
  reference_number: string;
  status: string;
  from_location?: Pick<StockLocation, "id" | "code" | "name">;
  to_location?: Pick<StockLocation, "id" | "code" | "name">;
  lines?: Array<{ id: number; stock_item_id: number; quantity: number; item?: Pick<StockItem, "id" | "item_code" | "name"> }>;
}

export interface StockWriteOff {
  id: number;
  reference_number: string;
  status: string;
  quantity: number;
  reason_code: string;
  item?: Pick<StockItem, "id" | "item_code" | "name">;
}

export interface StockReplenishmentRequest {
  id: number;
  reference_number: string;
  status: string;
  quantity_requested: number;
  quantity_suggested: number;
  item?: Pick<StockItem, "id" | "item_code" | "name" | "current_balance" | "reorder_level">;
}

export interface StockAvailabilityRow {
  id: number;
  item_code: string;
  name: string;
  on_hand: number;
  reserved: number;
  quarantined: number;
  available: number;
  recommendation: string;
}

export const stockAvailabilityApi = {
  check: (params: { q?: string; item_ids?: number[]; names?: string[] }) =>
    api.get<{ data: StockAvailabilityRow[] }>("/stock/availability", { params }),
  checkPost: (data: { q?: string; item_ids?: number[]; names?: string[] }) =>
    api.post<{ data: StockAvailabilityRow[] }>("/stock/availability", data),
};

export const stockRequestsApi = {
  list: (params?: { status?: string; per_page?: number }) =>
    api.get<PaginatedResponse<StockRequest>>("/stock/requests", { params }),
  get: (id: number) => api.get<{ data: StockRequest }>(`/stock/requests/${id}`),
  create: (data: {
    purpose?: string;
    notes?: string;
    submit?: boolean;
    lines: Array<{ stock_item_id: number; quantity_requested: number; notes?: string }>;
  }) => api.post<{ data: StockRequest; message: string }>("/stock/requests", data),
  submit: (id: number) => api.post<{ data: StockRequest; message: string }>(`/stock/requests/${id}/submit`),
  approve: (id: number, lines?: Array<{ id: number; quantity_approved: number }>) =>
    api.post<{ data: StockRequest; message: string }>(`/stock/requests/${id}/approve`, { lines }),
  reject: (id: number, reason: string) =>
    api.post<{ data: StockRequest; message: string }>(`/stock/requests/${id}/reject`, { reason }),
  cancel: (id: number) => api.post<{ data: StockRequest; message: string }>(`/stock/requests/${id}/cancel`),
};

export const stockIssuesApi = {
  list: (params?: { per_page?: number }) =>
    api.get<PaginatedResponse<StockIssue>>("/stock/issues", { params }),
  get: (id: number) => api.get<{ data: StockIssue }>(`/stock/issues/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post<{ data: StockIssue; message: string }>("/stock/issues", data),
  acknowledge: (id: number) =>
    api.post<{ data: StockIssue; message: string }>(`/stock/issues/${id}/acknowledge`),
};

export const stockReturnsApi = {
  list: (params?: { per_page?: number }) => api.get("/stock/returns", { params }),
  create: (data: Record<string, unknown>) => api.post("/stock/returns", data),
};

export const stockTransfersApi = {
  list: (params?: { per_page?: number }) =>
    api.get<PaginatedResponse<StockTransfer>>("/stock/transfers", { params }),
  get: (id: number) => api.get<{ data: StockTransfer }>(`/stock/transfers/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post<{ data: StockTransfer; message: string }>("/stock/transfers", data),
  dispatch: (id: number) =>
    api.post<{ data: StockTransfer; message: string }>(`/stock/transfers/${id}/dispatch`),
  receive: (id: number) =>
    api.post<{ data: StockTransfer; message: string }>(`/stock/transfers/${id}/receive`),
};

export const stockWriteOffsApi = {
  list: (params?: { per_page?: number }) =>
    api.get<PaginatedResponse<StockWriteOff>>("/stock/write-offs", { params }),
  create: (data: Record<string, unknown>) =>
    api.post<{ data: StockWriteOff; message: string }>("/stock/write-offs", data),
  approve: (id: number) =>
    api.post<{ data: StockWriteOff; message: string }>(`/stock/write-offs/${id}/approve`),
};

export const stockReplenishmentsApi = {
  list: (params?: { per_page?: number }) =>
    api.get<PaginatedResponse<StockReplenishmentRequest>>("/stock/replenishments", { params }),
  create: (data: Record<string, unknown>) =>
    api.post<{ data: StockReplenishmentRequest; message: string }>("/stock/replenishments", data),
};

export const stockBatchesApi = {
  list: (params?: { stock_item_id?: number; per_page?: number }) =>
    api.get("/stock/batches", { params }),
  create: (data: Record<string, unknown>) => api.post("/stock/batches", data),
};

// ─── Reports (hub endpoints for report types) ───────────────────────────────────

export interface ReportFilter {
  period_from?: string;
  period_to?: string;
  user_id?: number | string;
  department_id?: number | string;
  status?: string;
  per_page?: number;
  format?: "csv";
  committee?: string;
  category?: string;
}

export interface ReportUser {
  id: number;
  name: string;
  email: string;
  department_id: number | null;
}

export interface ReportDepartment {
  id: number;
  name: string;
  code: string;
}

export const reportsApi = {
  summary: () => api.get<{ report_types: { id: string; label: string; count: number }[] }>("/reports/summary"),
  users: () => api.get<{ data: ReportUser[] }>("/reports/users"),
  departments: () => api.get<{ data: ReportDepartment[] }>("/reports/departments"),
  travel: (params?: ReportFilter) => api.get("/reports/travel", { params }),
  leave: (params?: ReportFilter) => api.get("/reports/leave", { params }),
  dsa: (params?: ReportFilter) => api.get("/reports/dsa", { params }),
  assets: (params?: ReportFilter) => api.get<PaginatedResponse<Asset>>("/reports/assets", { params }),
  stock: (params?: ReportFilter & { category_id?: number; low_stock?: number | boolean }) =>
    api.get<PaginatedResponse<StockItem>>("/reports/stock", { params }),
  imprest: (params?: ReportFilter) => api.get("/reports/imprest", { params }),
  procurement: (params?: ReportFilter) => api.get("/reports/procurement", { params }),
  salaryAdvances: (params?: ReportFilter) => api.get("/reports/salary-advances", { params }),
  hrTimesheets: (params?: ReportFilter) => api.get("/reports/hr-timesheets", { params }),
  risk: (params?: ReportFilter) => api.get("/reports/risk", { params }),
  governance: (params?: ReportFilter) => api.get("/reports/governance", { params }),
};

// ─── Leave ───────────────────────────────────────────────────────────────────

export interface LeaveRequest {
  id: number;
  reference_number: string;
  leave_type: LeaveTypeCode;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  leave_address?: string | null;
  contact_number?: string | null;
  emergency_contact?: string | null;
  handover_required?: boolean;
  handover_notes?: string | null;
  status: "draft" | "submitted" | "approved" | "rejected" | "cancelled" | "returned_for_correction" | "withdrawn";
  rejection_reason: string | null;
  has_lil_linking: boolean;
  lil_hours_required: number | null;
  lil_hours_linked: number | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  current_stage?: string | null;
  current_holder?: string | null;
  recommendation_status?: string | null;
  recommendation_comments?: string | null;
  certification_status?: string | null;
  certification_comments?: string | null;
  policy_version?: LeavePolicyVersion | null;
  segments?: LeaveSegment[];
  approval_request?: ApprovalRequest | null;
  requester?: User;
  approver?: User;
  recommender?: User;
  certifier?: User;
}

export type LeaveTypeCode =
  | "annual"
  | "sick"
  | "lil"
  | "special"
  | "maternity"
  | "paternity"
  | "compassionate"
  | "study"
  | "unpaid"
  | "home";

export interface LeaveType {
  id: number;
  code: LeaveTypeCode | string;
  name: string;
  annual_entitlement?: string | number | null;
  accrual_rate?: string | number | null;
  cycle?: string | null;
  is_paid?: boolean;
  allow_half_day?: boolean;
}

export interface LeavePolicyVersion {
  id: number;
  name: string;
  version: string;
}

export interface LeaveSegment {
  id: number;
  leave_type: LeaveTypeCode | string;
  start_date: string;
  end_date: string;
  day_part?: "full" | "morning" | "afternoon" | string;
  calendar_days: string | number;
  weekend_days?: string | number;
  public_holidays_excluded?: string | number;
  working_days?: string | number;
  balance_before?: string | number | null;
  amount_requested: string | number;
  balance_after?: string | number | null;
  source_type?: string | null;
  source_id?: number | null;
  pay_treatment?: string | null;
  status?: string | null;
  certification_status?: string | null;
  eligible_days?: string | number | null;
  document_status?: string | null;
  comments?: string | null;
  type?: LeaveType | null;
}

export interface LeavePreviewSegment extends LeaveSegment {
  leave_type_id: number;
  holidays?: Array<Record<string, unknown>>;
}

export interface LeavePreviewResponse {
  segments: LeavePreviewSegment[];
  total_working_days: number;
}

export interface LeaveSegmentInput {
  leave_type: string;
  start_date: string;
  end_date: string;
  day_part?: "full" | "morning" | "afternoon";
  amount_requested?: number;
  source_type?: string | null;
  source_id?: number | null;
  document_status?: string | null;
  comments?: string | null;
}

export interface ToilCredit {
  id: number;
  credit_reference: string;
  user_id: number;
  source_type: string;
  source_id: number | null;
  duty_date: string | null;
  earned_amount: string | number;
  unit: string;
  credited_days: string | number;
  accrual_date: string | null;
  expiry_date: string | null;
  original_balance: string | number;
  used: string | number;
  remaining_balance: string | number;
  status: string;
  days_until_expiry?: number;
  user?: Pick<User, "id" | "name" | "email">;
}

export type LeaveCreatePayload = Omit<Partial<LeaveRequest>, "segments"> & {
  segments?: LeaveSegmentInput[] | LeaveSegment[];
  lil_linkings?: object[];
  user_id?: number;
};

export const leaveApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<LeaveRequest>>("/leave/requests", { params }),
  get: (id: number) => api.get<{ data: LeaveRequest } | LeaveRequest>(`/leave/requests/${id}`),
  types: () => api.get<{ policy: LeavePolicyVersion; data: LeaveType[] }>("/leave/types"),
  preview: (segments: LeaveSegmentInput[]) =>
    api.post<{ data: LeavePreviewResponse }>("/leave/preview", { segments }),
  create: (data: LeaveCreatePayload) =>
    api.post<{ data: LeaveRequest; message: string }>("/leave/requests", data),
  update: (id: number, data: Partial<LeaveRequest>) =>
    api.put<{ data: LeaveRequest; message: string }>(`/leave/requests/${id}`, data),
  delete: (id: number) => api.delete(`/leave/requests/${id}`),
  submit: (id: number) =>
    api.post<{ data: LeaveRequest; message: string }>(`/leave/requests/${id}/submit`),
  approve: (id: number, overrideReason?: string, comment?: string) =>
    api.post<{ data: LeaveRequest; message: string; notified_approvers: string[] }>(`/leave/requests/${id}/approve`, { ...(overrideReason ? { override_reason: overrideReason } : {}), ...(comment ? { comment } : {}) }),
  reject: (id: number, reason: string) =>
    api.post<{ data: LeaveRequest; message: string }>(`/leave/requests/${id}/reject`, { reason }),
  returnForCorrection: (id: number, comment: string) =>
    api.post<{ data: LeaveRequest; message: string }>(`/leave/requests/${id}/return`, { comment }),
  withdraw: (id: number) =>
    api.post<{ data: LeaveRequest; message: string }>(`/leave/requests/${id}/withdraw`),
  resubmit: (id: number) =>
    api.post<{ data: LeaveRequest; message: string }>(`/leave/requests/${id}/resubmit`),
  certificate: (id: number) =>
    api.get<{ data: LeaveRequest }>(`/leave/requests/${id}/certificate`),
  pdfUrl: (id: number) =>
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/leave/requests/${id}/pdf`,
  listLilAccruals: () => api.get<{ data: LilAccrual[] }>("/leave/lil-accruals"),
  listToil: () => api.get<{ data: ToilCredit[] }>("/leave/toil"),
  getBalances: () =>
    api.get<{ annual_balance_days: number; lil_hours_available: number; sick_leave_used_days: number; period_year: number }>("/leave/balances"),
  recommend: (id: number, data: { action: "recommend" | "not_recommend" | "return"; comment?: string }) =>
    api.post<{ data: LeaveRequest; message: string }>(`/leave/requests/${id}/recommend`, data),
  certify: (id: number, data: { action: "certify" | "certify_with_condition" | "return" | "mark_ineligible"; comment?: string; segments?: Array<Record<string, unknown>> }) =>
    api.post<{ data: LeaveRequest; message: string }>(`/leave/requests/${id}/certify`, data),
  teamCalendar: (params?: { from?: string; to?: string; department_id?: number }) =>
    api.get<{ from: string; to: string; data: Array<Record<string, unknown>> }>("/leave/team-calendar", { params }),
  registerExport: (params?: { from?: string; to?: string; status?: string; department_id?: number }) =>
    api.get<Blob>("/leave/register/export", { params, responseType: "blob" }),
  // Attachments
  listAttachments: (id: number) =>
    api.get<{ data: ModuleAttachment[] }>(`/leave/requests/${id}/attachments`),
  uploadAttachment: (id: number, file: File, documentType: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("document_type", documentType);
    return api.post<{ data: ModuleAttachment; message: string }>(`/leave/requests/${id}/attachments`, fd);
  },
  deleteAttachment: (id: number, attachmentId: number) =>
    api.delete(`/leave/requests/${id}/attachments/${attachmentId}`),
  downloadAttachmentUrl: (id: number, attachmentId: number) =>
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/leave/requests/${id}/attachments/${attachmentId}/download`,
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

export interface AdminLeaveBalanceRow {
  user_id: number;
  name: string;
  email: string;
  job_title: string | null;
  annual_balance_days: number;
  lil_hours_available: number;
  annual_used: number;
  annual_remaining: number;
  has_balance_record: boolean;
}

export const hrLeaveBalancesApi = {
  listAll: (year?: number) =>
    api.get<{ data: AdminLeaveBalanceRow[]; year: number }>(
      "/leave/admin/balances",
      { params: year ? { year } : undefined }
    ),
  upsert: (payload: {
    user_id: number;
    period_year: number;
    annual_balance_days: number;
    lil_hours_available?: number;
  }) =>
    api.post<{ message: string; data: { id: number; annual_balance_days: number; lil_hours_available: number } }>(
      "/leave/admin/balances/upsert",
      payload
    ),
  initializeYear: (period_year: number) =>
    api.post<{ message: string; created: number; skipped: number }>(
      "/leave/admin/balances/initialize-year",
      { period_year }
    ),
};

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
  procurement_request_id: number;
  rfq_invitation_id?: number | null;
  vendor_id?: number | null;
  submitted_by_user_id?: number | null;
  vendor_name: string;
  quoted_amount: number;
  currency?: string;
  submission_channel?: string | null;
  is_recommended: boolean;
  compliance_passed?: boolean | null;
  compliance_notes?: string | null;
  assessed_by?: number | null;
  assessed_at?: string | null;
  notes: string | null;
  quote_date?: string | null;
  vendor?: Vendor;
  assessor?: User;
  attachments?: ProcurementAttachment[];
}

export interface SupplierCategory {
  id: number;
  tenant_id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
}

export interface SupplierApprovalLog {
  id: number;
  action: string;
  reason: string | null;
  performed_at: string | null;
  performer?: { id: number; name: string; email?: string | null } | null;
}

export interface RfqInvitation {
  id: number;
  procurement_request_id: number;
  vendor_id?: number | null;
  invitation_type: "system" | "email";
  status: string;
  invited_name?: string | null;
  invited_email?: string | null;
  response_token?: string | null;
  invited_at?: string | null;
  viewed_at?: string | null;
  responded_at?: string | null;
  last_notified_at?: string | null;
  notes?: string | null;
  procurement_request?: ProcurementRequest;
  vendor?: Vendor | null;
  quote?: ProcurementQuote | null;
}

export interface ProcurementCoiPayload {
  coi_declared: boolean;
  coi_has_conflict: boolean;
  coi_notes?: string;
}

export interface ProcurementSettings {
  direct_purchase_limit: number;
  quotation_limit: number;
  tender_threshold: number;
  minimum_quotes_required: number;
  split_lookback_days: number;
  split_enforcement?: "soft" | "hard";
  policy_profile_key?: string;
  donor_codes?: string[];
  multi_donor_policy_ui?: string;
  ai_comparison_enabled?: boolean;
  ai_comparison_provider?: string;
  has_tenant_override?: boolean;
}

export interface SplitPurchaseWarning {
  message: string;
  related_count: number;
  combined_value: number;
  quotation_limit: number;
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
  split_justification?: string | null;
  programme_id?: number | null;
  programme?: { id: number; reference_number: string; title: string } | null;
  required_by_date: string;
  status: "draft" | "submitted" | "hod_approved" | "hod_rejected" | "budget_reserved" | "approved" | "rejected" | "cancelled" | "awarded" | "returned_for_correction" | "withdrawn";
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  awarded_quote_id: number | null;
  awarded_at: string | null;
  award_notes: string | null;
  hod_id: number | null;
  hod_reviewed_at: string | null;
  rfq_issued_at?: string | null;
  rfq_issued_by?: number | null;
  rfq_deadline?: string | null;
  rfq_notes?: string | null;
  requester?: User;
  approver?: User;
  hod?: User;
  items?: ProcurementItem[];
  quotes?: ProcurementQuote[];
  supplierCategories?: SupplierCategory[];
  rfqInvitations?: RfqInvitation[];
  purchaseOrder?: PurchaseOrder | null;
  budgetReservations?: BudgetReservation[];
}

export const procurementSettingsApi = {
  get: () => api.get<{ data: ProcurementSettings }>("/procurement/settings"),
  update: (data: Partial<ProcurementSettings>) =>
    api.put<{ data: ProcurementSettings; message: string }>("/procurement/settings", data),
};

export const procurementApi = {
  list: (params?: Record<string, string | number | boolean>) =>
    api.get<PaginatedResponse<ProcurementRequest>>("/procurement/requests", { params }),
  get: (id: number) => api.get<ProcurementRequest>(`/procurement/requests/${id}`),
  create: (data: Partial<ProcurementRequest>) =>
    api.post<{ data: ProcurementRequest; message: string }>("/procurement/requests", data),
  update: (id: number, data: Partial<ProcurementRequest>) =>
    api.put<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}`, data),
  delete: (id: number) => api.delete(`/procurement/requests/${id}`),
  submit: (id: number, data?: { split_justification?: string }) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/submit`, data ?? {}),
  approve: (id: number, comment?: string) =>
    api.post<{ data: ProcurementRequest; message: string; notified_approvers: string[] }>(`/procurement/requests/${id}/approve`, comment ? { comment } : {}),
  reject: (id: number, reason: string) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/reject`, { reason }),
  returnForCorrection: (id: number, comment: string) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/return`, { comment }),
  withdraw: (id: number) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/withdraw`),
  resubmit: (id: number) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/resubmit`),
  certificate: (id: number) =>
    api.get<{ data: ProcurementRequest }>(`/procurement/requests/${id}/certificate`),
  award: (id: number, quoteId: number, payload?: { award_notes?: string } & ProcurementCoiPayload) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/award`, {
      quote_id: quoteId,
      award_notes: payload?.award_notes,
      coi_declared: payload?.coi_declared ?? true,
      coi_has_conflict: payload?.coi_has_conflict ?? false,
      coi_notes: payload?.coi_notes,
    }),
  setMethod: (id: number, data: { procurement_method: string; method_override_reason?: string }) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/set-method`, data),
  hodApprove: (id: number) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/hod-approve`),
  hodReject: (id: number, reason: string) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/hod-reject`, { reason }),
  issueRfq: (id: number, data: { rfq_deadline?: string; rfq_notes?: string; category_ids: number[]; external_invites?: { name?: string; email: string }[] }) =>
    api.post<{ data: ProcurementRequest; message: string }>(`/procurement/requests/${id}/issue-rfq`, data),
};

export interface CreateQuotePayload {
  vendor_name: string;
  vendor_id?: number | null;
  quoted_amount: number;
  currency?: string;
  is_recommended?: boolean;
  compliance_passed?: boolean | null;
  compliance_notes?: string;
  notes?: string;
  quote_date?: string;
}

export const quotesApi = {
  list: (requestId: number) =>
    api.get<{ data: ProcurementQuote[] }>(`/procurement/requests/${requestId}/quotes`),
  create: (requestId: number, data: CreateQuotePayload) =>
    api.post<{ data: ProcurementQuote; message: string }>(`/procurement/requests/${requestId}/quotes`, data),
  update: (requestId: number, quoteId: number, data: Partial<CreateQuotePayload> & Partial<ProcurementCoiPayload>) =>
    api.put<{ data: ProcurementQuote; message: string }>(`/procurement/requests/${requestId}/quotes/${quoteId}`, data),
  delete: (requestId: number, quoteId: number) =>
    api.delete(`/procurement/requests/${requestId}/quotes/${quoteId}`),
};

export interface BudgetReservation {
  id: number;
  procurement_request_id: number;
  reserved_by: number;
  budget_line: string;
  reserved_amount: number;
  currency: string;
  notes: string | null;
  released_at: string | null;
  released_by: number | null;
  created_at: string;
  procurement_request?: ProcurementRequest;
}

export const budgetReservationsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<BudgetReservation>>("/procurement/budget-reservations", { params }),
  reserve: (
    requestId: number,
    data: {
      budget_line_id?: number;
      budget_line?: string;
      reserved_amount: number;
      currency?: string;
      notes?: string;
    },
  ) =>
    api.post<{ data: BudgetReservation; message: string }>(`/procurement/requests/${requestId}/reserve-budget`, data),
  release: (reservationId: number) =>
    api.delete<{ data: BudgetReservation; message: string }>(`/procurement/budget-reservations/${reservationId}`),
};

export interface BudgetAvailability {
  budget_line_id: number;
  approved: number;
  actual: number;
  commitments: number;
  available: number;
  requested: number | null;
  sufficient: boolean;
  warnings: string[];
}

export interface OrgBudgetLine {
  id: number;
  code: string | null;
  name: string | null;
  category: string;
  amount_allocated: number;
  is_active: boolean;
  is_contingency?: boolean;
  budget?: { id: number; year: string; name: string; financial_year_id?: number | null };
  funding_source?: { id: number; code: string; name: string } | null;
}

export interface BudgetVarianceRow {
  id: number;
  budget_line_id: number;
  period_type: string;
  period_key: string;
  approved_budget: number;
  actual_expenditure: number;
  open_commitments: number;
  available_budget: number;
  variance_amount: number;
  variance_pct: number | null;
  utilisation_pct: number | null;
  is_significant: boolean;
  status: string;
  budget_line?: OrgBudgetLine;
  explanations?: Array<{
    id: number;
    category: string;
    explanation: string;
    remedial_action?: string | null;
    status: string;
  }>;
}

export interface BudgetCycle {
  id: number;
  tenant_id: number;
  financial_year_id: number;
  status: string;
  opened_at?: string | null;
  locked_at?: string | null;
  sg_approved_at?: string | null;
  approved_total?: number | null;
  notes?: string | null;
  financial_year?: { id: number; code: string; label: string };
  guideline?: BudgetGuideline | null;
  submissions?: BudgetSubmissionPack[];
  decisions?: BudgetCycleDecision[];
  approvals?: Array<{
    id: number;
    stage: string;
    decision: string;
    comments?: string | null;
    decided_at: string;
  }>;
}

export interface BudgetCycleDecision {
  id: number;
  budget_cycle_id: number;
  body: "fsc" | "exco" | "plenary" | string;
  meeting_on?: string | null;
  decision: string;
  minute_reference?: string | null;
  comments?: string | null;
  attachment_path?: string | null;
  recorded_at: string;
  recorded_by?: { id: number; name: string } | null;
}

export interface BudgetGuideline {
  id: number;
  budget_cycle_id: number;
  submission_opens_on?: string | null;
  department_deadline?: string | null;
  assumptions?: string | null;
  inflation_rate?: number | null;
  fx_assumptions?: string | null;
  ceilings?: Record<string, unknown> | null;
  published_at?: string | null;
}

export interface BudgetSubmissionItem {
  id?: number;
  funding_source_id?: number | null;
  category?: string | null;
  code?: string | null;
  name: string;
  description?: string | null;
  quantity?: number | null;
  unit_rate?: number | null;
  calculated_amount?: number | null;
  requested_amount: number;
  prior_year_amount?: number | null;
  justification?: string | null;
  workplan_ref?: string | null;
}

export interface BudgetSubmissionPack {
  id: number;
  budget_cycle_id: number;
  department_id?: number | null;
  programme_id?: number | null;
  type: string;
  title: string;
  status: string;
  prepared_by: number;
  submitted_at?: string | null;
  returned_reason?: string | null;
  require_hod_approval?: boolean;
  motivation?: string | null;
  items?: BudgetSubmissionItem[];
  department?: { id: number; name: string } | null;
  preparer?: { id: number; name: string } | null;
  cycle?: BudgetCycle;
}

export const budgetApi = {
  financialYears: () => api.get<{ success: boolean; data: unknown[] }>("/budget/financial-years"),
  fundingSources: (params?: { active_only?: boolean }) =>
    api.get<{ success: boolean; data: unknown[] }>("/budget/funding-sources", { params }),
  lines: (params?: Record<string, string | number | boolean>) =>
    api.get<{ success: boolean; data: PaginatedResponse<OrgBudgetLine> | OrgBudgetLine[] }>("/budget/lines", { params }),
  availability: (lineId: number, amount?: number) =>
    api.get<{ success: boolean; data: BudgetAvailability }>(`/budget/lines/${lineId}/availability`, {
      params: amount != null ? { amount } : undefined,
    }),
  checkAvailability: (data: { budget_line_id: number; amount?: number }) =>
    api.post<{ success: boolean; data: BudgetAvailability }>("/budget/availability/check", data),
  reserveCommitment: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; data: BudgetReservation }>("/budget/commitments/reserve", data),
  postActual: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; data: unknown }>("/budget/actuals", data),
  importActuals: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{ success: boolean; data: unknown }>("/budget/actuals/import", form);
  },
  variances: (params?: Record<string, string | number | boolean>) =>
    api.get<{ success: boolean; data: PaginatedResponse<BudgetVarianceRow> }>("/budget/variance", { params }),
  scanVariances: () => api.post<{ success: boolean; data: { scanned: number; significant: number } }>("/budget/variance/scan"),
  explainVariance: (
    varianceId: number,
    data: { category: string; explanation: string; remedial_action?: string },
  ) => api.post<{ success: boolean; data: unknown }>(`/budget/variance/${varianceId}/explanation`, data),
  reviewVarianceExplanation: (
    explanationId: number,
    data: { decision: "accepted" | "returned"; finance_comments?: string },
  ) => api.post<{ success: boolean; data: unknown }>(`/budget/variance/explanations/${explanationId}/review`, data),

  cycles: () => api.get<{ success: boolean; data: BudgetCycle[] }>("/budget/cycles"),
  createCycle: (data: { financial_year_id: number; notes?: string }) =>
    api.post<{ success: boolean; data: BudgetCycle }>("/budget/cycles", data),
  getCycle: (id: number) => api.get<{ success: boolean; data: BudgetCycle }>(`/budget/cycles/${id}`),
  publishGuidelines: (id: number, data: Record<string, unknown>) =>
    api.post<{ success: boolean; data: BudgetGuideline }>(`/budget/cycles/${id}/guidelines`, data),
  advanceCycle: (id: number, data?: { comments?: string }) =>
    api.post<{ success: boolean; data: BudgetCycle }>(`/budget/cycles/${id}/advance`, data ?? {}),
  returnCycle: (id: number, data: { reason: string }) =>
    api.post<{ success: boolean; data: BudgetCycle }>(`/budget/cycles/${id}/return`, data),
  sgApproveCycle: (id: number, data?: { comments?: string; approved_total?: number }) =>
    api.post<{ success: boolean; data: BudgetCycle }>(`/budget/cycles/${id}/sg-approve`, data ?? {}),
  lockCycle: (id: number) => api.post<{ success: boolean; data: BudgetCycle }>(`/budget/cycles/${id}/lock`),
  listDecisions: (id: number) =>
    api.get<{ success: boolean; data: BudgetCycleDecision[] }>(`/budget/cycles/${id}/decisions`),
  recordDecision: (id: number, data: FormData | Record<string, unknown>) =>
    api.post<{ success: boolean; data: { decision: BudgetCycleDecision; cycle: BudgetCycle } }>(
      `/budget/cycles/${id}/decisions`,
      data,
      data instanceof FormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined,
    ),

  submissions: (params?: Record<string, string | number | boolean>) =>
    api.get<{ success: boolean; data: PaginatedResponse<BudgetSubmissionPack> }>("/budget/submissions", { params }),
  getSubmission: (id: number) =>
    api.get<{ success: boolean; data: BudgetSubmissionPack }>(`/budget/submissions/${id}`),
  createSubmission: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; data: BudgetSubmissionPack }>("/budget/submissions", data),
  updateSubmission: (id: number, data: Record<string, unknown>) =>
    api.put<{ success: boolean; data: BudgetSubmissionPack }>(`/budget/submissions/${id}`, data),
  submitSubmission: (id: number) =>
    api.post<{ success: boolean; data: BudgetSubmissionPack }>(`/budget/submissions/${id}/submit`),
  acceptSubmission: (id: number) =>
    api.post<{ success: boolean; data: BudgetSubmissionPack }>(`/budget/submissions/${id}/accept`),
  returnSubmission: (id: number, data: { reason: string }) =>
    api.post<{ success: boolean; data: BudgetSubmissionPack }>(`/budget/submissions/${id}/return`, data),

  changes: (params?: Record<string, string | number | boolean>) =>
    api.get<{ success: boolean; data: PaginatedResponse<BudgetChangeRequest> }>("/budget/changes", { params }),
  getChange: (id: number) =>
    api.get<{ success: boolean; data: BudgetChangeRequest }>(`/budget/changes/${id}`),
  createChange: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; data: BudgetChangeRequest }>("/budget/changes", data),
  updateChange: (id: number, data: Record<string, unknown>) =>
    api.put<{ success: boolean; data: BudgetChangeRequest }>(`/budget/changes/${id}`, data),
  submitChange: (id: number) =>
    api.post<{ success: boolean; data: BudgetChangeRequest }>(`/budget/changes/${id}/submit`),
  financeDecideChange: (id: number, data: { decision: "approve" | "return" | "reject"; comments?: string }) =>
    api.post<{ success: boolean; data: BudgetChangeRequest }>(`/budget/changes/${id}/finance-decide`, data),
  sgDecideChange: (id: number, data: { decision: "approve" | "return" | "reject"; comments?: string }) =>
    api.post<{ success: boolean; data: BudgetChangeRequest }>(`/budget/changes/${id}/sg-decide`, data),
  applyChange: (id: number) =>
    api.post<{ success: boolean; data: BudgetChangeRequest }>(`/budget/changes/${id}/apply`),

  reportUtilisation: (params?: Record<string, string | number | boolean>) =>
    api.get<{ success: boolean; data: BudgetUtilisationReport }>("/budget/reports/utilisation", { params }),
  reportCommitmentAgeing: (params?: Record<string, string | number | boolean>) =>
    api.get<{ success: boolean; data: BudgetCommitmentAgeingReport }>("/budget/reports/commitment-ageing", {
      params,
    }),
  reportChangeRegister: (params?: Record<string, string | number | boolean>) =>
    api.get<{ success: boolean; data: BudgetChangeRegisterReport }>("/budget/reports/change-register", { params }),
  reportCycleStatus: (params?: Record<string, string | number | boolean>) =>
    api.get<{ success: boolean; data: BudgetCycleStatusReport }>("/budget/reports/cycle-status", { params }),

  cashflowForecast: (params: Record<string, string | number | boolean>) =>
    api.get<{ success: boolean; data: CashflowForecast }>("/budget/cashflow/forecast", { params }),
  cashflowForecastExportUrl: (params: Record<string, string | number | boolean>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => q.set(k, String(v)));
    return `/budget/cashflow/forecast/export?${q.toString()}`;
  },
  cashflowCompare: (params: Record<string, string | number | boolean | number[]>) =>
    api.get<{ success: boolean; data: CashflowCompareResult }>("/budget/cashflow/compare", { params }),
  cashflowCompareExportUrl: (params: Record<string, string | number | boolean | number[]>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach((x) => q.append(`${k}[]`, String(x)));
      else q.set(k, String(v));
    });
    return `/budget/cashflow/compare/export?${q.toString()}`;
  },
  cashflowInflows: (params?: Record<string, string | number | boolean>) =>
    api.get<{ success: boolean; data: CashflowInflow[] }>("/budget/cashflow/inflows", { params }),
  createCashflowInflow: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; data: CashflowInflow }>("/budget/cashflow/inflows", data),
  updateCashflowInflow: (id: number, data: Record<string, unknown>) =>
    api.put<{ success: boolean; data: CashflowInflow }>(`/budget/cashflow/inflows/${id}`, data),
  deleteCashflowInflow: (id: number) =>
    api.delete<{ success: boolean }>(`/budget/cashflow/inflows/${id}`),
  cashflowScenarios: (params?: Record<string, string | number | boolean>) =>
    api.get<{ success: boolean; data: CashflowScenario[] }>("/budget/cashflow/scenarios", { params }),
  getCashflowScenario: (id: number) =>
    api.get<{ success: boolean; data: CashflowScenario }>(`/budget/cashflow/scenarios/${id}`),
  createCashflowScenario: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; data: CashflowScenario }>("/budget/cashflow/scenarios", data),
  updateCashflowScenario: (id: number, data: Record<string, unknown>) =>
    api.put<{ success: boolean; data: CashflowScenario }>(`/budget/cashflow/scenarios/${id}`, data),
  deleteCashflowScenario: (id: number) =>
    api.delete<{ success: boolean }>(`/budget/cashflow/scenarios/${id}`),
  addCashflowAdjustment: (scenarioId: number, data: Record<string, unknown>) =>
    api.post<{ success: boolean; data: CashflowScenarioAdjustment }>(
      `/budget/cashflow/scenarios/${scenarioId}/adjustments`,
      data,
    ),
  deleteCashflowAdjustment: (scenarioId: number, adjustmentId: number) =>
    api.delete<{ success: boolean }>(`/budget/cashflow/scenarios/${scenarioId}/adjustments/${adjustmentId}`),
};

export interface BudgetUtilisationRow {
  budget_line_id?: number;
  code?: string | null;
  name?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  funding_source_id?: number | null;
  funding_source_name?: string | null;
  funding_source_code?: string | null;
  line_count?: number;
  approved: number;
  actual: number;
  committed: number;
  available: number;
  pct_utilised: number;
}

export interface BudgetUtilisationReport {
  group_by: "line" | "department" | "funding_source";
  rows: BudgetUtilisationRow[];
  totals: {
    approved: number;
    actual: number;
    committed: number;
    available: number;
    line_count: number;
  };
}

export interface BudgetCommitmentAgeingItem {
  id: number;
  budget_line_id: number | null;
  budget_line_code?: string | null;
  budget_line_name?: string | null;
  source_type?: string | null;
  source_id?: number | null;
  source_key?: string | null;
  status: string;
  amount: number;
  currency?: string | null;
  reserved_at?: string | null;
  age_days: number;
  age_bucket: "0_30" | "31_60" | "61_90" | "90_plus" | string;
}

export interface BudgetCommitmentAgeingReport {
  as_of: string;
  buckets: Record<string, { count: number; amount: number }>;
  items: BudgetCommitmentAgeingItem[];
}

export interface BudgetChangeRegisterRow {
  id: number;
  title: string;
  type: string;
  status: string;
  budget_name?: string | null;
  requires_sg: boolean;
  total_amount: number;
  item_count: number;
  submitted_at?: string | null;
  finance_decided_at?: string | null;
  sg_decided_at?: string | null;
  applied_at?: string | null;
  prepared_by?: { id: number; name: string } | null;
  approver_path: Array<{
    step: string;
    label: string;
    at?: string | null;
    actor_id?: number | null;
  }>;
}

export interface BudgetChangeRegisterReport {
  rows: BudgetChangeRegisterRow[];
}

export interface BudgetCycleStatusRow {
  id: number;
  financial_year_code?: string | null;
  financial_year_label?: string | null;
  status: string;
  opened_at?: string | null;
  sg_approved_at?: string | null;
  locked_at?: string | null;
  approved_total?: number | null;
  submission_opens_on?: string | null;
  department_deadline?: string | null;
  guidelines_published_at?: string | null;
  submission_counts: Record<string, number>;
  submission_total: number;
}

export interface BudgetCycleStatusReport {
  rows: BudgetCycleStatusRow[];
}

export interface CashflowScenarioAdjustment {
  id: number;
  cashflow_scenario_id: number;
  period: string;
  direction: "inflow" | "outflow" | string;
  amount: number;
  label?: string | null;
  category?: string | null;
  budget_reservation_id?: number | null;
}

export interface CashflowScenario {
  id: number;
  tenant_id?: number;
  financial_year_id: number;
  name: string;
  kind: "base" | "optimistic" | "pessimistic" | "custom" | string;
  opening_balance: number;
  currency: string;
  status: "draft" | "active" | "archived" | string;
  notes?: string | null;
  adjustments_count?: number;
  adjustments?: CashflowScenarioAdjustment[];
}

export interface CashflowForecastPeriod {
  period: string;
  structured_inflow: number;
  actual_outflow: number;
  projected_outflow: number;
  scenario_inflow: number;
  scenario_outflow: number;
  net: number;
  closing_balance: number;
}

export interface CashflowInflow {
  id: number;
  financial_year_id: number;
  source_type: "membership" | "donor" | "other" | string;
  label: string;
  counterparty_name?: string | null;
  period: string;
  amount: number;
  currency: string;
  status: "planned" | "confirmed" | "received" | "cancelled" | string;
  funding_source_id?: number | null;
  notes?: string | null;
}

export interface CashflowCompareResult {
  financial_year_id: number;
  scenarios: Array<{
    id: number;
    name: string;
    kind: string;
    status: string;
    opening_balance: number;
    currency: string;
  }>;
  periods: Array<{
    period: string;
    scenarios: Record<string, CashflowForecastPeriod>;
  }>;
}

export interface CashflowForecastItem {
  budget_reservation_id: number;
  budget_line_id?: number | null;
  budget_line_code?: string | null;
  budget_line_name?: string | null;
  source_type?: string | null;
  source_id?: number | null;
  source_key?: string | null;
  status: string;
  amount: number;
  currency?: string | null;
  expected_cash_date: string;
  period: string;
  resolution?: string;
}

export interface CashflowForecast {
  financial_year: {
    id: number;
    code?: string | null;
    label?: string | null;
    starts_on?: string | null;
    ends_on?: string | null;
  };
  scenario?: {
    id: number;
    name: string;
    kind: string;
    status: string;
    opening_balance: number;
    currency: string;
  } | null;
  as_of: string;
  currency: string;
  opening_balance: number;
  periods: CashflowForecastPeriod[];
  totals: {
    structured_inflow: number;
    actual_outflow: number;
    projected_outflow: number;
    scenario_inflow: number;
    scenario_outflow: number;
    closing_balance: number;
  };
  out_of_range_projected: { count: number; amount: number };
  items: CashflowForecastItem[];
  structured_inflows?: CashflowInflow[];
}

export interface BudgetChangeItem {
  id?: number;
  source_budget_line_id?: number | null;
  target_budget_line_id?: number | null;
  new_line_code?: string | null;
  new_line_name?: string | null;
  new_line_category?: string | null;
  amount: number;
  is_decrease?: boolean;
  notes?: string | null;
  source_line?: OrgBudgetLine | null;
  target_line?: OrgBudgetLine | null;
}

export interface BudgetChangeRequest {
  id: number;
  budget_id: number;
  type: string;
  title: string;
  status: string;
  justification?: string | null;
  requires_sg: boolean;
  items?: BudgetChangeItem[];
  budget?: { id: number; name: string; year?: string };
  preparer?: { id: number; name: string } | null;
}

export interface Vendor {
  id: number;
  name: string;
  contact_name: string | null;
  registration_number: string | null;
  tax_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
  country: string | null;
  category: string | null;
  payment_terms: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_branch: string | null;
  is_sme: boolean;
  notes: string | null;
  is_approved: boolean;
  is_active: boolean;
  status?: string;
  risk_level?: string | null;
  submitted_at?: string | null;
  rejection_reason?: string | null;
  last_info_request_reason?: string | null;
  is_blacklisted: boolean;
  blacklisted_at: string | null;
  blacklist_reason: string | null;
  blacklist_reference: string | null;
  categories?: SupplierCategory[];
  approval_logs?: SupplierApprovalLog[];
  portal_users?: Pick<User, "id" | "name" | "email" | "is_active">[];
  quotes_count?: number;
  ratings_avg_rating?: number | null;
  derived_star_rating?: number | null;
  ratings_count?: number;
  created_at?: string;
  recent_quotes?: VendorQuote[];
  ratings?: VendorRating[];
  my_rating?: VendorRating | null;
}

export interface VendorContract {
  id: number;
  reference_number: string;
  title: string;
  value: number;
  currency: string;
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "completed" | "terminated";
  signed_at: string | null;
  terminated_at: string | null;
  procurement_request_id: number | null;
  procurement_request?: { id: number; reference_number: string; title: string };
}

export interface VendorPerformanceEvaluation {
  id: number;
  vendor_id: number;
  contract_id: number | null;
  evaluated_by: number;
  delivery_score: number;
  quality_score: number;
  price_score: number;
  compliance_score: number;
  communication_score: number;
  overall_score: number;
  notes: string | null;
  created_at: string;
  evaluator?: { id: number; name: string };
  contract?: { id: number; reference_number: string; title: string; status: string };
}

export interface VendorRating {
  id: number;
  vendor_id: number;
  rated_by: number;
  rating: number;
  review: string | null;
  updated_at: string;
  rater?: { id: number; name: string };
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
  requestInfo: (id: number, reason: string) =>
    api.post<{ data: Vendor; message: string }>(`/procurement/vendors/${id}/request-info`, { reason }),
  suspend: (id: number, reason: string) =>
    api.post<{ data: Vendor; message: string }>(`/procurement/vendors/${id}/suspend`, { reason }),
  approvalLogs: (id: number) =>
    api.get<{ data: SupplierApprovalLog[] }>(`/procurement/vendors/${id}/approval-logs`),
  listRatings: (id: number) =>
    api.get<{ data: VendorRating[]; avg: number | null; count: number; my_rating: VendorRating | null }>(
      `/procurement/vendors/${id}/ratings`
    ),
  rate: (id: number, rating: number, review?: string) =>
    api.post<{ data: VendorRating; avg: number | null; message: string }>(
      `/procurement/vendors/${id}/ratings`,
      { rating, review }
    ),
  listContracts: (id: number) =>
    api.get<{ data: VendorContract[] }>(`/procurement/vendors/${id}/contracts`),
  blacklist: (id: number, reason: string, reference?: string) =>
    api.post<{ data: Vendor; message: string }>(`/procurement/vendors/${id}/blacklist`, { reason, reference }),
  unblacklist: (id: number) =>
    api.post<{ data: Vendor; message: string }>(`/procurement/vendors/${id}/unblacklist`),
  changePortalUserPassword: (
    vendorId: number,
    portalUserId: number,
    password: string,
    passwordConfirmation: string,
    mustResetPassword = true
  ) =>
    api.post<{ message: string }>(`/procurement/vendors/${vendorId}/portal-users/${portalUserId}/change-password`, {
      password,
      password_confirmation: passwordConfirmation,
      must_reset_password: mustResetPassword,
    }),
  listEvaluations: (id: number) =>
    api.get<{ data: VendorPerformanceEvaluation[]; avg: Record<string, number>; count: number }>(
      `/procurement/vendors/${id}/evaluations`
    ),
  submitEvaluation: (id: number, data: {
    delivery_score: number;
    quality_score: number;
    price_score: number;
    compliance_score: number;
    communication_score: number;
    contract_id?: number | null;
    notes?: string;
  }) =>
    api.post<{ data: VendorPerformanceEvaluation; message: string }>(
      `/procurement/vendors/${id}/evaluations`,
      data
    ),
};

export const supplierCategoriesApi = {
  publicList: (tenantId?: number) =>
    api.get<{ data: SupplierCategory[] }>("/procurement/supplier-categories/public", { params: tenantId ? { tenant_id: tenantId } : undefined }),
  list: () =>
    api.get<{ data: SupplierCategory[] }>("/procurement/supplier-categories"),
  create: (data: Partial<SupplierCategory>) =>
    api.post<{ data: SupplierCategory; message: string }>("/procurement/supplier-categories", data),
  update: (id: number, data: Partial<SupplierCategory>) =>
    api.put<{ data: SupplierCategory; message: string }>(`/procurement/supplier-categories/${id}`, data),
  destroy: (id: number) =>
    api.delete<{ message: string }>(`/procurement/supplier-categories/${id}`),
};

export const supplierRegistrationApi = {
  register: (formData: FormData) =>
    api.post<{ data: { vendor_id: number; user_id: number; status: string }; message: string }>(
      "/procurement/suppliers/register",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    ),
};

export interface SupplierDashboard {
  vendor: Vendor;
  open_rfq_count: number;
  quote_count: number;
  purchase_order_count: number;
  invoice_count: number;
  pending_compliance: number;
}

export const supplierPortalApi = {
  me: () => api.get<{ data: Vendor }>("/procurement/supplier/me"),
  updateProfile: (formData: FormData) =>
    api.put<{ data: Vendor; message: string }>("/procurement/supplier/profile", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  dashboard: () => api.get<{ data: SupplierDashboard }>("/procurement/supplier/dashboard"),
  rfqs: () => api.get<{ data: RfqInvitation[] }>("/procurement/supplier/rfqs"),
  rfq: (requestId: number) =>
    api.get<{ data: { invitation: RfqInvitation; request: ProcurementRequest } }>(`/procurement/supplier/rfqs/${requestId}`),
  submitQuote: (requestId: number, data: { quoted_amount: number; currency?: string; quote_date?: string; notes?: string }) =>
    api.post<{ data: ProcurementQuote; message: string }>(`/procurement/supplier/rfqs/${requestId}/quote`, data),
  purchaseOrders: () => api.get<{ data: PurchaseOrder[] }>("/procurement/supplier/purchase-orders"),
  invoices: () => api.get<{ data: Invoice[] }>("/procurement/supplier/invoices"),
  submitProformaInvoice: (purchaseOrderId: number, data: {
    vendor_invoice_number: string;
    invoice_date: string;
    due_date: string;
    amount: number;
    currency?: string;
  }) =>
    api.post<{ data: Invoice; message: string }>(`/procurement/supplier/purchase-orders/${purchaseOrderId}/proforma-invoice`, data),
  submitFinalInvoice: (invoiceId: number, data: {
    vendor_invoice_number?: string;
    invoice_date?: string;
    due_date?: string;
    amount?: number;
    currency?: string;
  }) =>
    api.post<{ data: Invoice; message: string }>(`/procurement/supplier/invoices/${invoiceId}/final-invoice`, data),
};

export const externalRfqApi = {
  preview: (token: string) =>
    api.get<{ data: { invitation: RfqInvitation; request: ProcurementRequest; can_submit: boolean } }>(`/procurement/external-rfq/${token}`),
  submitQuote: (token: string, data: { vendor_name: string; quoted_amount: number; currency?: string; quote_date?: string; notes?: string }) =>
    api.post<{ data: ProcurementQuote; message: string }>(`/procurement/external-rfq/${token}/quote`, data),
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
  accept: (
    poId: number,
    grnId: number,
    handoff?: Array<{
      goods_receipt_item_id: number;
      type: "fixed_asset" | "stock" | "capital" | "controlled" | "consumable" | "direct_expense" | "skip";
      name: string;
      category?: string;
      quantity?: number;
      unit?: string;
      stock_category_id?: number;
      stock_item_id?: number;
      notes?: string;
    }>,
  ) =>
    api.post<{ data: GoodsReceiptNote; message: string }>(
      `/procurement/purchase-orders/${poId}/receipts/${grnId}/accept`,
      handoff ? { handoff } : {},
    ),
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
  status: "received" | "matched" | "approved" | "approved_for_payment" | "proforma_submitted" | "rejected" | "paid" | "final_invoice_submitted";
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
  markPaid: (id: number) =>
    api.post<{ data: Invoice; message: string }>(`/procurement/invoices/${id}/mark-paid`),
};

// ─── Procurement — Contracts ─────────────────────────────────────────────────

export interface Contract {
  id: number;
  tenant_id: number;
  procurement_request_id: number | null;
  vendor_id: number;
  purchase_order_id: number | null;
  reference_number: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  value: number;
  currency: string;
  status: "draft" | "active" | "completed" | "terminated";
  signed_at: string | null;
  terminated_at: string | null;
  termination_reason: string | null;
  is_expired: boolean;
  is_expiring_soon: boolean;
  vendor?: Vendor;
  procurement_request?: { id: number; reference_number: string; title: string };
  created_at?: string;
}

export const contractsApi = {
  list: (params?: { status?: string }) =>
    api.get<{ data: Contract[] }>("/procurement/contracts", { params }),
  get: (id: number) =>
    api.get<{ data: Contract }>(`/procurement/contracts/${id}`),
  create: (data: Partial<Contract> & { vendor_id: number; title: string; start_date: string; end_date: string; value: number }) =>
    api.post<{ data: Contract; message: string }>("/procurement/contracts", data),
  activate: (id: number) =>
    api.post<{ data: Contract; message: string }>(`/procurement/contracts/${id}/activate`),
  terminate: (id: number, reason: string) =>
    api.post<{ data: Contract; message: string }>(`/procurement/contracts/${id}/terminate`, { reason }),
  destroy: (id: number) =>
    api.delete<{ message: string }>(`/procurement/contracts/${id}`),
  listMilestones: (contractId: number) =>
    api.get<{ data: ContractMilestone[] }>(`/procurement/contracts/${contractId}/milestones`),
  createMilestone: (contractId: number, data: Partial<ContractMilestone>) =>
    api.post<{ data: ContractMilestone; message: string }>(`/procurement/contracts/${contractId}/milestones`, data),
  completeMilestone: (contractId: number, milestoneId: number) =>
    api.post<{ data: ContractMilestone; message: string }>(`/procurement/contracts/${contractId}/milestones/${milestoneId}/complete`),
};

export interface ContractMilestone {
  id: number;
  contract_id: number;
  title: string;
  description?: string | null;
  due_date?: string | null;
  amount?: number | null;
  currency?: string;
  status: string;
  completed_at?: string | null;
  notes?: string | null;
}

export interface ProcurementTender {
  id: number;
  reference_number: string;
  title: string;
  status: string;
  sealed_mode: boolean;
  submission_deadline?: string | null;
  published_at?: string | null;
  bids_opened_at?: string | null;
  notice?: string | null;
  technical_weight?: number;
  financial_weight?: number;
  min_technical_score?: number;
  scoring?: Array<{
    quote_id: number;
    vendor_name: string;
    technical_score: number | null;
    financial_score: number | null;
    financials_sealed?: boolean;
    quoted_amount?: number | null;
    combined_score?: number | null;
    meets_min_tech?: boolean | null;
  }>;
  procurement_request?: { id: number; reference_number: string; title: string; status: string };
  committee?: { id: number; name: string } | null;
}

export interface ProcurementPolicyProfile {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  donor_codes?: string[];
  direct_purchase_limit: number;
  quotation_limit: number;
  tender_threshold: number;
  minimum_quotes_required: number;
  split_lookback_days: number;
  split_enforcement: string;
  is_active: boolean;
  is_default: boolean;
}

export interface TenderNotice {
  reference_number: string;
  title: string;
  notice?: string | null;
  status: string;
  published_at?: string | null;
  submission_deadline?: string | null;
  sealed_mode?: boolean;
}

export const tendersApi = {
  list: (params?: { status?: string }) =>
    api.get<{ data: ProcurementTender[] }>("/procurement/tenders", { params }),
  get: (id: number) => api.get<{ data: ProcurementTender }>(`/procurement/tenders/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post<{ data: ProcurementTender; message: string }>("/procurement/tenders", data),
  publish: (id: number) => api.post<{ data: ProcurementTender }>(`/procurement/tenders/${id}/publish`),
  close: (id: number) => api.post<{ data: ProcurementTender }>(`/procurement/tenders/${id}/close`),
  openBids: (id: number) => api.post<{ data: ProcurementTender }>(`/procurement/tenders/${id}/open-bids`),
  startEvaluation: (id: number) => api.post<{ data: ProcurementTender }>(`/procurement/tenders/${id}/start-evaluation`),
  comparisonSummary: (id: number) =>
    api.post<{ data: Record<string, unknown>; message: string }>(`/procurement/tenders/${id}/comparison-summary`),
  evaluations: () => api.get<{ data: ProcurementTender[] }>("/procurement/evaluations"),
  bidSubmissions: () => api.get<{ data: Record<string, unknown>[] }>("/procurement/bid-submissions"),
};

export const policyProfilesApi = {
  list: () => api.get<{ data: ProcurementPolicyProfile[] }>("/procurement/policy-profiles"),
  create: (data: Record<string, unknown>) =>
    api.post<{ data: ProcurementPolicyProfile; message: string }>("/procurement/policy-profiles", data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put<{ data: ProcurementPolicyProfile; message: string }>(`/procurement/policy-profiles/${id}`, data),
  activate: (id: number) =>
    api.post<{ data: ProcurementSettings; message: string }>(`/procurement/policy-profiles/${id}/activate`),
  remove: (id: number) => api.delete(`/procurement/policy-profiles/${id}`),
};

export const noticeBoardApi = {
  public: () => api.get<{ data: TenderNotice[] }>("/procurement/notices"),
  staff: () => api.get<{ data: TenderNotice[] }>("/procurement/notice-board"),
};

export const tenderCommitteesApi = {
  list: () => api.get<{ data: Record<string, unknown>[] }>("/procurement/tender-committees"),
  create: (data: Record<string, unknown>) =>
    api.post<{ data: Record<string, unknown>; message: string }>("/procurement/tender-committees", data),
  storeMeeting: (id: number, data: Record<string, unknown>) =>
    api.post<{ data: Record<string, unknown> }>(`/procurement/tender-committees/${id}/meetings`, data),
};

export const procurementPlansApi = {
  list: () => api.get<{ data: Record<string, unknown>[] }>("/procurement/plans"),
  get: (id: number) => api.get<{ data: Record<string, unknown> }>(`/procurement/plans/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post<{ data: Record<string, unknown>; message: string }>("/procurement/plans", data),
  addItem: (id: number, data: Record<string, unknown>) =>
    api.post<{ data: Record<string, unknown> }>(`/procurement/plans/${id}/items`, data),
};

export const catalogueApi = {
  list: (params?: { vendor_id?: number }) =>
    api.get<{ data: Record<string, unknown>[] }>("/procurement/catalogue", { params }),
  create: (data: Record<string, unknown>) =>
    api.post<{ data: Record<string, unknown>; message: string }>("/procurement/catalogue", data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put<{ data: Record<string, unknown> }>(`/procurement/catalogue/${id}`, data),
  history: (id: number) => api.get<{ data: Record<string, unknown>[] }>(`/procurement/catalogue/${id}/history`),
};

// ─── Procurement — Analytics ──────────────────────────────────────────────────

export interface ProcurementSummary {
  total_requests: number;
  total_spend: number;
  avg_cycle_time_days: number;
  active_contracts: number;
}

export interface ProcurementFlag {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  vendor_id?: number;
  request_id?: number;
}

export const procurementAnalyticsApi = {
  summary: () =>
    api.get<{ data: ProcurementSummary }>("/procurement/analytics/summary"),
  spendByCategory: () =>
    api.get<{ data: { category: string; total: number }[] }>("/procurement/analytics/spend-by-category"),
  vendorPerformance: () =>
    api.get<{ data: { vendor_id: number; vendor_name: string; po_count: number; total_value: number }[] }>("/procurement/analytics/vendor-performance"),
  flags: () =>
    api.get<{ data: ProcurementFlag[] }>("/procurement/analytics/flags"),
};

// ─── Finance (Salary Advances) ───────────────────────────────────────────────

export interface SalaryAdvanceRequest {
  id: number;
  reference_number: string;
  advance_type: string;
  amount: number;
  approved_amount?: number | null;
  currency: string;
  repayment_months: number;
  purpose: string;
  justification: string | null;
  status: string;
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  requester?: User;
  approver?: User;
  payslip_id?: number | null;
  net_salary_at_request?: number | null;
  gross_salary_at_request?: number | null;
  max_eligible_amount?: number | null;
  eligibility_status?: string | null;
  salary_basis?: string | null;
  deduction_authority_confirmed?: boolean;
  intended_recovery_payroll_date?: string | null;
  payment_status?: string | null;
  payment_reference?: string | null;
  payment_method?: string | null;
  recovery_status?: string | null;
  recovered_amount?: number | null;
  finance_certified_at?: string | null;
  not_eligible_reason?: string | null;
  paid_at?: string | null;
  closed_at?: string | null;
  personnel_file_id?: number | null;
  personnel_file_document_id?: number | null;
  personnel_file_filed_at?: string | null;
  personnel_file_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  payslip?: Payslip | null;
  balance_register?: BalanceRegister | null;
}

export interface Payslip {
  id: number;
  tenant_id?: number;
  user_id?: number;
  period_month: number;
  period_year: number;
  gross_amount: number;
  net_amount: number;
  currency: string;
  employment_type?: string | null;
  period_end_date?: string | null;
  total_deductions?: number | null;
  total_company_contributions?: number | null;
  /**
   * Structured breakdown produced by PayslipAutoFillService.
   * Cast server-side as `array`; null/undefined when auto-fill has not run.
   */
  details?: PayslipDetails | null;
  file_path?: string | null;
  period_label?: string;
  issued_at: string | null;
  confirmation_status?: "pending" | "confirmed" | "rejected";
  confirmed_by?: number | null;
  confirmed_at?: string | null;
  confirmation_notes?: string | null;
  confirmed_by_user?: { id: number; name: string } | null;
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
  submitAdvance: (id: number, data?: { deduction_authority_confirmed?: boolean }) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/submit`, data ?? {}),
  approveAdvance: (id: number, comment?: string, approvedAmount?: number) =>
    api.post<{ data: SalaryAdvanceRequest; message: string; notified_approvers: string[] }>(
      `/finance/advances/${id}/approve`,
      {
        ...(comment ? { comment } : {}),
        ...(approvedAmount != null ? { approved_amount: approvedAmount } : {}),
      }
    ),
  rejectAdvance: (id: number, reason: string) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/reject`, { reason }),
  returnAdvanceForCorrection: (id: number, comment: string) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/return`, { comment }),
  withdrawAdvance: (id: number) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/withdraw`),
  resubmitAdvance: (id: number) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/resubmit`),
  financeCertifyAdvance: (id: number, data: {
    confirmed_net_salary: number;
    confirmed_gross_salary?: number;
    recommended_amount?: number;
    intended_recovery_payroll_date: string;
    eligible: boolean;
    comments?: string;
  }) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/finance-certify`, data),
  financeReturnAdvance: (id: number, reason: string) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/finance-return`, { reason }),
  markAdvanceNotEligible: (id: number, reason: string) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/mark-not-eligible`, { reason }),
  recordAdvancePayment: (id: number, data: { payment_reference: string; payment_method: string; payment_date?: string }) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/record-payment`, data),
  scheduleAdvanceRecovery: (id: number, data?: { intended_recovery_payroll_date?: string }) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/schedule-recovery`, data ?? {}),
  recordAdvanceRecovery: (id: number, data: { amount: number; reference_doc: string; notes?: string }) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/record-recovery`, data),
  closeAdvance: (id: number) =>
    api.post<{ data: SalaryAdvanceRequest; message: string }>(`/finance/advances/${id}/close`),
  getAdvanceLedger: (id: number) =>
    api.get<{ data: { register: BalanceRegister | null; transactions: unknown[]; balance: number } }>(
      `/finance/advances/${id}/ledger`
    ),
  getAdvancePdfUrl: (id: number) => `/finance/advances/${id}/pdf`,
  downloadAdvancePdf: (id: number) =>
    api.get<Blob>(`/finance/advances/${id}/pdf`, { responseType: "blob" }),
  getAdvanceCertificate: (id: number) =>
    api.get<{ data: SalaryAdvanceRequest }>(`/finance/advances/${id}/certificate`),
  getSalaryAdvanceEligibility: () =>
    api.get<{
      eligible: boolean;
      reason?: string;
      net_salary: number | null;
      gross_salary: number | null;
      max_eligible: number | null;
      salary_basis?: string;
      payslip: { id: number; period_month: number; period_year: number; currency: string } | null;
      exposure?: {
        has_outstanding_balance: boolean;
        outstanding_balance: number;
        has_active_advance: boolean;
        blocked: boolean;
        reasons: string[];
        active_advance?: { id: number; reference_number: string; status: string; amount: number } | null;
      };
      policy?: {
        version: string;
        recovery_rule: string;
        max_salary_percentage: number;
        salary_basis: string;
        admin_review_required: boolean;
      };
      policy_exceptions?: SalaryAdvancePolicyException[];
      intended_recovery_payroll_date?: string;
    }>("/finance/advances/eligibility"),
  getSalaryAdvanceDashboard: () =>
    api.get<{
      data: {
        queues: Record<string, number>;
        exposure: { total_outstanding_balance: number; outstanding_count: number };
        by_status: Record<string, number>;
      };
    }>("/finance/advances/dashboard"),
  getSalaryAdvanceEmployeeSummary: () =>
    api.get<{
      data: {
        eligibility: {
          eligible: boolean;
          reason?: string;
          net_salary: number | null;
          max_eligible: number | null;
          salary_basis?: string;
          exposure?: {
            has_outstanding_balance: boolean;
            outstanding_balance: number;
            blocked: boolean;
            reasons: string[];
          };
          policy?: {
            version: string;
            max_salary_percentage: number;
            recovery_rule: string;
          };
          intended_recovery_payroll_date?: string;
        };
        current_request: SalaryAdvanceRequest | null;
        active_advance: { id: number; reference_number: string; status: string; amount: number } | null;
        history: SalaryAdvanceRequest[];
      };
    }>("/finance/advances/employee-summary"),
  listSalaryAdvanceReconciliations: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<SalaryAdvanceReconciliation>>("/finance/advances/reconciliations", { params }),
  resolveSalaryAdvanceReconciliation: (
    advanceId: number,
    reconciliationId: number,
    data: { resolution_notes: string; outcome?: string }
  ) =>
    api.post<{ data: SalaryAdvanceReconciliation; message: string }>(
      `/finance/advances/${advanceId}/reconciliations/${reconciliationId}/resolve`,
      data
    ),
  listSalaryAdvancePolicies: () =>
    api.get<{ data: SalaryAdvancePolicyVersion[] }>("/finance/advances/policies"),
  createSalaryAdvancePolicy: (data: Record<string, unknown>) =>
    api.post<{ data: SalaryAdvancePolicyVersion; message: string }>("/finance/advances/policies", data),
  getSalaryAdvancePayrollIntegration: () =>
    api.get<{
      data: {
        mode: string;
        adapter: string;
        driver?: string;
        enabled: boolean;
        provider: string | null;
        message: string;
        coming_soon: boolean;
        supports_auto_push: boolean;
        supports_auto_pull: boolean;
        recording_mode?: string;
      };
    }>("/finance/advances/payroll-integration"),
  listSalaryAdvancePolicyExceptions: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<SalaryAdvancePolicyException>>("/finance/advances/policy-exceptions", { params }),
  createSalaryAdvancePolicyException: (data: {
    employee_id: number;
    exception_type: string;
    reason: string;
    justification: string;
    effective_from: string;
    effective_to?: string;
    linked_advance_id?: number;
  }) =>
    api.post<{ data: SalaryAdvancePolicyException; message: string }>(
      "/finance/advances/policy-exceptions",
      data
    ),
  approveSalaryAdvancePolicyException: (id: number, data?: { decision_notes?: string }) =>
    api.post<{ data: SalaryAdvancePolicyException; message: string }>(
      `/finance/advances/policy-exceptions/${id}/approve`,
      data ?? {}
    ),
  revokeSalaryAdvancePolicyException: (id: number, data?: { decision_notes?: string }) =>
    api.post<{ data: SalaryAdvancePolicyException; message: string }>(
      `/finance/advances/policy-exceptions/${id}/revoke`,
      data ?? {}
    ),
};

export interface SalaryAdvancePolicyException {
  id: number;
  employee_id: number;
  exception_type: string;
  status: string;
  reason: string;
  justification?: string;
  decision_notes?: string | null;
  effective_from: string;
  effective_to?: string | null;
  applies_automatically?: boolean;
  employee?: { id: number; name: string; email?: string };
  note?: string;
}

export interface SalaryAdvanceReconciliation {
  id: number;
  tenant_id: number | null;
  salary_advance_request_id: number;
  status: string;
  expected_amount: number | null;
  recovered_amount: number | null;
  variance_amount: number | null;
  reason: string | null;
  resolution_notes: string | null;
  outcome: string | null;
  resolved_at: string | null;
  created_at?: string;
  advance?: SalaryAdvanceRequest;
  opened_by_user?: { id: number; name: string };
  resolved_by_user?: { id: number; name: string };
}

export interface SalaryAdvancePolicyVersion {
  id: number;
  version: string;
  effective_from: string;
  effective_to: string | null;
  max_salary_percentage: number;
  salary_basis: string;
  max_concurrent_advances: number;
  full_repayment_required: boolean;
  recovery_rule: string;
  final_approver_role: string;
  finance_certification_required: boolean;
  admin_review_required: boolean;
  active: boolean;
  configuration?: Record<string, unknown> | null;
}

// ─── BCRE: Balance Control & Reconciliation Engine ───────────────────────────

export interface BalanceRegister {
  id: number;
  tenant_id: number;
  module_type: "salary_advance" | "imprest";
  employee_id: number;
  source_request_type: string;
  source_request_id: number;
  reference_number: string;
  approved_amount: number;
  total_processed: number;
  balance: number;
  installment_amount: number | null;
  recovery_start_date: string | null;
  estimated_payoff_date: string | null;
  status: "active" | "closed" | "disputed" | "locked";
  period_locked_at: string | null;
  locked_by: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  transactions_count?: number;
  employee?: User;
  creator?: User;
  locker?: User;
  transactions?: BalanceTransaction[];
  acknowledgements?: BalanceAcknowledgement[];
}

export interface BalanceTransaction {
  id: number;
  register_id: number;
  type: "disbursement" | "recovery" | "adjustment" | "write_off";
  amount: number;
  previous_balance: number;
  new_balance: number;
  reference_doc: string | null;
  notes: string | null;
  supporting_document_path: string | null;
  created_by: number;
  verification_status: "pending" | "approved" | "rejected";
  created_at: string;
  maker?: User;
  createdBy?: User;
  verification?: BalanceVerification;
  acknowledgement?: BalanceAcknowledgement;
}

export interface BalanceVerification {
  id: number;
  transaction_id: number;
  verified_by: number;
  status: "approved" | "rejected" | "correction_requested";
  comments: string | null;
  verified_at: string;
  verifier?: User;
}

export interface BalanceAcknowledgement {
  id: number;
  register_id: number;
  transaction_id: number | null;
  employee_id: number;
  status: "pending" | "confirmed" | "disputed";
  dispute_reason: string | null;
  responded_at: string | null;
  employee?: User;
}

export interface BcreDashboard {
  total_active_registers: number;
  total_outstanding_balance: number;
  pending_verifications: number;
  disputed_registers: number;
  registers_by_module: Record<string, number>;
}

export const bcreApi = {
  dashboard: () =>
    api.get<{ data: BcreDashboard }>("/finance/balance-registers/dashboard"),
  exceptions: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<BalanceRegister>>("/finance/balance-registers/exceptions", { params }),
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<BalanceRegister>>("/finance/balance-registers", { params }),
  get: (id: number) =>
    api.get<{ data: BalanceRegister }>(`/finance/balance-registers/${id}`),
  create: (data: Partial<BalanceRegister>) =>
    api.post<{ data: BalanceRegister; message: string }>("/finance/balance-registers", data),
  update: (id: number, data: Partial<BalanceRegister>) =>
    api.put<{ data: BalanceRegister; message: string }>(`/finance/balance-registers/${id}`, data),
  lock: (id: number) =>
    api.post<{ data: BalanceRegister; message: string }>(`/finance/balance-registers/${id}/lock`),
  unlock: (id: number) =>
    api.post<{ data: BalanceRegister; message: string }>(`/finance/balance-registers/${id}/unlock`),
  acknowledge: (id: number, data: { status: "confirmed" | "disputed"; dispute_reason?: string }) =>
    api.post<{ data: BalanceAcknowledgement; message: string }>(`/finance/balance-registers/${id}/acknowledge`, data),
  listTransactions: (registerId: number, params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<BalanceTransaction>>(`/finance/balance-registers/${registerId}/transactions`, { params }),
  createTransaction: (registerId: number, data: {
    type: string;
    amount: number;
    notes?: string;
    reference_doc?: string;
    supporting_document_path?: string;
  }) =>
    api.post<{ data: BalanceTransaction; message: string }>(`/finance/balance-registers/${registerId}/transactions`, data),
  getVerification: (registerId: number, txnId: number) =>
    api.get<{ data: BalanceTransaction }>(`/finance/balance-registers/${registerId}/transactions/${txnId}/verify`),
  verify: (registerId: number, txnId: number, data: {
    status: "approved" | "rejected" | "correction_requested";
    comments?: string;
  }) =>
    api.post<{ data: BalanceVerification; message: string }>(
      `/finance/balance-registers/${registerId}/transactions/${txnId}/verify`,
      data
    ),
};

// ─── Living Payslip: Salary Assignments + Line Configs ───────────────────────

export interface EmployeeSalaryAssignment {
  id: number;
  user_id: number;
  grade_band_id: number;
  salary_scale_id: number | null;
  notch_number: number;
  effective_from: string;
  effective_to: string | null;
  employment_type: string | null;
  notes: string | null;
  created_by: number;
  employee?: User;
  grade_band?: { id: number; code: string; label: string };
}

export interface PayslipLineConfig {
  id: number;
  user_id: number;
  component_key: string;
  label: string;
  component_type: "earning" | "deduction" | "company_contribution" | "info";
  source: "system" | "manual";
  fixed_amount: number | null;
  is_visible: boolean;
  sort_order: number;
}

export interface PayslipDetails {
  header: {
    employee_name: string;
    employee_id: number;
    period: string;
    employment_type: string;
    grade_band: string;
    notch: number;
  };
  earnings: Array<{ key: string; label: string; amount: number; source: string }>;
  deductions: Array<{ key: string; label: string; amount: number; source: string }>;
  company_contributions: Array<{ key: string; label: string; amount: number; source: string }>;
  leave_balances: Array<{ label: string; days: number }>;
  gross_amount: number;
  total_deductions: number;
  net_amount: number;
}

export const salaryAssignmentApi = {
  list: (params?: { user_id?: number }) =>
    api.get<{ data: EmployeeSalaryAssignment[] }>("/admin/salary-assignments", { params }),
  create: (data: Partial<EmployeeSalaryAssignment>) =>
    api.post<{ message: string; data: EmployeeSalaryAssignment }>("/admin/salary-assignments", data),
  update: (id: number, data: Partial<EmployeeSalaryAssignment>) =>
    api.put<{ message: string; data: EmployeeSalaryAssignment }>(`/admin/salary-assignments/${id}`, data),
  remove: (id: number) =>
    api.delete(`/admin/salary-assignments/${id}`),
};

export const payslipConfigApi = {
  list: (userId: number) =>
    api.get<{ data: PayslipLineConfig[] }>("/admin/payslip-configs", { params: { user_id: userId } }),
  create: (data: Partial<PayslipLineConfig>) =>
    api.post<{ message: string; data: PayslipLineConfig }>("/admin/payslip-configs", data),
  update: (id: number, data: Partial<PayslipLineConfig>) =>
    api.put<{ message: string; data: PayslipLineConfig }>(`/admin/payslip-configs/${id}`, data),
  remove: (id: number) =>
    api.delete(`/admin/payslip-configs/${id}`),
  generateDefaults: (userId: number) =>
    api.post<{ message: string; data: PayslipLineConfig[] }>("/admin/payslip-configs/defaults", { user_id: userId }),
};

// Extend adminPayslipApi with refresh
export const payslipRefreshApi = {
  refresh: (payslipId: number) =>
    api.post<{ message: string; data: object }>(`/admin/payslips/${payslipId}/refresh`),
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
  getTimesheetTravelDays: (weekStart: string, weekEnd: string) =>
    api.get<{ data: Record<string, { purpose: string; destination: string; reference: string }> }>(
      "/hr/timesheets/travel-days",
      { params: { week_start: weekStart, week_end: weekEnd } }
    ),
  getTimesheetHolidayDates: (start: string, end: string) =>
    api.get<{ data: Record<string, { name: string; is_paid: boolean }> }>(
      "/hr/timesheets/holiday-dates",
      { params: { start, end } }
    ),
  confirmPayslip: (id: number, data: { confirmation_status: "confirmed" | "rejected"; confirmation_notes?: string }) =>
    api.post<{ message: string; payslip: Payslip }>(`/hr/payslips/${id}/confirm`, data),
};

// ─── Holiday Calendars ───────────────────────────────────────────────────────

export interface HolidayCalendar {
  id: number;
  tenant_id: number;
  name: string;
  country_code: string | null;
  is_default: boolean;
  dates_count?: number;
}

export interface HolidayDate {
  id: number;
  holiday_calendar_id: number;
  holiday_name: string;
  date: string;
  is_paid_holiday: boolean;
}

export interface HolidayDateInput {
  date: string;
  holiday_name: string;
  is_paid_holiday?: boolean;
}

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
  procurement_request_id?: number | null;
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

export interface ProgrammeDocument {
  id: number;
  programme_id: number;
  title: string;
  document_type: string;
  word_count: number | null;
  translation_required: boolean;
  source_language: string | null;
  target_languages: string[] | null;
  owner_user_id: number | null;
  owner_name: string | null;
  owner_organisation: string | null;
  deadline: string | null;
  budget_line: string | null;
  comments: string | null;
}

export interface ProgrammeArrivalDeparture {
  id: number;
  programme_id: number;
  category: string;
  arrival_date: string | null;
  departure_date: string | null;
  airport: string | null;
  flight_details: string | null;
  transport_required: boolean;
  accommodation_required: boolean;
  comments: string | null;
}

/** Support Services (Section H) — verified against ProgrammeController::sectionRules() */
export const SUPPORT_SERVICE_OPTIONS: { key: string; label: string }[] = [
  { key: "ground_transport", label: "Ground Transport" },
  { key: "air_travel", label: "Air Travel" },
  { key: "interpretation_equipment", label: "Interpretation Equipment" },
  { key: "zoom_hybrid", label: "Zoom / Hybrid Meeting Support" },
  { key: "audio_recording", label: "Audio Recording" },
  { key: "video_recording", label: "Video Recording" },
  { key: "live_streaming", label: "Live Streaming" },
  { key: "data_projector", label: "Data Projector" },
  { key: "conference_bags", label: "Conference Bags" },
  { key: "regalia", label: "Regalia" },
  { key: "report_newsletter", label: "Report / Newsletter" },
  { key: "ict_support", label: "ICT Support" },
  { key: "comms_support", label: "Communications Support" },
  { key: "procurement_support", label: "Procurement Support" },
  { key: "finance_support", label: "Finance Support" },
  { key: "admin_support", label: "Admin Support" },
  { key: "research_support", label: "Research Support" },
  { key: "other", label: "Other" },
];

export interface Programme {
  id: number;
  reference_number: string;
  title: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "active" | "on_hold" | "completed" | "financially_closed" | "archived"
    | "amended" | "amendment_draft" | "amendment_pending_approval" | "superseded";
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
  // Venue
  venue_country: string | null;
  venue_city: string | null;
  venue_proposed_hotel: string | null;
  venue_accommodation_required: boolean | null;
  venue_accommodation_count: number | null;
  venue_conferencing_required: boolean | null;
  venue_conferencing_participants: number | null;
  venue_quotation_attached: boolean | null;
  venue_hotel_quotation_attached: boolean | null;
  venue_accessibility_requirements: string | null;
  venue_security_considerations: string | null;
  venue_comments: string | null;
  // Budget variance
  proposed_dsa_rate: number | null;
  original_budget_rate: number | null;
  dsa_variance_reason: string | null;
  proposed_participants: number | null;
  budgeted_participants: number | null;
  participants_variance_reason: string | null;
  proposed_funding_difference: number | null;
  estimated_activity_amount: number | null;
  // Finance review — writable only via programmeApi.updateFinanceReview(), read-only everywhere else
  budget_availability_status: string | null;
  finance_comments: string | null;
  // Personnel / consultants
  secretariat_staff_required: boolean | null;
  secretariat_staff_count: number | null;
  consultants_required: boolean | null;
  consultants_count: number | null;
  consultants_rate: number | null;
  resource_persons_required: boolean | null;
  resource_persons_count: number | null;
  resource_persons_rate: number | null;
  rapporteurs_required: boolean | null;
  rapporteurs_count: number | null;
  rapporteurs_rate: number | null;
  media_liaison_required: boolean | null;
  media_liaison_count: number | null;
  local_support_required: boolean | null;
  local_support_count: number | null;
  local_support_rate: number | null;
  personnel_comments: string | null;
  // Interpretation / translation
  interpretation_required: boolean | null;
  en_fr_required: boolean | null;
  en_fr_interpreters_count: number | null;
  en_pt_required: boolean | null;
  en_pt_interpreters_count: number | null;
  fr_pt_required: boolean | null;
  fr_pt_interpreters_count: number | null;
  interpreter_rate: number | null;
  interpreter_source: string | null;
  interpreter_source_other_note: string | null;
  interpretation_equipment_required: boolean | null;
  translation_required: boolean | null;
  languages_required: string[] | null;
  interpretation_comments: string | null;
  // Support services
  support_services: string[] | null;
  support_services_other_note: string | null;
  // Conflict of interest (conflict_declared_by/at are server-stamped only, not accepted from the client)
  conflict_declared: boolean | null;
  conflict_details: string | null;
  conflict_mitigation: string | null;
  // Declaration
  declaration_confirmed: boolean | null;
  declaration_version: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  // Amendment tracking — amended_from_id links an amendment back to the PIF it was
  // created from; me_status is server-computed (Programme::getMeStatusAttribute()),
  // never sent by the client.
  amended_from_id: number | null;
  me_status: string;
  creator?: User;
  approver?: User;
  responsible_officer_user?: User;
  activities?: ProgrammeActivity[];
  milestones?: ProgrammeMilestone[];
  deliverables?: ProgrammeDeliverable[];
  budget_lines?: ProgrammeBudgetLine[];
  procurement_items?: ProgrammeProcurementItem[];
  documents?: ProgrammeDocument[];
  arrival_departures?: ProgrammeArrivalDeparture[];
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
  submit: (id: number, data: { declaration_confirmed: boolean }) =>
    api.post<{ data: Programme; message: string }>(`/programmes/${id}/submit`, data),
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

  // Finance review
  updateFinanceReview: (
    programmeId: number,
    data: {
      budget_availability_status: string;
      finance_comments?: string;
      budget_line_id?: number;
      commitment_amount?: number;
    },
  ) => api.put<{ data: Programme; message: string }>(`/programmes/${programmeId}/finance-review`, data),

  // Documents
  addDocument: (programmeId: number, data: Partial<ProgrammeDocument>) =>
    api.post<{ data: ProgrammeDocument; message: string }>(`/programmes/${programmeId}/documents`, data),
  updateDocument: (programmeId: number, documentId: number, data: Partial<ProgrammeDocument>) =>
    api.put<{ data: ProgrammeDocument; message: string }>(`/programmes/${programmeId}/documents/${documentId}`, data),
  deleteDocument: (programmeId: number, documentId: number) =>
    api.delete(`/programmes/${programmeId}/documents/${documentId}`),

  // Arrival / Departure
  addArrivalDeparture: (programmeId: number, data: Partial<ProgrammeArrivalDeparture>) =>
    api.post<{ data: ProgrammeArrivalDeparture; message: string }>(`/programmes/${programmeId}/arrival-departures`, data),
  updateArrivalDeparture: (programmeId: number, rowId: number, data: Partial<ProgrammeArrivalDeparture>) =>
    api.put<{ data: ProgrammeArrivalDeparture; message: string }>(`/programmes/${programmeId}/arrival-departures/${rowId}`, data),
  deleteArrivalDeparture: (programmeId: number, rowId: number) =>
    api.delete(`/programmes/${programmeId}/arrival-departures/${rowId}`),

  // Procurement transfer
  sendToProcurement: (programmeId: number, data: { procurement_item_ids: number[]; request_title: string; category?: string }) =>
    api.post<{ data: any; message: string }>(`/programmes/${programmeId}/send-to-procurement`, data),
  sendToTravel: (programmeId: number, data: {
    traveller_ids: number[];
    purpose?: string;
    departure_date?: string;
    return_date?: string;
    destination_country?: string;
    destination_city?: string;
    mission_id?: number;
    mission_title?: string;
  }) =>
    api.post<{ data: TravelRequest[]; message: string }>(`/programmes/${programmeId}/send-to-travel`, data),

  // PDF
  pdfUrl: (programmeId: number) => `${api.defaults.baseURL}/programmes/${programmeId}/pdf`,

  // Amendment
  amend: (programmeId: number) =>
    api.post<{ data: Programme; message: string }>(`/programmes/${programmeId}/amend`),
  submitAmendment: (programmeId: number, data: { declaration_confirmed: boolean }) =>
    api.post<{ data: Programme; message: string }>(`/programmes/${programmeId}/submit-amendment`, data),
  diff: (programmeId: number) =>
    api.get<{ data: Record<string, { before: unknown; after: unknown }> }>(`/programmes/${programmeId}/diff`),

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

// ─── Ledger Verifications ─────────────────────────────────────────────────────
export interface LedgerVerification {
  id: number;
  tenant_id: number;
  initiated_by: number | null;
  type: "manual" | "scheduled";
  status: "pass" | "fail";
  manifest_hash: string | null;
  entries_checked: number;
  notes: string | null;
  verified_at: string;
  created_at: string;
  initiator?: { id: number; name: string; email: string } | null;
}

export const ledgerVerificationsApi = {
  list: (params?: { per_page?: number; page?: number }) =>
    api.get<{ data: LedgerVerification[]; current_page: number; last_page: number; total: number }>("/admin/audit/ledger/verifications", { params }),
  verify: (notes?: string) =>
    api.post<{ data: LedgerVerification; message: string }>("/admin/audit/ledger/verify", { notes }),
  get: (id: number) =>
    api.get<LedgerVerification>(`/admin/audit/ledger/verifications/${id}`),
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
export type AssignmentPriority = "low" | "medium" | "high" | "urgent" | "critical";
export type AssignmentStatus =
  | "draft" | "issued" | "awaiting_acceptance" | "accepted"
  | "active" | "at_risk" | "blocked" | "delayed"
  | "completed" | "closed" | "returned" | "cancelled";

export type AcceptanceDecision =
  | "accepted" | "clarification_requested" | "deadline_proposed" | "rejected";

export type UpdateType =
  | "update" | "comment" | "feedback" | "escalation" | "closure_request" | "system";

export type BlockerType = string;

export type AssignmentDeadlineState =
  | "none" | "future" | "due_soon" | "due_today" | "overdue"
  | "completed_on_time" | "completed_late" | "cancelled_before_due";

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

export interface AssignmentParticipant {
  id: number;
  assignment_id: number;
  user_id: number;
  role: "contributor" | "watcher" | "reviewer";
  user?: User;
}

export interface Assignment {
  id: number;
  reference_number: string;
  title: string;
  description: string;
  objective: string | null;
  expected_output: string | null;
  acceptance_criteria?: string | null;
  evidence_required?: boolean;
  completion_instructions?: string | null;
  type: AssignmentType;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  created_by: number;
  assigned_to: number | null;
  department_id: number | null;
  department_claim_due_at?: string | null;
  due_date: string;
  start_date: string | null;
  checkin_frequency: "daily" | "weekly" | "biweekly" | "monthly" | null;
  linked_programme_id: number | null;
  linked_event_id: number | null;
  source_type?: string;
  source_id?: number | null;
  source_reference?: string | null;
  source_title?: string | null;
  source_purpose?: string | null;
  is_confidential: boolean;
  review_required?: boolean;
  reviewer_id?: number | null;
  review_status?: string;
  verified_at?: string | null;
  verified_by?: number | null;
  progress_percent: number;
  escalation_level?: number;
  is_template?: boolean;
  template_id?: number | null;
  deadline_state?: AssignmentDeadlineState;
  is_overdue_flag?: boolean;
  acceptance_decision: AcceptanceDecision | null;
  acceptance_notes: string | null;
  proposed_deadline: string | null;
  accepted_at: string | null;
  blocker_type: BlockerType | null;
  blocker_details: string | null;
  blocker_owner_id?: number | null;
  closure_notes: string | null;
  rejection_reason: string | null;
  issued_at: string | null;
  closed_at: string | null;
  has_performance_note: boolean;
  completion_rating: number | null;
  created_at: string;
  creator?: User;
  assignee?: User;
  reviewer?: User;
  blocker_owner?: User;
  department?: { id: number; name: string };
  updates?: AssignmentUpdate[];
  participants?: AssignmentParticipant[];
  checklist_items?: AssignmentChecklistItem[];
}

export interface AssignmentChecklistItem {
  id: number;
  assignment_id: number;
  title: string;
  description?: string | null;
  sequence?: number;
  mandatory?: boolean;
  completed?: boolean;
  completed_at?: string | null;
  assignee_id?: number | null;
  due_at?: string | null;
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
  awaiting_my_review?: number;
  unassigned?: number;
  escalated?: number;
  by_priority: Record<string, number>;
  by_status: Record<string, number>;
}

export const assignmentsApi = {
  stats: () => api.get<AssignmentStats>("/assignments/stats"),
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Assignment>>("/assignments/", { params }),
  mine: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Assignment>>("/assignments/mine", { params }),
  team: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Assignment>>("/assignments/team", { params }),
  register: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Assignment>>("/assignments/register", { params }),
  calendar: (params?: { from?: string; to?: string; scope?: string }) =>
    api.get<{ from: string; to: string; scope: string; data: Array<Record<string, unknown>> }>("/assignments/calendar", { params }),
  reviewQueue: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Assignment>>("/assignments/review-queue", { params }),
  reportsSummary: () => api.get<{ stats: AssignmentStats; by_source: Record<string, number>; blockers: Record<string, number>; performance_scoring: string }>("/assignments/reports/summary"),
  weeklySummaryFeed: (params?: { period_start?: string; period_end?: string }) =>
    api.get<Record<string, unknown>>("/assignments/weekly-summary-feed", { params }),
  get: (id: number) =>
    api.get<Assignment>(`/assignments/${id}`),
  create: (data: Partial<Assignment> & Record<string, unknown>) =>
    api.post<{ data: Assignment; message: string }>("/assignments/", data),
  fromSource: (data: Partial<Assignment> & Record<string, unknown>) =>
    api.post<{ data: Assignment; message: string }>("/assignments/from-source", data),
  update: (id: number, data: Partial<Assignment>) =>
    api.put<{ data: Assignment; message: string }>(`/assignments/${id}`, data),
  delete: (id: number) =>
    api.delete(`/assignments/${id}`),
  issue: (id: number) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/issue`),
  accept: (id: number, data: { decision: AcceptanceDecision; notes?: string; proposed_deadline?: string }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/accept`, data),
  claim: (id: number, data?: { assigned_to?: number }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/claim`, data ?? {}),
  start: (id: number) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/start`),
  addUpdate: (id: number, data: { type?: UpdateType; progress_percent?: number; notes: string; blocker_type?: BlockerType; blocker_details?: string; blocker_owner_id?: number }) =>
    api.post<{ data: AssignmentUpdate; message: string }>(`/assignments/${id}/updates`, data),
  block: (id: number, data: { blocker_type: string; blocker_owner_id: number; blocker_details?: string }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/block`, data),
  unblock: (id: number, data?: { notes?: string }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/unblock`, data ?? {}),
  complete: (id: number, data?: { notes?: string }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/complete`, data),
  verify: (id: number, data: { decision: string; comments?: string; follow_up_required?: boolean }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/verify`, data),
  close: (id: number, data?: { notes?: string; rating?: number }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/close`, data),
  returnAssignment: (id: number, data: { reason: string }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/return`, data),
  cancel: (id: number, data?: { reason?: string }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/cancel`, data),
  reassign: (id: number, data: { assigned_to: number; reason: string; acted_via_delegation_id?: number }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/reassign`, data),
  changeDueDate: (id: number, data: { due_date: string; reason: string }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/change-due-date`, data),
  addChecklistItem: (id: number, data: { title: string; description?: string; mandatory?: boolean; assignee_id?: number; due_at?: string }) =>
    api.post<{ data: AssignmentChecklistItem; message: string }>(`/assignments/${id}/checklist`, data),
  toggleChecklistItem: (id: number, itemId: number, completed: boolean) =>
    api.post<{ data: AssignmentChecklistItem; message: string }>(`/assignments/${id}/checklist/${itemId}/toggle`, { completed }),
  createTemplate: (data: Partial<Assignment> & Record<string, unknown>) =>
    api.post<{ data: Assignment; message: string }>("/assignments/templates", data),
  generateFromTemplate: (id: number, data?: { due_date?: string }) =>
    api.post<{ data: Assignment; message: string }>(`/assignments/${id}/generate`, data ?? {}),
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
  registry_reference?: string | null;
  title: string;
  subject: string;
  body: string | null;
  summary?: string | null;
  type: "internal_memo" | "external" | "diplomatic_note" | "procurement";
  priority: "low" | "normal" | "high" | "urgent";
  language: "en" | "fr" | "pt";
  status: string;
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
  received_at?: string | null;
  registered_at?: string | null;
  confidentiality?: string;
  content_restricted?: boolean;
  primary_owner_id?: number | null;
  primary_owner?: { id: number; name: string; email?: string } | null;
  sender_name?: string | null;
  sender_organisation?: string | null;
  sender_deadline?: string | null;
  internal_deadline?: string | null;
  final_deadline?: string | null;
  original_immutable_at?: string | null;
  signed_immutable_at?: string | null;
  sg_instruction?: string | null;
  sg_action?: string | null;
  created_at: string;
  updated_at: string;
  creator?: { id: number; name: string; email: string };
  reviewer?: { id: number; name: string } | null;
  approver?: { id: number; name: string } | null;
  recipients?: CorrespondenceRecipient[];
  owners?: Array<{ id: number; role: string; user?: { id: number; name: string } }>;
  subject_files?: Array<{ id: number; file_code: string; title: string }>;
}

export interface CorrespondenceSubjectFile {
  id: number;
  file_code: string;
  title: string;
  description: string | null;
  status: string;
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

export interface CorrespondenceMailboxSettings {
  id?: number;
  mailbox_address?: string | null;
  enabled?: boolean;
  notes?: string | null;
}

export interface CorrespondenceMailboxSuggestion {
  id: number;
  message_id: string;
  subject?: string | null;
  from_address?: string | null;
  from_name?: string | null;
  received_at?: string | null;
  body_preview?: string | null;
  status: string;
  correspondence_id?: number | null;
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
  registerIncoming: (formData: FormData) =>
    api.post<{ data: CorrespondenceLetter; message: string }>("/correspondence/letters/incoming/register", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  get: (id: number) =>
    api.get<{ data: CorrespondenceLetter; can_view_content?: boolean }>("/correspondence/letters/" + id),
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
  sgRoute: (id: number, data: Record<string, unknown>) =>
    api.post<{ data: CorrespondenceLetter; message: string }>(`/correspondence/letters/${id}/sg-route`, data),
  acknowledge: (id: number, ack_status: "viewed" | "accepted" | "misrouted") =>
    api.post(`/correspondence/letters/${id}/acknowledge`, { ack_status }),
  addNote: (id: number, body: string) =>
    api.post(`/correspondence/letters/${id}/notes`, { body }),
  listNotes: (id: number) => api.get<{ data: Array<{ id: number; body: string; author?: { name: string } }> }>(`/correspondence/letters/${id}/notes`),
  sign: (id: number, comment?: string) =>
    api.post(`/correspondence/letters/${id}/sign`, { comment }),
  dispatch: (id: number, data: Record<string, unknown>) =>
    api.post(`/correspondence/letters/${id}/dispatch`, data),
  linkAssignment: (id: number, data: { assignment_id?: number; create?: Record<string, unknown> }) =>
    api.post(`/correspondence/letters/${id}/assignments`, data),
  linkRelationship: (id: number, data: { to_correspondence_id: number; type: string }) =>
    api.post(`/correspondence/letters/${id}/relationships`, data),
  masterRegister: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<CorrespondenceLetter>>("/correspondence/master-register", { params }),
  myActions: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<CorrespondenceLetter>>("/correspondence/my-actions", { params }),
  reportSummary: () =>
    api.get<{ data: Record<string, number> }>("/correspondence/reports/summary"),
  listSubjectFiles: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<CorrespondenceSubjectFile>>("/correspondence/subject-files", { params }),
  createSubjectFile: (data: { file_code: string; title: string; description?: string }) =>
    api.post<{ data: CorrespondenceSubjectFile }>("/correspondence/subject-files", data),
  linkSubjectFile: (id: number, subject_file_id: number, is_primary?: boolean) =>
    api.post(`/correspondence/letters/${id}/subject-files`, { subject_file_id, is_primary }),
  numberingPolicy: () => api.get<{ data: Record<string, unknown> }>("/correspondence/settings/numbering"),
  mailboxSettings: () =>
    api.get<{ success: boolean; data: CorrespondenceMailboxSettings }>("/correspondence/mailbox/settings"),
  updateMailboxSettings: (data: Partial<CorrespondenceMailboxSettings>) =>
    api.put<{ success: boolean; data: CorrespondenceMailboxSettings }>("/correspondence/mailbox/settings", data),
  mailboxSuggestions: (params?: { status?: string }) =>
    api.get<{ success: boolean; data: CorrespondenceMailboxSuggestion[] }>("/correspondence/mailbox/suggestions", { params }),
  importMailboxSuggestion: (data: Record<string, unknown>) =>
    api.post<{ success: boolean; data: CorrespondenceMailboxSuggestion }>("/correspondence/mailbox/suggestions/import", data),
  registerMailboxSuggestion: (id: number, data?: Record<string, unknown>) =>
    api.post<{ success: boolean; data: CorrespondenceLetter }>(`/correspondence/mailbox/suggestions/${id}/register`, data ?? {}),
  dismissMailboxSuggestion: (id: number) =>
    api.post<{ success: boolean; data: CorrespondenceMailboxSuggestion }>(`/correspondence/mailbox/suggestions/${id}/dismiss`),

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
  module?: string | null;
  can_draft?: boolean;
  can_submit?: boolean;
  can_upload?: boolean;
  can_act_on_behalf?: boolean;
  requires_principal_confirmation?: boolean;
  reason: string | null;
  principal?: { id: number; name: string; email?: string };
  delegate?: { id: number; name: string; email?: string; job_title?: string };
}

// WS1 — workflow visibility snapshot
export interface WorkflowSnapshotUser {
  id: number;
  name: string;
  job_title?: string | null;
  position?: string | null;
}
export interface WorkflowSnapshotStep {
  index: number;
  label: string;
  approver_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'returned' | 'skipped' | 'escalated' | 'delegated' | 'withdrawn' | 'upcoming';
  sla_hours?: number | null;
}
export interface WorkflowSnapshot {
  status: string;
  current_step_index: number;
  current_stage?: { index: number; label: string; approver_type: string; sla_hours?: number | null } | null;
  currently_with: WorkflowSnapshotUser[];
  next_step?: { index: number; label: string; approver_type: string } | null;
  submitted_by?: WorkflowSnapshotUser | null;
  prepared_by?: WorkflowSnapshotUser | null;
  prepared_on_behalf_of?: WorkflowSnapshotUser | null;
  rejection_reason?: string | null;
  return_reason?: string | null;
  returned_count: number;
  steps: WorkflowSnapshotStep[];
  history: Array<{
    id: number;
    action: string;
    status: string;
    step_index: number | null;
    actor?: WorkflowSnapshotUser | null;
    comment?: string | null;
    created_at?: string | null;
  }>;
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
    module?: string;
    can_draft?: boolean;
    can_submit?: boolean;
    can_upload?: boolean;
    can_act_on_behalf?: boolean;
    requires_principal_confirmation?: boolean;
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

  getMyEvents: () =>
    api.get<{ data: SignatureEvent[] }>("/saam/my-events"),

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

// ── Risk Register ──────────────────────────────────────────────────────────

export type RiskStatus = "draft" | "submitted" | "reviewed" | "approved" | "monitoring" | "escalated" | "closed" | "archived";
export type RiskLevel  = "low" | "medium" | "high" | "critical";
export type RiskCategory = "strategic" | "operational" | "financial" | "compliance" | "reputational" | "security" | "other";
export type RiskActionStatus = "planned" | "in_progress" | "completed" | "overdue";
export type TreatmentType = "mitigate" | "accept" | "transfer" | "avoid";
export type ControlEffectiveness = "none" | "partial" | "adequate" | "strong";
export type EscalationLevel = "none" | "departmental" | "directorate" | "sg" | "committee";

export interface Risk {
  id: number;
  risk_code: string;
  title: string;
  description: string;
  category: RiskCategory;
  likelihood: number;
  impact: number;
  inherent_score: number;
  risk_level: RiskLevel;
  residual_likelihood: number | null;
  residual_impact: number | null;
  residual_score: number | null;
  control_effectiveness: ControlEffectiveness;
  status: RiskStatus;
  escalation_level: EscalationLevel;
  review_frequency: "monthly" | "quarterly" | "bi_annual" | "annual" | null;
  next_review_date: string | null;
  review_notes: string | null;
  closure_evidence: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  closed_at: string | null;
  department_id: number | null;
  risk_owner_id: number | null;
  action_owner_id: number | null;
  submitted_by: number;
  reviewed_by: number | null;
  approved_by: number | null;
  closed_by: number | null;
  created_at: string;
  updated_at: string;
  // relations
  submitter?: User;
  riskOwner?: User;
  actionOwner?: User;
  actions?: RiskAction[];
  history?: RiskHistory[];
  attachments?: RiskAttachment[];
}

export interface RiskAction {
  id: number;
  risk_id: number;
  tenant_id: number;
  created_by: number;
  owner_id: number | null;
  description: string;
  action_plan: string | null;
  treatment_type: TreatmentType;
  due_date: string | null;
  status: RiskActionStatus;
  progress: number;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  creator?: User;
  owner?: User;
}

export interface RiskHistory {
  id: number;
  risk_id: number;
  actor_id: number;
  change_type: string;
  from_status: string | null;
  to_status: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  notes: string | null;
  hash: string | null;
  created_at: string;
  actor?: User;
  risk?: { id: number; risk_code: string; title: string };
}

export interface RiskMatrixCell {
  likelihood: number;
  impact: number;
  score: number;
  zone: RiskLevel;
  count: number;
  risk_ids: number[];
}

export interface RiskMatrixData {
  cells: RiskMatrixCell[];
  by_status: Record<RiskStatus, number>;
  by_risk_level: Record<RiskLevel, number>;
  by_category: Record<RiskCategory, number>;
  totals: { total: number; open: number; overdue_actions: number };
}

export interface RiskDashboardKpis {
  open: number;
  critical: number;
  high: number;
  overdue_actions: number;
  escalated: number;
  reviews_due: number;
}

export interface RiskDepartmentExposure {
  department_id: number | null;
  department_name: string;
  total: number;
  critical: number;
  high: number;
  overdue_actions: number;
}

export interface RiskDashboardData {
  kpis: RiskDashboardKpis;
  by_department: RiskDepartmentExposure[];
  recent_activity: Array<{
    id: number;
    risk_id: number;
    risk_code: string;
    change_type: string;
    actor_name: string;
    created_at: string;
  }>;
  escalated_risks: Array<{
    id: number;
    risk_code: string;
    title: string;
    risk_level: string;
    escalation_level: string;
  }>;
}

export const riskApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Risk>>("/risk/risks", { params }),
  get: (id: number) =>
    api.get<{ data: Risk }>(`/risk/risks/${id}`),
  create: (data: Partial<Risk>) =>
    api.post<{ data: Risk; message: string }>("/risk/risks", data),
  update: (id: number, data: Partial<Risk>) =>
    api.put<{ data: Risk; message: string }>(`/risk/risks/${id}`, data),
  delete: (id: number) =>
    api.delete<{ message: string }>(`/risk/risks/${id}`),

  // Workflow
  submit: (id: number) =>
    api.post<{ data: Risk; message: string }>(`/risk/risks/${id}/submit`),
  startReview: (id: number) =>
    api.post<{ data: Risk; message: string }>(`/risk/risks/${id}/start-review`),
  approve: (id: number, data?: { review_notes?: string }) =>
    api.post<{ data: Risk; message: string }>(`/risk/risks/${id}/approve`, data),
  escalate: (id: number, data: { escalation_level: string; notes?: string }) =>
    api.post<{ data: Risk; message: string }>(`/risk/risks/${id}/escalate`, data),
  close: (id: number, data: { closure_evidence: string }) =>
    api.post<{ data: Risk; message: string }>(`/risk/risks/${id}/close`, data),
  archive: (id: number) =>
    api.post<{ data: Risk; message: string }>(`/risk/risks/${id}/archive`),
  reopen: (id: number) =>
    api.post<{ data: Risk; message: string }>(`/risk/risks/${id}/reopen`),
  getLogs: (id: number) =>
    api.get<{ data: RiskHistory[] }>(`/risk/risks/${id}/logs`),

  // Actions
  listActions: (riskId: number) =>
    api.get<{ data: RiskAction[] }>(`/risk/risks/${riskId}/actions`),
  addAction: (riskId: number, data: Partial<RiskAction>) =>
    api.post<{ data: RiskAction; message: string }>(`/risk/risks/${riskId}/actions`, data),
  updateAction: (riskId: number, actionId: number, data: Partial<RiskAction>) =>
    api.put<{ data: RiskAction; message: string }>(`/risk/risks/${riskId}/actions/${actionId}`, data),
  completeAction: (riskId: number, actionId: number) =>
    api.post<{ data: RiskAction; message: string }>(`/risk/risks/${riskId}/actions/${actionId}/complete`),
  deleteAction: (riskId: number, actionId: number) =>
    api.delete<{ message: string }>(`/risk/risks/${riskId}/actions/${actionId}`),

  // Matrix
  getMatrix: (params?: { exclude_closed?: boolean }) =>
    api.get<RiskMatrixData>("/risk/matrix", { params }),

  // Dashboard & Audit Trail
  getDashboard: () =>
    api.get<{ data: RiskDashboardData }>("/risk/dashboard"),
  getAuditTrail: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<RiskHistory>>("/risk/audit-trail", { params }),

  // Phase 1 extensions
  listAssessments: (riskId: number) =>
    api.get(`/risk/risks/${riskId}/assessments`),
  recordAssessment: (riskId: number, data: Record<string, unknown>) =>
    api.post(`/risk/risks/${riskId}/assessments`, data),
  requestAcceptance: (riskId: number, data: { justification: string; expires_at: string }) =>
    api.post(`/risk/risks/${riskId}/acceptances`, data),
  decideAcceptance: (acceptanceId: number, data: { decision: string; decision_notes?: string }) =>
    api.post(`/risk/acceptances/${acceptanceId}/decide`, data),
  materialise: (riskId: number, data?: Record<string, unknown>) =>
    api.post(`/risk/risks/${riskId}/materialise`, data),
  createControl: (data: Record<string, unknown>) =>
    api.post(`/risk/controls`, data),
  linkControl: (riskId: number, data: Record<string, unknown>) =>
    api.post(`/risk/risks/${riskId}/controls`, data),
  listIncidents: (params?: Record<string, string | number>) =>
    api.get(`/risk/incidents`, { params }),
  createIncident: (data: Record<string, unknown>) =>
    api.post(`/risk/incidents`, data),
  listAppetitePolicies: () =>
    api.get(`/risk/appetite-policies`),
};

// ── Risk Document Types ──────────────────────────────────────────────────────

export const RISK_DOCUMENT_TYPES = [
  { value: "risk_policy",          label: "Policy Document",     icon: "policy"      },
  { value: "risk_assessment",      label: "Risk Assessment",     icon: "assessment"  },
  { value: "risk_evidence",        label: "Supporting Evidence", icon: "attach_file" },
  { value: "risk_mitigation_plan", label: "Mitigation Plan",     icon: "task_alt"    },
  { value: "closure_evidence",     label: "Closure Evidence",    icon: "lock"        },
  { value: "other",                label: "Other",               icon: "description" },
] as const;

export type RiskDocumentType = typeof RISK_DOCUMENT_TYPES[number]["value"];

export interface RiskAttachment {
  id: number;
  attachable_type: string;
  attachable_id: number;
  document_type: RiskDocumentType;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  uploader?: { id: number; name: string };
}

export interface Policy {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  owner_name: string | null;
  renewal_date: string | null;
  status: "active" | "archived";
  created_by: number;
  created_at: string;
  updated_at: string;
  risks_count?: number;
  creator?: User;
  attachments?: RiskAttachment[];
  risks?: Pick<Risk, "id" | "risk_code" | "title">[];
}

// ── Risk Attachments API ─────────────────────────────────────────────────────

export const riskAttachmentsApi = {
  list: (riskId: number) =>
    api.get<{ data: RiskAttachment[] }>(`/risk/risks/${riskId}/attachments`),

  upload: (riskId: number, file: File, documentType?: RiskDocumentType) => {
    const form = new FormData();
    form.append("file", file);
    if (documentType) form.append("document_type", documentType);
    return api.post<{ data: RiskAttachment; message: string }>(
      `/risk/risks/${riskId}/attachments`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  delete: (riskId: number, attachmentId: number) =>
    api.delete(`/risk/risks/${riskId}/attachments/${attachmentId}`),

  downloadBlob: (riskId: number, attachmentId: number) =>
    api.get<Blob>(
      `/risk/risks/${riskId}/attachments/${attachmentId}/download`,
      { responseType: "blob" }
    ).then((r) => r.data),

  downloadUrl: (riskId: number, attachmentId: number): string =>
    `${api.defaults.baseURL}/risk/risks/${riskId}/attachments/${attachmentId}/download`,
};

// ── Policy API ───────────────────────────────────────────────────────────────

export const policyApi = {
  list: (params?: { search?: string; status?: string; per_page?: number }) =>
    api.get<PaginatedResponse<Policy>>("/risk/policies", { params }),

  get: (id: number) =>
    api.get<{ data: Policy }>(`/risk/policies/${id}`),

  create: (data: Partial<Policy>) =>
    api.post<{ data: Policy; message: string }>("/risk/policies", data),

  update: (id: number, data: Partial<Policy>) =>
    api.put<{ data: Policy; message: string }>(`/risk/policies/${id}`, data),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/risk/policies/${id}`),

  listForRisk: (riskId: number) =>
    api.get<{ data: Policy[] }>(`/risk/risks/${riskId}/policies`),

  attachToRisk: (policyId: number, riskId: number, notes?: string) =>
    api.post<{ message: string }>(`/risk/policies/${policyId}/attach-risk`, { risk_id: riskId, notes }),

  detachFromRisk: (policyId: number, riskId: number) =>
    api.delete(`/risk/policies/${policyId}/detach-risk/${riskId}`),

  listAttachments: (policyId: number) =>
    api.get<{ data: RiskAttachment[] }>(`/risk/policies/${policyId}/attachments`),

  uploadAttachment: (policyId: number, file: File, documentType?: RiskDocumentType) => {
    const form = new FormData();
    form.append("file", file);
    if (documentType) form.append("document_type", documentType);
    return api.post<{ data: RiskAttachment; message: string }>(
      `/risk/policies/${policyId}/attachments`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  deleteAttachment: (policyId: number, attachmentId: number) =>
    api.delete(`/risk/policies/${policyId}/attachments/${attachmentId}`),

  downloadAttachmentUrl: (policyId: number, attachmentId: number): string =>
    `${api.defaults.baseURL}/risk/policies/${policyId}/attachments/${attachmentId}/download`,
};

// ── Procurement Attachment Types ─────────────────────────────────────────────

export const PROCUREMENT_REQUEST_DOC_TYPES = [
  { value: "rfq_document",    label: "RFQ / Tender Document",  icon: "description"    },
  { value: "quote_received",  label: "Quote Received",         icon: "request_quote"  },
  { value: "bid_document",    label: "Bid Document",           icon: "gavel"          },
  { value: "evaluation_report", label: "Evaluation Report",    icon: "analytics"      },
  { value: "award_letter",    label: "Award Letter",           icon: "workspace_premium" },
  { value: "other",           label: "Other",                  icon: "attach_file"    },
] as const;
export type ProcurementRequestDocType = typeof PROCUREMENT_REQUEST_DOC_TYPES[number]["value"];

export const QUOTE_DOC_TYPES = [
  { value: "quote_received", label: "Submitted Quote", icon: "request_quote" },
  { value: "other", label: "Other", icon: "attach_file" },
] as const;
export type QuoteDocType = typeof QUOTE_DOC_TYPES[number]["value"];

export const PURCHASE_ORDER_DOC_TYPES = [
  { value: "signed_po",               label: "Signed Purchase Order",   icon: "order_approve"  },
  { value: "vendor_acknowledgement",  label: "Vendor Acknowledgement",  icon: "handshake"      },
  { value: "delivery_schedule",       label: "Delivery Schedule",       icon: "schedule"       },
  { value: "po_amendment",            label: "PO Amendment",            icon: "edit_document"  },
  { value: "other",                   label: "Other",                   icon: "attach_file"    },
] as const;
export type PurchaseOrderDocType = typeof PURCHASE_ORDER_DOC_TYPES[number]["value"];

export const INVOICE_DOC_TYPES = [
  { value: "proforma_invoice",  label: "Proforma Invoice",    icon: "receipt_long"   },
  { value: "final_invoice",     label: "Final Invoice",       icon: "request_quote"  },
  { value: "proof_of_payment",  label: "Proof of Payment",    icon: "payments"       },
  { value: "tax_invoice",         label: "Tax Invoice",         icon: "receipt_long"   },
  { value: "credit_note",         label: "Credit Note",         icon: "credit_score"   },
  { value: "remittance_advice",   label: "Remittance Advice",   icon: "payments"       },
  { value: "invoice_supporting",  label: "Supporting Document", icon: "folder_open"    },
  { value: "other",               label: "Other",               icon: "attach_file"    },
] as const;
export type InvoiceDocType = typeof INVOICE_DOC_TYPES[number]["value"];

export const CONTRACT_DOC_TYPES = [
  { value: "signed_contract",      label: "Signed Contract",     icon: "contract"       },
  { value: "contract_amendment",   label: "Contract Amendment",  icon: "edit_document"  },
  { value: "contract_addendum",    label: "Contract Addendum",   icon: "post_add"       },
  { value: "termination_notice",   label: "Termination Notice",  icon: "cancel"         },
  { value: "other",                label: "Other",               icon: "attach_file"    },
] as const;
export type ContractDocType = typeof CONTRACT_DOC_TYPES[number]["value"];

export const GOODS_RECEIPT_DOC_TYPES = [
  { value: "delivery_note",     label: "Delivery Note",      icon: "local_shipping" },
  { value: "inspection_report", label: "Inspection Report",  icon: "fact_check"     },
  { value: "packing_list",      label: "Packing List",       icon: "inventory_2"    },
  { value: "other",             label: "Other",              icon: "attach_file"    },
] as const;
export type GoodsReceiptDocType = typeof GOODS_RECEIPT_DOC_TYPES[number]["value"];

export const VENDOR_DOC_TYPES = [
  { value: "registration_certificate", label: "Registration Certificate", icon: "verified"       },
  { value: "tax_clearance",            label: "Tax Clearance",            icon: "receipt"        },
  { value: "company_profile",          label: "Company Profile",          icon: "business"       },
  { value: "bank_details",             label: "Bank Details",             icon: "account_balance"},
  { value: "other",                    label: "Other",                    icon: "attach_file"    },
] as const;
export type VendorDocType = typeof VENDOR_DOC_TYPES[number]["value"];

export interface ProcurementAttachment {
  id: number;
  attachable_type: string;
  attachable_id: number;
  document_type: string;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  uploader?: { id: number; name: string };
}

// ── Procurement Attachment API helpers ───────────────────────────────────────

function makeAttachmentApi(prefix: string, defaultType: string) {
  return {
    list: (parentId: number) =>
      api.get<{ data: ProcurementAttachment[] }>(`/procurement/${prefix}/${parentId}/attachments`),

    upload: (parentId: number, file: File, documentType?: string) => {
      const form = new FormData();
      form.append("file", file);
      form.append("document_type", documentType ?? defaultType);
      return api.post<{ data: ProcurementAttachment; message: string }>(
        `/procurement/${prefix}/${parentId}/attachments`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
    },

    delete: (parentId: number, attachmentId: number) =>
      api.delete(`/procurement/${prefix}/${parentId}/attachments/${attachmentId}`),

    downloadUrl: (parentId: number, attachmentId: number): string =>
      `${api.defaults.baseURL}/procurement/${prefix}/${parentId}/attachments/${attachmentId}/download`,
  };
}

export const procurementRequestAttachmentsApi = makeAttachmentApi("requests",       "rfq_document");
export const purchaseOrderAttachmentsApi       = makeAttachmentApi("purchase-orders", "signed_po");
export const invoiceAttachmentsApi             = makeAttachmentApi("invoices",       "tax_invoice");
export const contractAttachmentsApi            = makeAttachmentApi("contracts",      "signed_contract");
export const goodsReceiptAttachmentsApi        = makeAttachmentApi("receipts",       "delivery_note");
export const vendorAttachmentsApi              = makeAttachmentApi("vendors",        "company_profile");

export const quoteAttachmentsApi = {
  list: (requestId: number, quoteId: number) =>
    api.get<{ data: ProcurementAttachment[] }>(`/procurement/requests/${requestId}/quotes/${quoteId}/attachments`),

  upload: (requestId: number, quoteId: number, file: File, documentType: QuoteDocType = "quote_received") => {
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", documentType);
    return api.post<{ data: ProcurementAttachment; message: string }>(
      `/procurement/requests/${requestId}/quotes/${quoteId}/attachments`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  delete: (requestId: number, quoteId: number, attachmentId: number) =>
    api.delete(`/procurement/requests/${requestId}/quotes/${quoteId}/attachments/${attachmentId}`),

  downloadUrl: (requestId: number, quoteId: number, attachmentId: number): string =>
    `${api.defaults.baseURL}/procurement/requests/${requestId}/quotes/${quoteId}/attachments/${attachmentId}/download`,
};

// ─── Weekly Summary ───────────────────────────────────────────────────────────

export interface WeeklySummaryRun {
  id: number;
  tenant_id: number;
  period_start: string;
  period_end: string;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  status: "pending" | "running" | "completed" | "partial" | "failed";
  total_users: number;
  total_generated: number;
  total_sent: number;
  total_failed: number;
}

export interface WeeklySummaryReport {
  id: number;
  run_id: number;
  tenant_id: number;
  user_id: number;
  scope_type: "institution" | "department" | "personal";
  period_start: string;
  period_end: string;
  payload: Record<string, unknown> | null;
  payload_hash: string;
  template_version: string;
  status: "generated" | "queued" | "sent" | "failed" | "skipped";
  sent_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface WeeklySummaryPreference {
  user_id: number;
  enabled: boolean;
  detail_mode: "compact" | "standard" | "detailed";
}

export const weeklySummaryApi = {
  getPreferences: () =>
    api.get<{ data: WeeklySummaryPreference }>("/weekly-summary/preferences/me"),
  updatePreferences: (data: { enabled?: boolean; detail_mode?: string }) =>
    api.put<{ data: WeeklySummaryPreference; message: string }>("/weekly-summary/preferences/me", data),
  listReports: (params?: { page?: number }) =>
    api.get("/weekly-summary/reports", { params }),
  getReport: (id: number) =>
    api.get(`/weekly-summary/reports/${id}`),
  // Admin
  listRuns: (params?: { page?: number }) =>
    api.get("/admin/weekly-summary/runs", { params }),
  triggerRun: () =>
    api.post<{ message: string }>("/admin/weekly-summary/run"),
};

/** Operational Weekly Summary Reports (distinct from email digest above). */
export interface WeeklyOpsReport {
  id: number;
  uuid: string;
  reference: string;
  report_type: "individual" | "department" | "institutional";
  status: string;
  period_id: number;
  employee_id?: number | null;
  department_id?: number | null;
  version: number;
  submitted_at?: string | null;
  accepted_at?: string | null;
  published_at?: string | null;
  additional_notes?: string | null;
  items?: Array<Record<string, unknown>>;
  blockers?: Array<Record<string, unknown>>;
  decision_requests?: Array<Record<string, unknown>>;
  priorities?: Array<Record<string, unknown>>;
  risks?: Array<Record<string, unknown>>;
  period?: { id: number; start_date: string; end_date: string; reference: string };
}

export const weeklyReportsApi = {
  dashboard: () => api.get<{ data: Record<string, unknown> }>("/weekly-summaries/dashboard"),
  periods: () => api.get<{ data: Array<Record<string, unknown>> }>("/weekly-summaries/periods"),
  current: (periodId?: number) =>
    api.get<{ data: WeeklyOpsReport }>("/weekly-summaries/current", { params: periodId ? { period_id: periodId } : undefined }),
  suggestions: (periodId?: number) =>
    api.get<{ data: { suggestions: Array<Record<string, unknown>>; note?: string; deferred_hooks?: Array<Record<string, unknown>> } }>(
      "/weekly-summaries/current/suggestions",
      { params: periodId ? { period_id: periodId } : undefined },
    ),
  create: (periodId?: number) =>
    api.post<{ data: WeeklyOpsReport }>("/weekly-summaries/", periodId ? { period_id: periodId } : {}),
  get: (id: number) => api.get<{ data: WeeklyOpsReport }>(`/weekly-summaries/${id}`),
  update: (id: number, data: Record<string, unknown>) =>
    api.put<{ data: WeeklyOpsReport }>(`/weekly-summaries/${id}`, data),
  addItem: (id: number, data: Record<string, unknown>) =>
    api.post<{ data: Record<string, unknown> }>(`/weekly-summaries/${id}/items`, data),
  submit: (id: number) =>
    api.post<{ data: WeeklyOpsReport }>(`/weekly-summaries/${id}/submit`, { declaration_confirmed: true }),
  returnReport: (id: number, data: Record<string, unknown>) =>
    api.post<{ data: WeeklyOpsReport }>(`/weekly-summaries/${id}/return`, data),
  accept: (id: number, data?: Record<string, unknown>) =>
    api.post<{ data: WeeklyOpsReport }>(`/weekly-summaries/${id}/accept`, data ?? {}),
  includeSuggestion: (id: number, data: Record<string, unknown>) =>
    api.post(`/weekly-summaries/${id}/include-suggestion`, data),
  excludeSuggestion: (id: number, data: Record<string, unknown>) =>
    api.post(`/weekly-summaries/${id}/exclude-suggestion`, data),
  department: (periodId: number, departmentId?: number) =>
    api.post<{ data: WeeklyOpsReport }>("/weekly-summaries/department", {
      period_id: periodId,
      department_id: departmentId,
    }),
  institutional: (periodId: number) =>
    api.post<{ data: WeeklyOpsReport }>("/weekly-summaries/institutional", { period_id: periodId }),
  consolidateItem: (id: number, data: Record<string, unknown>) =>
    api.post(`/weekly-summaries/${id}/consolidate-item`, data),
  publish: (id: number) => api.post<{ data: WeeklyOpsReport }>(`/weekly-summaries/${id}/publish`),
  exportUrl: (id: number, format: "pdf" | "csv" | "word") =>
    `/api/v1/weekly-summaries/${id}/export/${format}`,
};

// ── M&E / Results Monitoring (PRD §10 + §23.5) ───────────────────────────────

export type StrategicPlanStatus = "draft" | "active" | "archived";
export type ResultLevel = "impact" | "outcome" | "output" | "activity";
export type IndicatorFrequency = "monthly" | "quarterly" | "bi_annual" | "annual";
export type ResultsFrameworkType = "sadc_pf" | "srhr" | "giz" | "donor" | "institutional";
export type MeReviewStatus =
  | "not_submitted" | "submitted" | "returned" | "reviewed" | "accepted" | "closed"
  | "not_reportable" | "cancelled";
export type EvidenceReviewStatus = "pending" | "validated" | "rejected";

export interface MeSettings {
  auto_intake: boolean;
  report_due_days: number;
  programme_manager_review: boolean;
}

export interface StrategicOutput {
  id: number; strategic_outcome_id: number; code: string | null;
  title: string; description: string | null; sort_order: number;
}
export interface StrategicOutcome {
  id: number; strategic_objective_id: number; code: string | null;
  title: string; description: string | null; sort_order: number;
  outputs?: StrategicOutput[];
}
export interface StrategicObjective {
  id: number; strategic_goal_id: number; code: string | null;
  title: string; description: string | null; sort_order: number;
  outcomes?: StrategicOutcome[];
}
export interface StrategicGoal {
  id: number; strategic_plan_id: number; code: string | null;
  title: string; description: string | null; sort_order: number;
  objectives?: StrategicObjective[];
}
export interface StrategicPlan {
  id: number; tenant_id: number; name: string; period: string | null;
  start_date: string | null; end_date: string | null; status: StrategicPlanStatus;
  description: string | null; created_by: number | null;
  created_at: string; updated_at: string;
  goals_count?: number; goals?: StrategicGoal[]; creator?: User;
}

export interface ResultsFramework {
  id: number; tenant_id: number; name: string; type: ResultsFrameworkType;
  donor_name: string | null; description: string | null;
  strategic_plan_id: number | null; strategic_goal_id: number | null;
  start_date: string | null; end_date: string | null; status: string;
  created_at: string; updated_at: string;
  indicators_count?: number; plan?: { id: number; name: string }; goal?: { id: number; title: string };
}

export interface Indicator {
  id: number; tenant_id: number; results_framework_id: number | null;
  strategic_objective_id: number | null; strategic_output_id: number | null;
  programme_id: number | null; code: string | null; name: string;
  result_level: ResultLevel; unit: string | null;
  baseline_value: string | number | null; baseline_year: string | null;
  annual_target: string | number | null; cumulative_target: string | number | null;
  disaggregation: string[] | null; data_source: string | null;
  evidence_required: boolean; frequency: IndicatorFrequency | null;
  responsible_person_id: number | null; is_active: boolean; description: string | null;
  created_at: string; updated_at: string;
  framework?: { id: number; name: string };
  objective?: { id: number; title: string };
  responsiblePerson?: { id: number; name: string };
  pivot?: { planned_value: number | null; actual_value: number | null; notes: string | null };
}

export interface MeIndicatorVersion {
  id: number;
  indicator_id: number;
  version_number: number;
  label: string | null;
  snapshot: Record<string, unknown>;
  change_notes: string | null;
  created_at: string;
}

export interface MeReportingCalendar {
  month: string;
  items: Array<{
    id: number;
    reference_number: string;
    activity_title: string;
    review_status: string;
    report_due_at: string;
    end_date: string | null;
    programme_id: number | null;
  }>;
  overdue_count: number;
}

export interface MeThematicArea {
  id: number; tenant_id: number; code: string; name: string;
  description: string | null; is_active: boolean; sort_order: number;
}

export interface MeEvidence {
  id: number; tenant_id: number; me_activity_report_id: number | null;
  programme_id: number | null; indicator_id: number | null; title: string | null;
  evidence_type: string; review_status: EvidenceReviewStatus; version: number;
  review_notes: string | null; uploaded_by: number | null;
  reviewed_by: number | null; reviewed_at: string | null; created_at: string;
  uploader?: { id: number; name: string };
  indicator?: { id: number; name: string; code: string | null };
  attachments?: Array<{ id: number; original_filename: string; mime_type: string | null; size_bytes: number | null }>;
}

export interface MeReviewHistoryEntry {
  id: number; me_activity_report_id: number; actor_id: number;
  change_type: string; from_status: string | null; to_status: string | null;
  notes: string | null; hash: string | null; created_at: string;
  actor?: { id: number; name: string };
}

export type MeFollowUpStatus = "open" | "in_progress" | "completed" | "cancelled";
export type MeFollowUpPriority = "low" | "normal" | "high" | "urgent";

export interface MeFollowUpAction {
  id: number;
  tenant_id: number;
  me_activity_report_id: number;
  action: string;
  assigned_to: number | null;
  due_date: string | null;
  priority: MeFollowUpPriority;
  status: MeFollowUpStatus;
  comments: string | null;
  completed_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  assignee?: { id: number; name: string };
  creator?: { id: number; name: string };
}

export interface MeActivityReport {
  id: number; tenant_id: number; programme_id: number | null; reference_number: string;
  activity_title: string; responsible_officer_id: number | null;
  created_by?: number | null;
  non_pif_reason?: string | null;
  thematic_area_id: number | null; strategic_goal_id: number | null;
  start_date: string | null; end_date: string | null;
  planned_output: string | null; actual_output: string | null;
  planned_participants: number | null; actual_participants: number | null;
  narrative: string | null; challenges: string | null; lessons_learned: string | null;
  recommendations: string | null; follow_up_actions: string | null;
  review_status: MeReviewStatus; closure_status: "open" | "closed";
  review_notes: string | null; submitted_at: string | null; reviewed_at: string | null;
  accepted_at: string | null; closed_at: string | null;
  return_section?: string | null; return_required_action?: string | null;
  correction_due_at?: string | null;
  programme_review_status?: "pending" | "cleared" | "returned" | null;
  programme_reviewed_at?: string | null;
  programme_review_notes?: string | null;
  created_at: string; updated_at: string;
  evidence_count?: number;
  programme?: { id: number; title: string; reference_number: string; status: string; strategic_pillar?: string | null };
  responsibleOfficer?: { id: number; name: string };
  thematicArea?: { id: number; name: string };
  strategicGoal?: { id: number; title: string };
  reviewer?: { id: number; name: string };
  indicators?: Indicator[];
  evidence?: MeEvidence[];
  history?: MeReviewHistoryEntry[];
  followUps?: MeFollowUpAction[];
}

export interface PifLinkage {
  id: number; reference_number: string; title: string;
  strategic_pillar: string | null; start_date: string | null; end_date: string | null;
  has_report: boolean;
}

export interface MeDashboardData {
  kpis: {
    approved_pifs: number; awaiting_report: number; total_reports: number;
    submitted: number; reviewed: number; accepted: number; closed: number;
    returned: number; not_submitted: number; pending_review: number;
    evidence_pending: number; reports_missing_evidence: number;
    overdue_reports: number; indicators_updated: number;
  };
  by_strategic_goal: Array<{ strategic_goal_id: number | null; goal_title: string; total: number }>;
  by_thematic_area: Array<{ thematic_area_id: number | null; area_name: string; total: number }>;
  review_queue: Array<{
    id: number; reference_number: string; activity_title: string;
    review_status: string; submitted_at: string | null; pif_number: string | null;
  }>;
}

export interface MeStrategicReport {
  activities_per_goal: Array<{ goal_title: string; activities: number; closed: number }>;
  outputs_per_programme: Array<{ pif_number: string; programme_title: string; activities: number; participants: number }>;
  indicators: { total: number; updated: number; coverage_pct: number };
  evidence_coverage: { submitted_reports: number; reports_with_evidence: number; coverage_pct: number };
  thematic_distribution: Array<{ area_name: string; activities: number }>;
  underreported_areas: Array<{ id: number; pif_number: string; title: string }>;
}

export interface MeDonorReport {
  framework: { id: number; name: string; type?: string; donor_name?: string | null } | null;
  activities: Array<{
    id: number;
    reference_number: string;
    activity_title: string;
    review_status: string;
    start_date: string | null;
    end_date: string | null;
    actual_participants: number | null;
    thematic_area_id?: number | null;
    thematic_area_name?: string | null;
    pif_number: string | null;
    programme_title: string | null;
  }>;
  indicators: Array<{
    id: number;
    code: string | null;
    name: string;
    result_level: string | null;
    unit: string | null;
    annual_target: number | string | null;
    linked_activities: number;
    sum_actual: number | string | null;
  }>;
  summary?: {
    activity_count: number;
    indicator_count: number;
    participants_sum: number;
    by_status: Record<string, number>;
  };
}

export interface MeDataQualityIssue {
  code: string;
  severity: "error" | "warning" | string;
  entity: string;
  entity_id: number;
  reference: string | null;
  title: string | null;
  message: string;
  url?: string | null;
  remediation?: string | null;
}

export interface MeDataQualityReport {
  summary: {
    total: number;
    error: number;
    warning: number;
    by_code: Record<string, number>;
  };
  issues: MeDataQualityIssue[];
  score: number;
  grade: string;
  score_breakdown: Array<{ code: string; count: number; impact: number }>;
}

export interface MeImportPreview {
  rows: Array<{
    line: number;
    data: Record<string, string>;
    ok: boolean;
    errors: Record<string, string>;
  }>;
  valid: number;
  invalid: number;
}

export interface MeImportResult {
  created: number;
  skipped: number;
  errors: Array<{ line: number; errors: Record<string, string> }>;
}

export const ME_EVIDENCE_TYPES = [
  { value: "attendance",  label: "Attendance Register", icon: "groups"        },
  { value: "photo",       label: "Photographs",         icon: "photo_camera"  },
  { value: "report",      label: "Activity Report",     icon: "description"   },
  { value: "publication", label: "Publication",         icon: "menu_book"     },
  { value: "media",       label: "Media Coverage",      icon: "newspaper"     },
  { value: "financial",   label: "Financial Record",    icon: "payments"      },
  { value: "other",       label: "Other",               icon: "attach_file"   },
] as const;

export const RESULTS_FRAMEWORK_TYPES = [
  { value: "sadc_pf",       label: "SADC PF Strategic Plan" },
  { value: "srhr",          label: "SRHR" },
  { value: "giz",           label: "GIZ" },
  { value: "donor",         label: "Donor-specific" },
  { value: "institutional", label: "Institutional" },
] as const;

export const mandeApi = {
  // Dashboard & reporting
  getDashboard: (params?: Record<string, string | number>) =>
    api.get<{ data: MeDashboardData }>("/mande/dashboard", { params }),
  getStrategicReport: (params?: Record<string, string | number>) =>
    api.get<{ data: MeStrategicReport }>("/mande/reports/strategic", { params }),
  getDonorReport: (params?: Record<string, string | number>) =>
    api.get<{ data: MeDonorReport }>("/mande/reports/donor", { params }),
  getDataQuality: () =>
    api.get<{ data: MeDataQualityReport }>("/mande/data-quality"),
  previewImport: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post<{ data: MeImportPreview }>("/mande/import/preview", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  commitImport: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post<{ data: MeImportResult; message: string }>("/mande/import/commit", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getPifLinkages: (params?: { unlinked?: boolean }) =>
    api.get<{ data: PifLinkage[] }>("/mande/pif-linkages", {
      params: params?.unlinked ? { unlinked: 1 } : undefined,
    }),

  // Settings
  getSettings: () =>
    api.get<{ data: MeSettings }>("/mande/settings"),
  updateSettings: (data: Partial<MeSettings>) =>
    api.put<{ data: MeSettings; message: string }>("/mande/settings", data),
  markNotReportable: (programmeId: number, reason: string) =>
    api.post<{ data: MeActivityReport; message: string }>(
      `/mande/intake/${programmeId}/not-reportable`,
      { reason }
    ),

  // Strategic plans
  listPlans: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<StrategicPlan>>("/mande/strategic-plans", { params }),
  getPlan: (id: number) =>
    api.get<{ data: StrategicPlan }>(`/mande/strategic-plans/${id}`),
  createPlan: (data: Partial<StrategicPlan>) =>
    api.post<{ data: StrategicPlan; message: string }>("/mande/strategic-plans", data),
  updatePlan: (id: number, data: Partial<StrategicPlan>) =>
    api.put<{ data: StrategicPlan; message: string }>(`/mande/strategic-plans/${id}`, data),
  deletePlan: (id: number) =>
    api.delete<{ message: string }>(`/mande/strategic-plans/${id}`),
  archivePlan: (id: number) =>
    api.post<{ data: StrategicPlan; message: string }>(`/mande/strategic-plans/${id}/archive`),
  activatePlan: (id: number) =>
    api.post<{ data: StrategicPlan; message: string }>(`/mande/strategic-plans/${id}/activate`),
  addGoal: (planId: number, data: { title: string; code?: string; description?: string }) =>
    api.post<{ data: StrategicGoal; message: string }>(`/mande/strategic-plans/${planId}/goals`, data),
  addObjective: (goalId: number, data: { title: string; code?: string; description?: string }) =>
    api.post<{ data: StrategicObjective; message: string }>(`/mande/strategic-goals/${goalId}/objectives`, data),
  addOutcome: (objectiveId: number, data: { title: string; code?: string; description?: string }) =>
    api.post<{ data: StrategicOutcome; message: string }>(`/mande/strategic-objectives/${objectiveId}/outcomes`, data),
  addOutput: (outcomeId: number, data: { title: string; code?: string; description?: string }) =>
    api.post<{ data: StrategicOutput; message: string }>(`/mande/strategic-outcomes/${outcomeId}/outputs`, data),
  deleteNode: (type: "goal" | "objective" | "outcome" | "output", id: number) =>
    api.delete<{ message: string }>(`/mande/strategic-nodes/${type}/${id}`),

  // Results frameworks
  listFrameworks: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<ResultsFramework>>("/mande/results-frameworks", { params }),
  getFramework: (id: number) =>
    api.get<{ data: ResultsFramework }>(`/mande/results-frameworks/${id}`),
  createFramework: (data: Partial<ResultsFramework>) =>
    api.post<{ data: ResultsFramework; message: string }>("/mande/results-frameworks", data),
  updateFramework: (id: number, data: Partial<ResultsFramework>) =>
    api.put<{ data: ResultsFramework; message: string }>(`/mande/results-frameworks/${id}`, data),
  deleteFramework: (id: number) =>
    api.delete<{ message: string }>(`/mande/results-frameworks/${id}`),

  // Indicators
  listIndicators: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Indicator>>("/mande/indicators", { params }),
  getIndicator: (id: number) =>
    api.get<{ data: Indicator }>(`/mande/indicators/${id}`),
  createIndicator: (data: Partial<Indicator>) =>
    api.post<{ data: Indicator; message: string }>("/mande/indicators", data),
  updateIndicator: (id: number, data: Partial<Indicator>) =>
    api.put<{ data: Indicator; message: string }>(`/mande/indicators/${id}`, data),
  deleteIndicator: (id: number) =>
    api.delete<{ message: string }>(`/mande/indicators/${id}`),
  listIndicatorVersions: (id: number) =>
    api.get<{ data: MeIndicatorVersion[] }>(`/mande/indicators/${id}/versions`),
  createIndicatorVersion: (id: number, data?: { label?: string; change_notes?: string }) =>
    api.post<{ data: MeIndicatorVersion; message: string }>(`/mande/indicators/${id}/versions`, data ?? {}),
  getCalendar: (params?: { month?: string }) =>
    api.get<{ data: MeReportingCalendar }>("/mande/calendar", { params }),

  // Activity reports
  listReports: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<MeActivityReport>>("/mande/activity-reports", { params }),
  getReport: (id: number) =>
    api.get<{ data: MeActivityReport }>(`/mande/activity-reports/${id}`),
  createReport: (data: Partial<{
    programme_id: number | null;
    activity_title: string;
    non_pif_reason: string;
    start_date: string | null;
    end_date: string | null;
    responsible_officer_id: number | null;
  }> & Record<string, unknown>) =>
    api.post<{ data: MeActivityReport; message: string }>("/mande/activity-reports", data),
  updateReport: (id: number, data: Record<string, unknown>) =>
    api.put<{ data: MeActivityReport; message: string }>(`/mande/activity-reports/${id}`, data),
  deleteReport: (id: number) =>
    api.delete<{ message: string }>(`/mande/activity-reports/${id}`),
  getReportHistory: (id: number) =>
    api.get<{ data: MeReviewHistoryEntry[] }>(`/mande/activity-reports/${id}/history`),

  // Follow-up actions
  listFollowUps: (reportId: number) =>
    api.get<{ data: MeFollowUpAction[] }>(`/mande/activity-reports/${reportId}/follow-ups`),
  createFollowUp: (reportId: number, data: Partial<MeFollowUpAction> & { action: string }) =>
    api.post<{ data: MeFollowUpAction; message: string }>(
      `/mande/activity-reports/${reportId}/follow-ups`,
      data
    ),
  updateFollowUp: (reportId: number, followUpId: number, data: Partial<MeFollowUpAction>) =>
    api.put<{ data: MeFollowUpAction; message: string }>(
      `/mande/activity-reports/${reportId}/follow-ups/${followUpId}`,
      data
    ),
  deleteFollowUp: (reportId: number, followUpId: number) =>
    api.delete<{ message: string }>(`/mande/activity-reports/${reportId}/follow-ups/${followUpId}`),

  // Review workflow
  submitReport: (id: number) =>
    api.post<{ data: MeActivityReport; message: string }>(`/mande/activity-reports/${id}/submit`),
  reviewReport: (id: number, data?: { review_notes?: string }) =>
    api.post<{ data: MeActivityReport; message: string }>(`/mande/activity-reports/${id}/review`, data),
  returnReport: (id: number, data: {
    review_notes: string;
    section?: string;
    required_action?: string;
    correction_due_at?: string;
  }) =>
    api.post<{ data: MeActivityReport; message: string }>(`/mande/activity-reports/${id}/return`, data),
  acceptReport: (id: number, data?: { review_notes?: string }) =>
    api.post<{ data: MeActivityReport; message: string }>(`/mande/activity-reports/${id}/accept`, data),
  closeReport: (id: number, data?: { notes?: string }) =>
    api.post<{ data: MeActivityReport; message: string }>(`/mande/activity-reports/${id}/close`, data),
  listProgrammeReviewQueue: () =>
    api.get<{ data: MeActivityReport[] }>("/mande/programme-review-queue"),
  clearProgrammeReview: (id: number, data?: { notes?: string }) =>
    api.post<{ data: MeActivityReport; message: string }>(
      `/mande/activity-reports/${id}/programme-review/clear`,
      data
    ),
  returnProgrammeReview: (id: number, data: { notes: string }) =>
    api.post<{ data: MeActivityReport; message: string }>(
      `/mande/activity-reports/${id}/programme-review/return`,
      data
    ),

  // Evidence
  listEvidence: (reportId: number) =>
    api.get<{ data: MeEvidence[] }>(`/mande/activity-reports/${reportId}/evidence`),
  uploadEvidence: (reportId: number, file: File, meta?: { evidence_type?: string; indicator_id?: number; title?: string }) => {
    const form = new FormData();
    form.append("file", file);
    if (meta?.evidence_type) form.append("evidence_type", meta.evidence_type);
    if (meta?.indicator_id) form.append("indicator_id", String(meta.indicator_id));
    if (meta?.title) form.append("title", meta.title);
    return api.post<{ data: MeEvidence; message: string }>(
      `/mande/activity-reports/${reportId}/evidence`, form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },
  reviewEvidence: (reportId: number, evidenceId: number, data: { review_status: "validated" | "rejected"; review_notes?: string }) =>
    api.post<{ data: MeEvidence; message: string }>(`/mande/activity-reports/${reportId}/evidence/${evidenceId}/review`, data),
  deleteEvidence: (reportId: number, evidenceId: number) =>
    api.delete<{ message: string }>(`/mande/activity-reports/${reportId}/evidence/${evidenceId}`),
  evidenceDownloadUrl: (reportId: number, evidenceId: number, attachmentId: number): string =>
    `${api.defaults.baseURL}/mande/activity-reports/${reportId}/evidence/${evidenceId}/attachments/${attachmentId}/download`,

  // Thematic areas (settings)
  listThematicAreas: () =>
    api.get<{ data: MeThematicArea[] }>("/mande/thematic-areas"),
  createThematicArea: (data: Partial<MeThematicArea>) =>
    api.post<{ data: MeThematicArea; message: string }>("/mande/thematic-areas", data),
  updateThematicArea: (id: number, data: Partial<MeThematicArea>) =>
    api.put<{ data: MeThematicArea; message: string }>(`/mande/thematic-areas/${id}`, data),
  deleteThematicArea: (id: number) =>
    api.delete<{ message: string }>(`/mande/thematic-areas/${id}`),
};

// ─── Meeting Resolutions / Decision Register ─────────────────────────────────

export type MeetingDecisionStatus =
  | "draft"
  | "adopted"
  | "in_progress"
  | "implemented"
  | "closed"
  | "superseded";

export type MeetingDecisionType = "resolution" | "management_decision";

export interface MeetingDecision {
  id: number;
  tenant_id: number;
  reference_number: string;
  decision_type: MeetingDecisionType;
  title: string;
  body?: string | null;
  status: MeetingDecisionStatus;
  owner_id?: number | null;
  due_date?: string | null;
  meeting_minutes_id?: number | null;
  workplan_event_id?: number | null;
  is_confidential: boolean;
  created_by: number;
  adopted_by?: number | null;
  adopted_at?: string | null;
  adoption_notes?: string | null;
  implemented_at?: string | null;
  closed_by?: number | null;
  closed_at?: string | null;
  closure_notes?: string | null;
  superseded_by_id?: number | null;
  created_at?: string;
  updated_at?: string;
  owner?: { id: number; name: string } | null;
  creator?: { id: number; name: string } | null;
  adopter?: { id: number; name: string } | null;
  minutes?: { id: number; title: string; meeting_date?: string; status?: string } | null;
  actions?: MeetingDecisionAction[];
}

export interface MeetingDecisionAction {
  id: number;
  meeting_decision_id: number;
  description: string;
  notes?: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "completed" | "cancelled";
  owner_id?: number | null;
  due_date?: string | null;
  assignment_id?: number | null;
  owner?: { id: number; name: string } | null;
  assignment?: { id: number; reference_number: string; status: string } | null;
}

export interface MeetingDecisionDashboard {
  by_status: Record<string, number>;
  total: number;
  overdue: number;
  open_critical_actions: number;
}

export const decisionsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<MeetingDecision>>("/decisions", { params }),
  get: (id: number) =>
    api.get<{ data: MeetingDecision }>(`/decisions/${id}`),
  create: (data: Partial<MeetingDecision>) =>
    api.post<{ message: string; data: MeetingDecision }>("/decisions", data),
  update: (id: number, data: Partial<MeetingDecision>) =>
    api.put<{ message: string; data: MeetingDecision }>(`/decisions/${id}`, data),
  remove: (id: number) =>
    api.delete<{ message: string }>(`/decisions/${id}`),
  adopt: (id: number, data?: { adoption_notes?: string; owner_id?: number; due_date?: string }) =>
    api.post<{ message: string; data: MeetingDecision }>(`/decisions/${id}/adopt`, data ?? {}),
  startProgress: (id: number) =>
    api.post<{ message: string; data: MeetingDecision }>(`/decisions/${id}/start-progress`),
  markImplemented: (id: number, data?: { notes?: string }) =>
    api.post<{ message: string; data: MeetingDecision }>(`/decisions/${id}/mark-implemented`, data ?? {}),
  close: (id: number, data?: { closure_notes?: string }) =>
    api.post<{ message: string; data: MeetingDecision }>(`/decisions/${id}/close`, data ?? {}),
  createAssignment: (id: number, data?: Record<string, unknown>) =>
    api.post<{ message: string; data: unknown }>(`/decisions/${id}/create-assignment`, data ?? {}),
  listActions: (id: number) =>
    api.get<{ data: MeetingDecisionAction[] }>(`/decisions/${id}/actions`),
  addAction: (id: number, data: Partial<MeetingDecisionAction> & { create_assignment?: boolean }) =>
    api.post<{ message: string; data: MeetingDecisionAction }>(`/decisions/${id}/actions`, data),
  history: (id: number) =>
    api.get<{ data: Array<{ id: number; change_type: string; from_status?: string; to_status?: string; notes?: string; created_at: string; actor?: { id: number; name: string } }> }>(`/decisions/${id}/history`),
  dashboard: () =>
    api.get<{ data: MeetingDecisionDashboard }>("/decisions/dashboard"),
};

