"use client";

import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function EscalationsPage() {
  return (
    <AssignmentFilteredList
      title="Escalations"
      subtitle="Overdue or unclaimed work that has been escalated."
      queryKey="escalations"
      fetcher={(params) => assignmentsApi.list(params)}
      fixedParams={{ escalated: "true" }}
    />
  );
}
