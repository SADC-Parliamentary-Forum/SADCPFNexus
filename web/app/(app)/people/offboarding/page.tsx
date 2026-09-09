"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy People stub — redirects to the unified Employee Lifecycle separation flow. */
export default function PeopleOffboardingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/lifecycle/separation/create");
  }, [router]);

  return (
    <div className="w-full min-w-0 py-16 text-center text-sm text-neutral-600">
      Redirecting to Employee Lifecycle separation…
    </div>
  );
}
