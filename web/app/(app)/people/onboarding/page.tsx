import { redirect } from "next/navigation";

/** Legacy People stub — redirects to the unified Employee Lifecycle create flow. */
export default function PeopleOnboardingRedirectPage() {
  redirect("/lifecycle/onboarding/create");
}
