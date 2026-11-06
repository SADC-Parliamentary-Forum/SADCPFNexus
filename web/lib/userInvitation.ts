/** Invitation state of a staff account, for the admin user screens. */

export interface InvitationFields {
  is_active: boolean;
  account_status?: string;
  latest_account_invitation?: {
    status: string;
    expires_at: string;
    sent_at?: string | null;
  } | null;
}

export type InvitationKind = "active" | "not_invited" | "sent" | "expired" | "other";

export interface InvitationState {
  kind: InvitationKind;
  label: string;
  badge: string;
  /** Button text when the admin can (re)send the invitation, otherwise null. */
  action: string | null;
  expiresAt: string | null;
}

export function invitationState(user: InvitationFields, now: Date = new Date()): InvitationState {
  if (user.account_status === "invited") {
    const inv = user.latest_account_invitation ?? null;
    const pending = inv?.status === "pending";
    const expired = inv?.status === "expired" || (pending && new Date(inv.expires_at).getTime() <= now.getTime());
    if (inv && expired && inv.sent_at) {
      return { kind: "expired", label: "Invitation expired", badge: "badge-danger", action: "Resend invitation", expiresAt: inv.expires_at };
    }
    if (inv && pending && inv.sent_at) {
      return { kind: "sent", label: "Invitation sent", badge: "badge-warning", action: "Resend invitation", expiresAt: inv.expires_at };
    }
    return { kind: "not_invited", label: "Not invited yet", badge: "badge-muted", action: "Send invitation", expiresAt: null };
  }
  if (user.is_active) {
    return { kind: "active", label: "Active", badge: "badge-success", action: null, expiresAt: null };
  }
  const status = user.account_status ? user.account_status.charAt(0).toUpperCase() + user.account_status.slice(1) : "Inactive";
  return { kind: "other", label: status === "Active" ? "Inactive" : status, badge: "badge-muted", action: null, expiresAt: null };
}
