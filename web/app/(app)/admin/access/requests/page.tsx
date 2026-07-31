"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";

type AccessRequest = {
  id: number;
  permission_key?: string;
  business_reason: string;
  status: string;
  scope_type?: string;
};

export default function AccessRequestsPage() {
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [permission, setPermission] = useState("procurement.evaluation.read.assigned");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = () =>
    api
      .get<{ data: AccessRequest[] }>("/admin/access/requests")
      .then((r) => r.data)
      .then((r) => setRows(r.data ?? []))
      .catch(() => setMessage("Failed to load access requests."))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setMessage(null);
    await api.post("/access/requests", {
      permission_key: permission,
      business_reason: reason,
      scope_type: "assigned",
    });
    setReason("");
    setMessage("Access request submitted.");
    load();
  };

  const decide = async (id: number, decision: "approve" | "reject", stage: "supervisor" | "approver") => {
    await api.post(`/admin/access/requests/${id}/decide`, { decision, stage });
    load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Access requests"
        subtitle="Request elevated permissions and route supervisor / approver decisions."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Access", href: "/admin/access" },
              { label: "Requests" },
            ]}
          />
        }
      />

      <FormSection title="New request" icon="how_to_reg" dense>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Permission" htmlFor="req-perm" required className="min-w-[260px]">
            <input
              id="req-perm"
              className="form-input"
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
            />
          </FormField>
          <FormField label="Business reason" htmlFor="req-reason" required className="min-w-[240px] flex-1">
            <input
              id="req-reason"
              className="form-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <button type="button" className="btn-primary text-sm" onClick={submit} disabled={!reason}>
            Request access
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-neutral-600">{message}</p> : null}
      </FormSection>

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="how_to_reg" title="No access requests" description="Submitted requests will appear in this register." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Permission</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.id}</td>
                    <td className="font-medium text-neutral-800">{r.permission_key}</td>
                    <td>
                      <span className="badge badge-muted text-xs capitalize">{r.status}</span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => decide(r.id, "approve", "supervisor")}>
                          Supervisor OK
                        </button>
                        <button type="button" className="text-xs font-medium text-emerald-700 hover:underline" onClick={() => decide(r.id, "approve", "approver")}>
                          Approve
                        </button>
                        <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => decide(r.id, "reject", "approver")}>
                          Reject
                        </button>
                      </div>
                    </td>
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
