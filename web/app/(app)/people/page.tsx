"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";

const LINKS = [
  { href: "/people/my-profile", label: "My Profile" },
  { href: "/people/my-delegations", label: "My Delegations" },
  { href: "/people/my-signature", label: "My Signature" },
  { href: "/people/directory", label: "Staff Directory" },
  { href: "/people/org-chart", label: "Organisation Chart" },
  { href: "/people/units", label: "Organisational Units" },
  { href: "/people/positions", label: "Positions" },
  { href: "/people/assignments", label: "Position Assignments" },
  { href: "/people/reporting", label: "Reporting Relationships" },
  { href: "/people/job-descriptions", label: "Job Descriptions" },
  { href: "/people/authority", label: "Authority Register" },
  { href: "/people/acting", label: "Acting Appointments" },
  { href: "/people/delegations", label: "Delegations" },
  { href: "/people/signatures", label: "Signature Register" },
  { href: "/people/onboarding", label: "Onboarding" },
  { href: "/people/offboarding", label: "Offboarding" },
  { href: "/people/access-reviews", label: "Access Reviews" },
  { href: "/people/reports", label: "Reports" },
  { href: "/people/settings", label: "Settings / Phase 2-3 stubs" },
];

export default function PeopleAuthorityHubPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["people-authority", "me"],
    queryFn: async () => (await peopleAuthorityApi.me()).data.data,
  });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const createPerson = useMutation({
    mutationFn: async () =>
      peopleAuthorityApi.createPerson({ first_name: firstName, last_name: lastName }),
    onSuccess: () => {
      setFirstName("");
      setLastName("");
      qc.invalidateQueries({ queryKey: ["people-authority"] });
    },
  });

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">People &amp; Authority</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Institutional identity, positions, reporting lines, authority register, acting, delegation and secure signing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="border border-neutral-200 rounded-lg px-4 py-3 bg-white hover:border-neutral-400 text-sm"
          >
            {l.label}
          </Link>
        ))}
      </div>

      <section className="border border-neutral-200 rounded-lg p-4 bg-white space-y-3 max-w-xl">
        <h2 className="font-medium">Quick create person</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <button
            type="button"
            className="px-3 py-2 text-sm rounded bg-neutral-900 text-white disabled:opacity-50"
            disabled={!firstName || !lastName || createPerson.isPending}
            onClick={() => createPerson.mutate()}
          >
            Create
          </button>
        </div>
        {createPerson.isError && <p className="text-sm text-red-600">Create failed (need people.manage).</p>}
        {createPerson.isSuccess && <p className="text-sm text-green-700">Person created.</p>}
      </section>

      {me && (
        <section className="text-sm text-neutral-700">
          <h2 className="font-medium mb-2">My linked identity</h2>
          <pre className="text-xs bg-neutral-50 border rounded p-3 overflow-auto">{JSON.stringify(me, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}
