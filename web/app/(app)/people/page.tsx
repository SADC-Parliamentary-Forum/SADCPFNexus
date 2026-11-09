"use client";

import { useQuery } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { PEOPLE_HUB_CARDS } from "@/lib/hubs/people";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function PeopleAuthorityHubPage() {
  const { t } = useI18n();
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
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("people.hub.title")}
        subtitle={t("people.hub.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("people.hub.title") }]} />}
      />

      {meName ? (
        <p className="text-sm text-neutral-600">
          {t("people.hub.signedInAs")}{" "}
          <span className="font-medium text-neutral-800">{meName}</span>
        </p>
      ) : null}

      <ModuleHubCards cards={PEOPLE_HUB_CARDS} />
    </div>
  );
}
