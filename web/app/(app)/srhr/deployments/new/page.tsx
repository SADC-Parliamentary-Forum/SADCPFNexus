"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { deploymentsApi, parliamentsApi, adminApi, type Parliament } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function NewDeploymentPageInner() {
  const { t } = useI18n();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const toast        = useToast();

  const [parliaments, setParliaments] = useState<Parliament[]>([]);
  const [users, setUsers]             = useState<{ id: number; name: string; email: string }[]>([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const [form, setForm] = useState({
    employee_id:        "" as string | number,
    parliament_id:      searchParams.get("parliament_id") ?? "" as string | number,
    deployment_type:    "field_researcher",
    research_area:      "",
    research_focus:     "",
    start_date:         "",
    end_date:           "",
    supervisor_name:    "",
    supervisor_title:   "",
    supervisor_email:   "",
    supervisor_phone:   "",
    terms_of_reference: "",
    notes:              "",
  });

  useEffect(() => {
    parliamentsApi.list({ is_active: true, per_page: 50 }).then((res) => {
      setParliaments(res.data.data ?? []);
    });
    adminApi.listUsers({ per_page: 200 })
      .then((res) => setUsers(res.data.data ?? []))
      .catch(() => setUsers([]));
  }, []);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await deploymentsApi.create({
        employee_id:        Number(form.employee_id),
        parliament_id:      Number(form.parliament_id),
        deployment_type:    form.deployment_type,
        research_area:      form.research_area || undefined,
        research_focus:     form.research_focus || undefined,
        start_date:         form.start_date,
        end_date:           form.end_date || undefined,
        supervisor_name:    form.supervisor_name || undefined,
        supervisor_title:   form.supervisor_title || undefined,
        supervisor_email:   form.supervisor_email || undefined,
        supervisor_phone:   form.supervisor_phone || undefined,
        terms_of_reference: form.terms_of_reference || undefined,
        notes:              form.notes || undefined,
      });
      toast.success(t("srhr.newDeploymentPage.created"));
      router.push("/srhr/deployments");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msgs = e.response?.data?.errors
        ? Object.values(e.response.data.errors).flat().join("; ")
        : (e.response?.data?.message ?? t("srhr.newDeploymentPage.createFailed"));
      setError(msgs);
      toast.error(t("srhr.newDeploymentPage.notCreated"), msgs);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/srhr" className="hover:text-primary">{t("srhr.crumb")}</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/srhr/deployments" className="hover:text-primary">{t("srhr.deployment.crumb")}</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-800 font-medium">{t("srhr.newDeployment")}</span>
      </div>

      <ModulePageHeader
        title="srhr.newDeploymentPage.title"
        subtitle="srhr.newDeploymentPage.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "srhr.newDeploymentPage.title" }]} />}
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="srhr-deployments-new-researcher" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.col.researcher")} <span className="text-red-500">*</span></label>
            <select id="srhr-deployments-new-researcher" className="form-input" value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)} required>
              <option value="">{t("srhr.newDeploymentPage.selectResearcher")}</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="srhr-deployments-new-parliament" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.col.parliament")} <span className="text-red-500">*</span></label>
            <select id="srhr-deployments-new-parliament" className="form-input" value={form.parliament_id} onChange={(e) => set("parliament_id", e.target.value)} required>
              <option value="">{t("srhr.newDeploymentPage.selectParliament")}</option>
              {parliaments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="srhr-deployments-new-deployment-type" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.newDeploymentPage.type")}</label>
            <select id="srhr-deployments-new-deployment-type" className="form-input" value={form.deployment_type} onChange={(e) => set("deployment_type", e.target.value)}>
              <option value="field_researcher">{t("srhr.deploymentType.field_researcher")}</option>
              <option value="secondment">{t("srhr.deploymentType.secondment")}</option>
              <option value="other">{t("srhr.deploymentType.other")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="srhr-deployments-new-research-area" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.deployment.researchArea")}</label>
            <select id="srhr-deployments-new-research-area" className="form-input" value={form.research_area} onChange={(e) => set("research_area", e.target.value)}>
              <option value="">{t("srhr.newDeploymentPage.selectArea")}</option>
              <option value="SRHR">{t("srhr.crumb")}</option>
              <option value="Gender & Equality">{t("srhr.area.gender")}</option>
              <option value="Governance">{t("srhr.area.governance")}</option>
              <option value="Elections & Democracy">{t("srhr.area.elections")}</option>
              <option value="Budget & Finance">{t("srhr.area.budget")}</option>
              <option value="Environment">{t("srhr.area.environment")}</option>
              <option value="Youth">{t("srhr.area.youth")}</option>
              <option value="Other">{t("srhr.deploymentType.other")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="srhr-deployments-new-start-date" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("common.startDate")} <span className="text-red-500">*</span></label>
            <input id="srhr-deployments-new-start-date" type="date" className="form-input" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} required />
          </div>
          <div>
            <label htmlFor="srhr-deployments-new-end-date-optional" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("common.endDate")} <span className="text-neutral-400">{t("profile.optional")}</span></label>
            <input id="srhr-deployments-new-end-date-optional" type="date" className="form-input" min={form.start_date || undefined} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </div>
        </div>

        <hr className="border-neutral-100" />
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t("srhr.deployment.supervisorAtParliament")}</p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="srhr-deployments-new-supervisor-name" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.newDeploymentPage.supervisorName")}</label>
            <input id="srhr-deployments-new-supervisor-name" className="form-input" placeholder={t("srhr.newDeploymentPage.supervisorNamePlaceholder")} value={form.supervisor_name} onChange={(e) => set("supervisor_name", e.target.value)} />
          </div>
          <div>
            <label htmlFor="srhr-deployments-new-supervisor-title" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.newDeploymentPage.supervisorTitle")}</label>
            <input id="srhr-deployments-new-supervisor-title" className="form-input" placeholder={t("srhr.newDeploymentPage.supervisorTitlePlaceholder")} value={form.supervisor_title} onChange={(e) => set("supervisor_title", e.target.value)} />
          </div>
          <div>
            <label htmlFor="srhr-deployments-new-supervisor-email" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.newDeploymentPage.supervisorEmail")}</label>
            <input id="srhr-deployments-new-supervisor-email" type="email" className="form-input" value={form.supervisor_email} onChange={(e) => set("supervisor_email", e.target.value)} />
          </div>
          <div>
            <label htmlFor="srhr-deployments-new-supervisor-phone" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.newDeploymentPage.supervisorPhone")}</label>
            <input id="srhr-deployments-new-supervisor-phone" className="form-input" placeholder="+263…" value={form.supervisor_phone} onChange={(e) => set("supervisor_phone", e.target.value)} />
          </div>
        </div>

        <div>
          <label htmlFor="srhr-deployments-new-research-focus-optional" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.deployment.researchFocus")} <span className="text-neutral-400">{t("profile.optional")}</span></label>
          <textarea id="srhr-deployments-new-research-focus-optional" className="form-input" rows={2} placeholder={t("srhr.newDeploymentPage.focusPlaceholder")} value={form.research_focus} onChange={(e) => set("research_focus", e.target.value)} />
        </div>

        <div>
          <label htmlFor="srhr-deployments-new-terms-of-reference" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.deployment.tor")}</label>
          <textarea id="srhr-deployments-new-terms-of-reference" className="form-input" rows={4} placeholder={t("srhr.newDeploymentPage.torPlaceholder")} value={form.terms_of_reference} onChange={(e) => set("terms_of_reference", e.target.value)} />
        </div>

        <div>
          <label htmlFor="srhr-deployments-new-notes" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("hr.timesheets.col.notes")}</label>
          <textarea id="srhr-deployments-new-notes" className="form-input" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/srhr/deployments" className="btn-secondary">{t("common.cancel")}</Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? t("srhr.newDeploymentPage.creating") : t("srhr.newDeploymentPage.create")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewDeploymentPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="w-full min-w-0 p-6 text-sm text-neutral-500">{t("common.loading")}</div>}>
      <NewDeploymentPageInner />
    </Suspense>
  );
}
