import { redirect } from "next/navigation";

/** Legacy People stub — redirects to the unified Employee Lifecycle separation flow. */
export default function PeopleOffboardingRedirectPage() {
  redirect("/lifecycle/separation/create");
}
