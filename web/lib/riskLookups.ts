import { getListData } from "./listPagination.ts";

export type RiskOwnerOption = {
  id: number;
  name: string;
  email?: string | null;
  job_title?: string | null;
};

export type RiskCreateFields = {
  title: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  strategic_objective_id: string;
  risk_owner_id: string;
};

/** Normalise owner lookup payloads (array, `{ data }`, or paginator). */
export function asOwnerOptions(payload: unknown): RiskOwnerOption[] {
  const rows = getListData<Record<string, unknown>>(payload);
  return rows
    .map((row) => {
      const id = Number(row.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      const name = String(row.name ?? row.display_name ?? row.email ?? `User #${id}`).trim();
      return {
        id,
        name: name || `User #${id}`,
        email: typeof row.email === "string" ? row.email : null,
        job_title: typeof row.job_title === "string" ? row.job_title : null,
      } satisfies RiskOwnerOption;
    })
    .filter((row): row is RiskOwnerOption => row !== null);
}

/** Matches POST /risk/mitigations `risk_ids` max:50. */
export const MAX_BULK_MITIGATIONS = 50;

export function assertMitigationRiskIds(ids: number[]): string | null {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (unique.length === 0) return "risk.mitigation.noneSelected";
  if (unique.length > MAX_BULK_MITIGATIONS) return "risk.mitigation.tooMany";
  return null;
}

/** Always keep the signed-in user selectable when the directory lookup is empty or incomplete. */
export function mergeCurrentUserIntoOwners(
  owners: RiskOwnerOption[],
  current: { id?: number; name?: string; email?: string } | null | undefined,
): RiskOwnerOption[] {
  const id = Number(current?.id);
  if (!Number.isFinite(id) || id <= 0) return owners;
  if (owners.some((owner) => owner.id === id)) return owners;
  return [
    {
      id,
      name: (current?.name || current?.email || `User #${id}`).trim(),
      email: current?.email ?? null,
    },
    ...owners,
  ];
}

export function buildMitigationFormData(args: {
  riskIds: number[];
  description: string;
  treatmentType?: string;
  dueDate?: string;
  file?: File | null;
  documentType?: string;
}): FormData {
  const form = new FormData();
  for (const id of args.riskIds) {
    form.append("risk_ids[]", String(id));
  }
  form.append("description", args.description.trim());
  if (args.treatmentType) form.append("treatment_type", args.treatmentType);
  if (args.dueDate) form.append("due_date", args.dueDate);
  if (args.documentType) form.append("document_type", args.documentType);
  if (args.file) form.append("file", args.file);
  return form;
}

export function validateRiskCreateForm(
  form: RiskCreateFields,
  options?: { requireOwner?: boolean; requireObjective?: boolean },
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (!form.title.trim()) errors.title = ["risk.create.titleRequired"];
  if (!form.description.trim()) errors.description = ["risk.create.descriptionRequired"];
  if (!form.category) errors.category = ["risk.create.categoryRequired"];
  if (form.likelihood < 1 || form.likelihood > 5) errors.likelihood = ["risk.create.scoreRequired"];
  if (form.impact < 1 || form.impact > 5) errors.impact = ["risk.create.scoreRequired"];
  if (options?.requireOwner && !form.risk_owner_id) errors.risk_owner_id = ["risk.create.ownerRequired"];
  if (options?.requireObjective && !form.strategic_objective_id) {
    errors.strategic_objective_id = ["risk.create.objectiveRequired"];
  }
  return errors;
}
