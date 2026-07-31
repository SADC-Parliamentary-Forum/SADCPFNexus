"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";

const LINKS = [
  { href: "/profile", label: "My Profile", icon: "person", desc: "Personal details and documents" },
  { href: "/saam", label: "My Signature", icon: "draw", desc: "Enrol and manage your signature" },
  { href: "/people/directory", label: "Staff Directory", icon: "contacts", desc: "Search institutional staff" },
  { href: "/organogram", label: "Organisation Chart", icon: "account_tree", desc: "Interactive department canvas" },
  { href: "/people/authority", label: "Authority Register", icon: "gavel", desc: "Delegated authorities" },
  { href: "/people/delegations", label: "Delegations", icon: "handshake", desc: "Acting and delegation records" },
  { href: "/people/acting", label: "Acting Appointments", icon: "supervisor_account", desc: "Temporary acting roles" },
  { href: "/verify-signature", label: "Verify Signature", icon: "verified_user", desc: "Public signature verification" },
];

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

      <FormSection title="Shortcuts" description="Operational people surfaces only - stub tooling is hidden from production navigation." icon="badge" dense>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="material-symbols-outlined mt-0.5 text-primary">{l.icon}</span>
              <span>
                <span className="block text-sm font-semibold text-neutral-900">{l.label}</span>
                <span className="mt-0.5 block text-xs text-neutral-500">{l.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </FormSection>
    </div>
  );
}
