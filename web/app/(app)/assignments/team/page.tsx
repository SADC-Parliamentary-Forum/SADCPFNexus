"use client";

import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function TeamAssignmentsPage() {
  return (
    <AssignmentFilteredList
      title="Team Assignments"
      subtitle="Department and team workload (authorised roles)."
      queryKey="team"
      fetcher={(params) => assignmentsApi.team(params)}
    />
  );
}
