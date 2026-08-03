"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import Link from "next/link";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Role = {
  id: number;
  name: string;
  purpose?: string;
  risk_level?: string;
  status?: string;
  feature_only?: boolean;
  current_version?: { version: number; permissions: string[] } | null;
};

export default function AccessRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api
      .get<{ data: Role[] }>("/admin/access/roles")
      .then((r) => r.data)
      .then((res) => setRoles(res.data ?? []))
      .catch((e) => setMessage(e?.message ?? "Failed to load roles"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const createDraft = async () => {
    setMessage(null);
    await api.post("/admin/access/roles", { name, purpose, permissions: [], changelog: "UI draft" });
    setName("");
    setPurpose("");
    setMessage("Draft role created");
    load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Role catalogue"
        subtitle="Versioned role templates (draft → publish)."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Access", href: "/admin/access" },
              { label: "Roles" },
            ]}
          />
        }
        actions={
          <Link href="/admin/access/roles/matrix" className="btn-secondary text-sm">
            Permission matrix
          </Link>
        }
      />

      <FormSection title="Create draft role" description="Starts a new versioned role template." icon="badge" dense>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Name" htmlFor="role-name" required className="min-w-[160px]">
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Role name"
            />
          </FormField>
          <FormField label="Purpose" htmlFor="role-purpose" className="min-w-[240px] flex-1">
            <Input
              id="role-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Purpose"
            />
          </FormField>
          <Button type="button" onClick={createDraft} disabled={!name} size="sm">
            Create draft
          </Button>
        </div>
        {message ? <p className="mt-3 text-sm text-neutral-600">{message}</p> : null}
      </FormSection>

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="card">
          <EmptyState icon="badge" title="No roles yet" description="Create a draft role to begin the catalogue." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Access roles catalogue</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Risk</th>
                  <th scope="col">Status</th>
                  <th scope="col">Version</th>
                  <th scope="col">Perms</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-neutral-800">
                      {r.name}
                      {r.feature_only ? (
                        <Badge variant="muted" className="ml-1.5 text-[10px]">limited</Badge>
                      ) : null}
                    </td>
                    <td className="capitalize">{r.risk_level ?? "—"}</td>
                    <td>
                      <Badge variant="muted" className="capitalize">{r.status ?? "—"}</Badge>
                    </td>
                    <td>{r.current_version?.version ?? "—"}</td>
                    <td>{r.current_version?.permissions?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
