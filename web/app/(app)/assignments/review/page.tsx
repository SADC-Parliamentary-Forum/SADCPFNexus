"use client";

import { AssignmentFilteredList, assignmentsApi } from "@/components/assignments/AssignmentFilteredList";

export default function ReviewQueuePage() {
  return (
    <AssignmentFilteredList
      title="Awaiting My Review"
      subtitle="Completed work waiting for verification — completion is not acceptance."
      queryKey="review"
      fetcher={(params) => assignmentsApi.reviewQueue(params)}
    />
  );
}
