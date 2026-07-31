import { redirect } from "next/navigation";

/** UX-027 / UX-172: canonical profile is /profile */
export default function PeopleMyProfileRedirectPage() {
  redirect("/profile");
}
