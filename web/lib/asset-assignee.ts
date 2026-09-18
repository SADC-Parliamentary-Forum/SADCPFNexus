import type { Asset, TenantUserOption } from "@/lib/api";

export type AssigneeDepartment = string | { name?: string | null } | null | undefined;

export type AssigneeFields = {
  name?: string | null;
  email?: string | null;
  department?: AssigneeDepartment;
};

export function assigneeDepartmentName(user?: AssigneeFields | null): string | null {
  if (!user) {
    return null;
  }
  const value = user.department;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (value && typeof value === "object" && typeof value.name === "string") {
    const trimmed = value.name.trim();
    return trimmed === "" ? null : trimmed;
  }
  return null;
}

export function tenantUserFromAsset(asset: Pick<Asset, "assigned_user" | "department">): TenantUserOption | null {
  if (!asset.assigned_user) {
    return null;
  }
  return {
    id: asset.assigned_user.id,
    name: asset.assigned_user.name,
    email: asset.assigned_user.email,
    department: assigneeDepartmentName(asset.assigned_user) ?? asset.department ?? null,
  };
}

export function formatAssigneeLabel(user: AssigneeFields): string {
  return [user.name, user.email, assigneeDepartmentName(user)].filter(Boolean).join(" · ");
}
