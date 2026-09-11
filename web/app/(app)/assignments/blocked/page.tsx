"use client";

import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function BlockedAssignmentsPage() {
  return (
    <AssignmentFilteredList
      title="Blocked Assignments"
      subtitle="Assignments with an active blocker preventing progress."
      queryKey="blocked"
      fetcher={(params) => assignmentsApi.list(params)}
      fixedParams={{ status: "blocked" }}
      emptyTitle="No blocked assignments."
      emptyIcon="block"
    />
  );
}
