"use client";

import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function UnassignedPage() {
  return (
    <AssignmentFilteredList
      title="Unassigned Work Queue"
      subtitle="Department queues awaiting a named Primary Assignee."
      queryKey="unassigned"
      fetcher={(params) => assignmentsApi.list(params)}
      fixedParams={{ unassigned: "true" }}
    />
  );
}
