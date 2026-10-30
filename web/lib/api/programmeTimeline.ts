// Programme (PIF) end-to-end timeline — GET /programmes/{id}/timeline.
import api from "./client";

export interface ProgrammeTimelineEvent {
  type: "programme" | "procurement_request" | "purchase_order" | "contract" | "travel_request" | "me_report";
  id: number;
  kind: string;
  at: string | null;
  reference: string | null;
  title: string | null;
  status: string | null;
  path: string;
  amount: number | null;
  currency: string | null;
}

export interface ProgrammeTimeline {
  programme: { id: number; reference: string | null; title: string; status: string; start_date: string | null; end_date: string | null };
  events: ProgrammeTimelineEvent[];
  financials: {
    approved_budget: { amount: number | null; currency: string | null };
    /** currency -> definition key -> amount; never combined across currencies. */
    linked_values_by_currency: Record<string, Record<string, number>>;
    definitions: Record<string, string>;
  };
}

export const programmeTimelineApi = {
  get: (programmeId: number) => api.get<{ data: ProgrammeTimeline }>(`/programmes/${programmeId}/timeline`),
};
