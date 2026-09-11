"use client";

import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function OverdueAssignmentsPage() {
  return (
    <AssignmentFilteredList
      title="Overdue Assignments"
      subtitle="Assignments that have passed their due date and are still open."
      queryKey="overdue"
      fetcher={(params) => assignmentsApi.list(params)}
      fixedParams={{ overdue: "true" }}
      emptyTitle="No overdue assignments."
      emptyIcon="event_busy"
    />
  );
}
