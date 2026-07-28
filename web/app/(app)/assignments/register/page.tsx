"use client";

import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function RegisterPage() {
  return (
    <AssignmentFilteredList
      title="Assignment Register"
      subtitle="Institutional register of actionable work across sources."
      queryKey="register"
      fetcher={(params) => assignmentsApi.register(params)}
    />
  );
}
