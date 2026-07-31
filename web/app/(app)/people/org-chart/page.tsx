import { redirect } from "next/navigation";

/** UX-024 / UX-148: canonical org chart is /organogram */
export default function PeopleOrgChartRedirectPage() {
  redirect("/organogram");
}
