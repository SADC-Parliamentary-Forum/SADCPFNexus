"use client";

import Link from "next/link";
import { useMemo } from "react";
import { canAccessRoute, getStoredUser } from "@/lib/auth";
import { FormSection } from "@/components/ui/FormSection";

export type HubSectionId = "queues" | "views" | "tools";

export type HubCard = {
  href: string;
  title: string;
  purpose: string;
  icon: string;
  section: HubSectionId;
};

export type HubSection = {
  id: HubSectionId;
  title: string;
  description: string;
  icon?: string;
};

export const DEFAULT_HUB_SECTIONS: HubSection[] = [
  { id: "queues", title: "Work queues", description: "Items waiting for you or your unit.", icon: "fact_check" },
  { id: "views", title: "Registers & views", description: "Lists, dashboards, and history.", icon: "menu_book" },
  { id: "tools", title: "Tools & policy", description: "Reports, catalogues, and settings.", icon: "tune" },
];

/** Labelled destination cards for destinations moved off a crowded sidebar. */
export function ModuleHubCards({
  cards,
  sections = DEFAULT_HUB_SECTIONS,
}: {
  cards: HubCard[];
  sections?: HubSection[];
}) {
  const user = getStoredUser();
  const visible = useMemo(
    () => cards.filter((card) => canAccessRoute(user, card.href)),
    [cards, user],
  );

  if (visible.length === 0) return null;

  return (
    <div data-testid="module-hub-cards" className="space-y-4">
      {sections.map((section) => {
        const items = visible.filter((card) => card.section === section.id);
        if (items.length === 0) return null;
        return (
          <FormSection
            key={section.id}
            title={section.title}
            description={section.description}
            icon={section.icon}
            dense
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((card) => (
                <Link
                  key={`${card.href}:${card.title}`}
                  href={card.href}
                  className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <span className="material-symbols-outlined mt-0.5 text-primary">{card.icon}</span>
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900">{card.title}</span>
                    <span className="mt-0.5 block text-xs text-neutral-500">{card.purpose}</span>
                  </span>
                </Link>
              ))}
            </div>
          </FormSection>
        );
      })}
    </div>
  );
}
