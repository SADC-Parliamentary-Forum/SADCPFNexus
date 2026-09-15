import { MFA_SETUP_PATH, requiresPrivilegedMfaSetup } from "./privilegedMfa.ts";
import { safeInternalPath } from "./safeInternalPath.ts";
import type { AuthUser } from "./api.ts";

export function isSupplierUser(user: { roles?: string[] } | null | undefined): boolean {
  return (user?.roles ?? []).some((role) => ["Supplier", "Supplier Finance User"].includes(role));
}

/** Staff HR profile vs supplier company profile. */
export function accountProfilePath(user: { roles?: string[] } | null | undefined): string {
  return isSupplierUser(user) ? "/supplier/profile" : "/profile";
}

/**
 * Where to send a user after a successful browser sign-in.
 * Suppliers never enter the staff onboarding wizard.
 */
export function postAuthDestination(user: AuthUser, from: string | null = null): string {
  if (user.must_reset_password) {
    return "/reset-password";
  }

  if (requiresPrivilegedMfaSetup(user)) {
    return MFA_SETUP_PATH;
  }

  const supplier = isSupplierUser(user);
  if (!user.setup_completed && !supplier) {
    return "/setup";
  }

  const safeFrom = safeInternalPath(from);
  if (supplier) {
    if (safeFrom && (safeFrom === "/supplier" || safeFrom.startsWith("/supplier/"))) {
      return safeFrom;
    }
    return "/supplier";
  }

  return safeFrom ?? "/dashboard";
}
