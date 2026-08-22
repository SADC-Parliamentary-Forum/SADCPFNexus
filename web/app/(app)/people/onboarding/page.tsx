"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy People stub — redirects to the unified Employee Lifecycle create flow. */
export default function PeopleOnboardingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/lifecycle/onboarding/create");
  }, [router]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center text-sm text-neutral-600">
      Redirecting to Employee Lifecycle onboarding…
    </div>
  );
}
