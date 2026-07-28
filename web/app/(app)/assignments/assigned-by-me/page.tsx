"use client";

import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";
import { getStoredUser } from "@/lib/auth";

export default function AssignedByMePage() {
  const user = getStoredUser();
  return (
    <AssignmentFilteredList
      title="Assigned by Me"
      subtitle="Assignments you created for others."
      queryKey={`assigned-by-me-${user?.id ?? 0}`}
      fetcher={(p) => assignmentsApi.list(p)}
      fixedParams={user?.id ? { created_by: String(user.id) } : {}}
    />
  );
}
