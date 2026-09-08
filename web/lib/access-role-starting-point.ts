type RoleVersionLike = {
  permissions?: unknown;
  version?: number;
  status?: string;
};

export type CatalogueRoleLike = {
  name?: string;
  purpose?: string | null;
  risk_level?: string;
  read_only?: boolean;
  no_business_approve?: boolean;
  current_version?: RoleVersionLike | null;
  latest_version?: RoleVersionLike | null;
  currentVersion?: RoleVersionLike | null;
  latestVersion?: RoleVersionLike | null;
};

function asStringList(value: unknown): string[] {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  }
  if (raw && typeof raw === "object") {
    return Object.values(raw as Record<string, unknown>)
      .filter((item): item is string => typeof item === "string" && item.trim() !== "");
  }
  return [];
}

export function extractRolePermissions(role: CatalogueRoleLike): string[] {
  const candidates = [
    role.latest_version?.permissions,
    role.latestVersion?.permissions,
    role.current_version?.permissions,
    role.currentVersion?.permissions,
  ];
  for (const candidate of candidates) {
    const permissions = asStringList(candidate);
    if (permissions.length > 0) {
      return permissions;
    }
  }
  return [];
}

export function suggestedCopyName(currentName: string, sourceRoleName: string): string {
  if (currentName.trim()) {
    return currentName;
  }
  const source = sourceRoleName.trim() || "Role";
  return `${source} copy`;
}

export function scrollRoleBuilderIntoView(): void {
  if (typeof document === "undefined") {
    return;
  }
  const target = document.getElementById("role-draft") ?? document.getElementById("role-builder");
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const main = document.getElementById("main-content");
  if (main) {
    main.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
