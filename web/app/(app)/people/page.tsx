"use client";

import { useQuery } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { PEOPLE_HUB_CARDS } from "@/lib/hubs/people";

export default function PeopleAuthorityHubPage() {
  const { data: me } = useQuery({
    queryKey: ["people-authority", "me"],
    queryFn: async () => (await peopleAuthorityApi.me()).data.data,
  });

  const meName =
    me && typeof me === "object"
      ? String(
          (me as Record<string, unknown>).display_name ??
            (me as Record<string, unknown>).name ??
            [(me as Record<string, unknown>).first_name, (me as Record<string, unknown>).last_name]
              .filter(Boolean)
              .join(" ") ??
            "",
        )
      : "";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="People & Authority"
        subtitle="Institutional identity, organisation chart, authority and signing."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "People & Authority" }]} />}
      />

      {meName ? (
        <p className="text-sm text-neutral-600">
          Signed in as <span className="font-medium text-neutral-800">{meName}</span>
        </p>
      ) : null}

      <ModuleHubCards cards={PEOPLE_HUB_CARDS} />
    </div>
  );
}
