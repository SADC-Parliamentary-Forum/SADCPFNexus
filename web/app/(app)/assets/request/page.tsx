import { redirect } from "next/navigation";

/** Hub “Request Asset” used to be a full page; the form now lives on the requests list. */
export default function AssetRequestRedirect() {
  redirect("/assets/requests?new=1");
}
