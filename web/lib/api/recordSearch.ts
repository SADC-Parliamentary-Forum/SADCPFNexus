// Permission-filtered record search — GET /search/records?q= (server-scoped per module).
import api from "./client";

export interface RecordSearchHit {
  module: "travel" | "leave" | "procurement" | "programmes" | "suppliers" | "correspondence";
  id: number;
  reference: string | null;
  title: string | null;
  status: string | null;
  path: string;
}

export const recordSearchApi = {
  search: (q: string) => api.get<{ data: RecordSearchHit[] }>("/search/records", { params: { q } }),
};
