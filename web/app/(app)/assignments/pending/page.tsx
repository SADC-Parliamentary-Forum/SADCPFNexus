"use client";

import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function PendingAcceptancePage() {
  return (
    <AssignmentFilteredList
      title="Pending Acceptance"
      subtitle="Assignments awaiting a response from the assignee."
      queryKey="awaiting_acceptance"
      fetcher={(params) => assignmentsApi.list(params)}
      fixedParams={{ status: "awaiting_acceptance" }}
      emptyTitle="No assignments pending acceptance."
      emptyIcon="pending_actions"
    />
  );
}
