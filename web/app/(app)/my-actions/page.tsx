"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ActionQueuePanel } from "@/components/workqueue/ActionQueuePanel";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function MyActionsPage() {
  const { t } = useI18n();
  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("nav.my_actions")}
        subtitle={t("myActions.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("nav.my_actions") }]} />}
      />
      <ActionQueuePanel />
    </div>
  );
}
