"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { FormSection } from "@/components/ui/FormSection";
import { AuditPageShell, AuditTable } from "@/components/audit/AuditChrome";

export default function AuditAppointmentsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "appointments"],
    queryFn: async () => (await auditApi.listAppointments({ per_page: 50 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];
  const [firm, setFirm] = useState("");
  const [plenary, setPlenary] = useState("");

  const create = useMutation({
    mutationFn: () =>
      auditApi.createAppointment({
        firm_name: firm,
        plenary_resolution_ref: plenary || undefined,
        independence_docs_on_file: true,
        notes: "Procurement owns tender; Audit stores appointment result.",
      }),
    onSuccess: () => {
      setFirm("");
      setPlenary("");
      qc.invalidateQueries({ queryKey: ["audit", "appointments"] });
    },
  });

  return (
    <AuditPageShell
      title="audit.appointments.title"
      subtitle="audit.appointments.subtitle"
      loading={isLoading}
      actions={<div className="flex flex-wrap gap-2" />}
    >
      <div className="space-y-5">
        <FormSection title="audit.appointments.record" icon="handshake">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="audit-appointment-firm" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.appointments.firm")}</label>
              <input id="audit-appointment-firm" className="form-input w-full" value={firm} onChange={(e) => setFirm(e.target.value)} />
            </div>
            <div>
              <label htmlFor="audit-appointment-plenary" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("audit.appointments.plenary")}</label>
              <input id="audit-appointment-plenary" className="form-input w-full" value={plenary} onChange={(e) => setPlenary(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-sm disabled:opacity-50"
              disabled={!firm || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? t("audit.appointments.recording") : t("audit.appointments.record")}
            </button>
          </div>
        </FormSection>

        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("audit.appointments.empty")}</p>
        ) : (
          <AuditTable columns={["audit.col.firm", "audit.col.plenary", "audit.col.status", "audit.col.independence"]}>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b border-neutral-100">
                <td className="px-3 py-2.5">{String(r.firm_name)}</td>
                <td className="px-3 py-2.5">{String(r.plenary_resolution_ref ?? "—")}</td>
                <td className="px-3 py-2.5 capitalize">{String(r.status)}</td>
                <td className="px-3 py-2.5">{r.independence_docs_on_file ? t("audit.yes") : t("audit.no")}</td>
              </tr>
            ))}
          </AuditTable>
        )}
      </div>
    </AuditPageShell>
  );
}
