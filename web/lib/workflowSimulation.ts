export type SimulationPathStep = {
  step_order?: number;
  step_name?: string | null;
  stage_type?: string | null;
  skip_reason?: string | null;
};

export type SimulationProjection = {
  module_type?: string;
  scenario_label_key?: string | null;
  stages?: unknown[];
  applicable_path?: SimulationPathStep[];
  skipped_path?: SimulationPathStep[];
  requester?: { id?: number; name?: string; email?: string };
  normalized_context?: Record<string, unknown>;
  created_production_approval?: boolean;
  note?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function decodeCandidate(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function isProjection(value: unknown): value is SimulationProjection {
  const rec = asRecord(decodeCandidate(value));
  if (!rec) return false;
  return Array.isArray(rec.stages) || Array.isArray(rec.applicable_path);
}

/**
 * Unwrap the simulate API envelope. Laravel returns `{ data: model, created_production_approval }`
 * where `model.result` is the projection. Some proxies nest `data` twice.
 */
export function parseSimulationResponse(payload: unknown): SimulationProjection | null {
  const root = asRecord(payload);
  if (!root) return null;

  const data = asRecord(root.data) ?? root;
  const nestedData = asRecord(data.data);
  const candidates = [data.result, nestedData?.result, root.result, nestedData, data];
  for (const candidate of candidates) {
    const decoded = decodeCandidate(candidate);
    if (isProjection(decoded)) return decoded;
  }
  return null;
}

export function formatApplicablePath(result: SimulationProjection | null): string {
  const steps = result?.applicable_path ?? [];
  const names = steps
    .map((step) => step.step_name || step.stage_type || "")
    .map((name) => String(name).trim())
    .filter(Boolean);
  return names.join(" → ");
}
