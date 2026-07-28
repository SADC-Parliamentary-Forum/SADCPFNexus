"use client";

import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function MyAssignmentsPage() {
  return (
    <AssignmentFilteredList
      title="My Assignments"
      subtitle="Work where you are primary assignee, creator, or participant."
      queryKey="mine"
      fetcher={(params) => assignmentsApi.mine(params)}
    />
  );
}
