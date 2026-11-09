"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { PEOPLE_SETTINGS_HUB_CARDS } from "@/lib/hubs/people";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function Page() {
  const { t } = useI18n();
  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("people.settings.title")}
        subtitle={t("people.settings.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("people.hub.title"), href: "/people" },
              { label: t("people.settings.title") },
            ]}
          />
        }
      />
      <ModuleHubCards cards={PEOPLE_SETTINGS_HUB_CARDS} />
    </div>
  );
}
