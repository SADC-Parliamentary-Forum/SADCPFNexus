// "Needs my action" queue — GET /me/action-queue (always the caller's own items).
import api from "./client";

export type ActionQueueKind = "approval" | "correction" | "assignment" | "lifecycle" | "correspondence";

export interface ActionQueueItem {
  id: string;
  kind: ActionQueueKind;
  title: string;
  reference: string | null;
  /** Workflow module type; used with lib/recordLinks when `path` is null. */
  module: string | null;
  record_id: number | null;
  /** Direct link for non-workflow items (assignments, lifecycle, correspondence). */
  path: string | null;
  due_at: string | null;
  overdue: boolean;
  action: string;
  next_step_owner: string;
  blocker: string | null;
}

export interface ActionQueueResponse {
  data: ActionQueueItem[];
  counts: Record<string, number> & { total: number; overdue: number };
  /** Per-source status: ok | not_permitted | unavailable. */
  sources: Record<string, string>;
}

export const actionQueueApi = {
  list: () => api.get<ActionQueueResponse>("/me/action-queue"),
};
