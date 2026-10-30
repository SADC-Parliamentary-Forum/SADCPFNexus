"use client";

import { FormEvent, useEffect, useState } from "react";
import { adminApi, type Department, type TenantUserOption, type User } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { Modal } from "@/components/ui/Modal";

/**
 * Create (invite) a staff member from the asset assignee picker when they are not in the
 * list yet. Uses the standard user invitation, so it is limited to whoever may create users.
 */
export function AssetQuickUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (user: TenantUserOption) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || departments.length > 0) return;
    adminApi
      .listDepartments()
      .then((res) => setDepartments(res.data.data ?? []))
      .catch(() => setDepartments([]));
  }, [open, departments.length]);

  function reset() {
    setName("");
    setEmail("");
    setJobTitle("");
    setDepartmentId("");
    setSendInvite(true);
    setError("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload: Partial<User> & { role?: string; send_welcome_email?: boolean } = {
        name: name.trim(),
        email: email.trim(),
        job_title: jobTitle.trim() || null,
        department_id: departmentId ? Number(departmentId) : null,
        role: "Staff",
        send_welcome_email: sendInvite,
      };
      const res = await adminApi.createUser(payload);
      const created = res.data.user;
      onCreated({
        id: created.id,
        name: created.name,
        email: created.email,
        job_title: created.job_title ?? null,
        department_id: created.department_id ?? null,
        department: created.department?.name ?? departments.find((d) => d.id === created.department_id)?.name ?? null,
        account_status: "invited",
      });
      reset();
    } catch (err) {
      setError(apiErrorMessage(err, t("assets.newUser.failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t("assets.newUser.title")}
      description={t("assets.newUser.description")}
    >
      <form onSubmit={submit} className="space-y-3" data-testid="asset-new-user-form">
        <div className="space-y-1">
          <label htmlFor="asset-new-user-name" className="block text-sm font-medium">{t("assets.newUser.name")}</label>
          <input
            id="asset-new-user-name"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            required
            autoComplete="off"
            data-testid="asset-new-user-name"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="asset-new-user-email" className="block text-sm font-medium">{t("assets.newUser.email")}</label>
          <input
            id="asset-new-user-email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
            data-testid="asset-new-user-email"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="asset-new-user-job" className="block text-sm font-medium">{t("assets.newUser.jobTitle")}</label>
          <input
            id="asset-new-user-job"
            className="form-input"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            maxLength={255}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="asset-new-user-department" className="block text-sm font-medium">{t("assets.newUser.department")}</label>
          <select
            id="asset-new-user-department"
            className="form-input"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">{t("assets.newUser.noDepartment")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <label htmlFor="asset-new-user-invite" className="flex items-center gap-2 text-sm">
          <input
            id="asset-new-user-invite"
            type="checkbox"
            checked={sendInvite}
            onChange={(e) => setSendInvite(e.target.checked)}
          />
          {t("assets.newUser.sendInvite")}
        </label>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !name.trim() || !email.trim()}
            data-testid="asset-new-user-submit"
          >
            {busy ? t("common.loading") : t("assets.newUser.create")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
