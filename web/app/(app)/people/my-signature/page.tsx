import { redirect } from "next/navigation";

/** UX-028 / UX-174: canonical signature enrolment is SAAM */
export default function PeopleMySignatureRedirectPage() {
  redirect("/saam");
}
