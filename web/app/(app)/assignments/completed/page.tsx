"use client";

import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function CompletedAssignmentsPage() {
  return (
    <AssignmentFilteredList
      title="Completed Assignments"
      subtitle="Submitted and closed work (deadline state remains separate)."
      queryKey="completed"
      fetcher={(params) => assignmentsApi.list(params)}
      fixedParams={{ status: "completed,closed" }}
    />
  );
}
