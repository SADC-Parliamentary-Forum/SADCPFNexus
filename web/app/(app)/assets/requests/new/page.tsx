import { redirect } from "next/navigation";

/** Bookmarks to the old full-page form open the list popup instead. */
export default function NewAssetRequestRedirect() {
  redirect("/assets/requests?new=1");
}
