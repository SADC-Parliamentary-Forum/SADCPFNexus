/**
 * Mirrors api/app/Http/Middleware/RequireMfaForPrivileged.php privileged roles.
 * Used to force MFA setup UX before the API 403 lands on every call.
 */
export const PRIVILEGED_MFA_ROLES = [
  "System Admin",
  "System Administrator",
  "super-admin",
  "Secretary General",
  "Finance Controller",
  "HR Manager",
  "HR Administrator",
  "Procurement Officer",
] as const;

export function requiresPrivilegedMfaSetup(user: {
  roles?: string[] | null;
  mfa_enabled?: boolean | null;
}): boolean {
  if (user.mfa_enabled) return false;
  const roles = user.roles ?? [];
  return roles.some((role) =>
    (PRIVILEGED_MFA_ROLES as readonly string[]).includes(role)
  );
}

export const MFA_SETUP_PATH = "/profile/security";
