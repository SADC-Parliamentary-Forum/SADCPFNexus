"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { RegisterShell } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormSection";
import { DEFAULT_PAGE_SIZE, getListData, getLastPage, getTotal } from "@/lib/listPagination";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type DirectoryPerson = {
  id?: number;
  first_name?: string;
  last_name?: string;
  display_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  work_email?: string | null;
  employee_number?: string | null;
  person_number?: string | null;
  work_phone?: string | null;
  department?: string | { name?: string } | null;
  position?: string | { title?: string; name?: string } | null;
  status?: string | null;
  employment_status?: string | null;
};

const emptyForm = {
  first_name: "",
  last_name: "",
  preferred_name: "",
  work_email: "",
  person_number: "",
  work_phone: "",
};

function displayName(p: DirectoryPerson, fallback: string): string {
  const preferred = p.preferred_name?.trim();
  if (preferred) return preferred;
  if (p.display_name?.trim()) return p.display_name.trim();
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || fallback;
}

function deptLabel(p: DirectoryPerson): string {
  if (!p.department) return "-";
  if (typeof p.department === "string") return p.department;
  return p.department.name ?? "-";
}

function positionLabel(p: DirectoryPerson): string {
  if (!p.position) return "-";
  if (typeof p.position === "string") return p.position;
  return p.position.title ?? p.position.name ?? "-";
}

function emailOf(p: DirectoryPerson): string {
  return p.work_email ?? p.email ?? "-";
}

function numberOf(p: DirectoryPerson): string {
  return p.person_number ?? p.employee_number ?? "-";
}

export default function StaffDirectoryPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people-authority", "staff-directory", debouncedQ, page],
    queryFn: async () => {
      return (
        await peopleAuthorityApi.listPeople({
          directory: true,
          page,
          per_page: DEFAULT_PAGE_SIZE,
          ...(debouncedQ ? { q: debouncedQ } : {}),
        })
      ).data;
    },
    placeholderData: (previous) => previous,
  });

  const rows = useMemo(() => getListData<DirectoryPerson>(data), [data]);
  const pageCount = useMemo(() => getLastPage(data), [data]);
  const total = useMemo(() => getTotal(data, rows.length), [data, rows.length]);

  const payload = () => ({
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    preferred_name: form.preferred_name.trim() || null,
    work_email: form.work_email.trim() || null,
    person_number: form.person_number.trim() || null,
    work_phone: form.work_phone.trim() || null,
  });

  const create = useMutation({
    mutationFn: () => peopleAuthorityApi.createPerson(payload()),
    onSuccess: () => {
      toast.success(t("people.directory.added"));
      setForm(emptyForm);
      setEditingId(null);
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "staff-directory"] });
    },
    onError: (e) => {
      const message = apiErrorMessage(e, t("people.directory.createFailed"));
      setErr(message);
      toast.error(t("people.directory.notAdded"), message);
    },
  });

  const update = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error(t("people.directory.noneSelected"));
      return peopleAuthorityApi.updatePerson(editingId, payload());
    },
    onSuccess: () => {
      toast.success(t("people.directory.updated"));
      setForm(emptyForm);
      setEditingId(null);
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "staff-directory"] });
    },
    onError: (e) => {
      const message = apiErrorMessage(e, t("people.directory.updateFailed"));
      setErr(message);
      toast.error(t("people.directory.notUpdated"), message);
    },
  });

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const sync = useMutation({
    mutationFn: () => peopleAuthorityApi.syncPeopleFromUsers(),
    onSuccess: (res) => {
      const { people_created, links_created } = res.data.data;
      const summary = t("people.directory.syncSummary", { created: people_created, linked: links_created });
      setSyncMessage(summary);
      toast.success(t("people.directory.populated"), summary);
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "staff-directory"] });
    },
    onError: (e) => {
      const message = apiErrorMessage(e, t("people.directory.populateFailed"));
      setErr(message);
      toast.error(t("people.directory.notPopulated"), message);
    },
  });

  const removeSuppliers = useMutation({
    mutationFn: () => peopleAuthorityApi.removeSupplierLinks(),
    onSuccess: (res) => {
      const { removed } = res.data.data;
      const summary =
        removed > 0
          ? t("people.directory.suppliersRemovedSummary", { count: removed })
          : t("people.directory.noSuppliersFound");
      setSyncMessage(summary);
      toast.success(t("people.directory.suppliersRemoved"), summary);
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "staff-directory"] });
    },
    onError: (e) => {
      const message = apiErrorMessage(e, t("people.directory.removeSuppliersFailed"));
      setErr(message);
      toast.error(t("people.directory.suppliersNotRemoved"), message);
    },
  });

  async function handleRemoveSuppliers() {
    const ok = await confirm({
      title: t("people.directory.removeSuppliersConfirmTitle"),
      message: t("people.directory.removeSuppliersConfirmMessage"),
      confirmText: t("people.directory.removeSuppliers"),
      variant: "danger",
    });
    if (ok) removeSuppliers.mutate();
  }

  function startEdit(p: DirectoryPerson) {
    if (!p.id) return;
    setEditingId(p.id);
    setForm({
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      preferred_name: p.preferred_name ?? "",
      work_email: p.work_email ?? p.email ?? "",
      person_number: p.person_number ?? p.employee_number ?? "",
      work_phone: p.work_phone ?? "",
    });
    setErr(null);
  }

  return (
    <RegisterShell
      title={t("people.authority.staffDirectory")}
      subtitle={t("people.directory.subtitle")}
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: t("people.hub.title"), href: "/people" },
            { label: t("people.authority.staffDirectory") },
          ]}
        />
      }
      actions={
        <>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            title={t("people.directory.populateHint")}
          >
            {sync.isPending ? t("people.directory.populating") : t("people.directory.populate")}
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={handleRemoveSuppliers}
            disabled={removeSuppliers.isPending}
            title={t("people.directory.removeSuppliersHint")}
          >
            {removeSuppliers.isPending ? t("people.directory.removing") : t("people.directory.removeSuppliers")}
          </button>
          <Link href="/organogram" className="btn-secondary text-sm">
            {t("people.directory.orgChart")}
          </Link>
          <Link href="/profile" className="btn-secondary text-sm">
            {t("people.directory.myProfile")}
          </Link>
        </>
      }
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <label htmlFor="people-directory-search" className="block min-w-[220px] flex-1 text-xs font-medium text-neutral-600">
            {t("common.search")}
            <input id="people-directory-search"
              className="form-input mt-1"
              placeholder={t("people.directory.searchPlaceholder")}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
      }
      loading={isLoading}
      page={page}
      pageCount={pageCount}
      total={total}
      onPageChange={setPage}
      empty={
        !isLoading && (isError || rows.length === 0)
          ? isError
            ? (
                <EmptyState
                  icon="error"
                  title={t("people.directory.loadErrorTitle")}
                  description={t("people.directory.loadError")}
                  action={
                    <button type="button" className="btn-primary text-sm" onClick={() => refetch()}>
                      {t("common.retry")}
                    </button>
                  }
                />
              )
            : (
                <EmptyState
                  icon="contacts"
                  title={q ? t("people.directory.noMatches") : t("people.directory.emptyTitle")}
                  description={
                    q
                      ? t("people.directory.noMatchesHint")
                      : t("people.directory.emptyHint")
                  }
                  action={
                    !q ? (
                      <button type="button" className="btn-primary text-sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
                        {sync.isPending ? t("people.directory.populating") : t("people.directory.populate")}
                      </button>
                    ) : undefined
                  }
                />
              )
          : undefined
      }
    >
      <form
        className="card mb-4 grid gap-3 p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.first_name.trim() || !form.last_name.trim()) {
            setErr(t("people.directory.namesRequired"));
            return;
          }
          if (editingId) update.mutate();
          else create.mutate();
        }}
      >
        <FormField label={t("people.directory.firstName")} htmlFor="dir-first-name" required>
          <input
            id="dir-first-name"
            className="form-input"
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            required
          />
        </FormField>
        <FormField label={t("people.directory.lastName")} htmlFor="dir-last-name" required>
          <input
            id="dir-last-name"
            className="form-input"
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            required
          />
        </FormField>
        <FormField label={t("people.directory.preferredName")} htmlFor="dir-preferred-name">
          <input
            id="dir-preferred-name"
            className="form-input"
            value={form.preferred_name}
            onChange={(e) => setForm((f) => ({ ...f, preferred_name: e.target.value }))}
          />
        </FormField>
        <FormField label={t("people.directory.workEmail")} htmlFor="dir-work-email">
          <input
            id="dir-work-email"
            type="email"
            className="form-input"
            value={form.work_email}
            onChange={(e) => setForm((f) => ({ ...f, work_email: e.target.value }))}
          />
        </FormField>
        <FormField label={t("people.directory.employeeNumber")} htmlFor="dir-person-number">
          <input
            id="dir-person-number"
            className="form-input"
            value={form.person_number}
            onChange={(e) => setForm((f) => ({ ...f, person_number: e.target.value }))}
          />
        </FormField>
        <FormField label={t("people.directory.workPhone")} htmlFor="dir-work-phone">
          <input
            id="dir-work-phone"
            className="form-input"
            value={form.work_phone}
            onChange={(e) => setForm((f) => ({ ...f, work_phone: e.target.value }))}
          />
        </FormField>
        <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary text-sm" disabled={create.isPending || update.isPending}>
            {editingId
              ? update.isPending
                ? t("people.common.saving")
                : t("people.directory.updatePerson")
              : create.isPending
                ? t("people.common.saving")
                : t("people.directory.addPerson")}
          </button>
          {editingId ? (
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setErr(null);
              }}
            >
              {t("people.directory.cancelEdit")}
            </button>
          ) : null}
          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      </form>

      {syncMessage && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          {syncMessage}
        </div>
      )}

      {rows.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">{t("people.authority.staffDirectory")}</caption>
              <thead>
                <tr>
                  <th>{t("people.common.name")}</th>
                  <th>{t("people.directory.employeeNo")}</th>
                  <th>{t("people.directory.department")}</th>
                  <th>{t("people.common.position")}</th>
                  <th>{t("people.directory.email")}</th>
                  <th>{t("people.common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, idx) => (
                  <tr
                    key={p.id ?? idx}
                    className="cursor-pointer"
                    onClick={() => startEdit(p)}
                  >
                    <td className="font-medium text-neutral-800">{displayName(p, t("people.directory.personFallback", { id: p.id ?? "-" }))}</td>
                    <td>{numberOf(p)}</td>
                    <td>{deptLabel(p)}</td>
                    <td>{positionLabel(p)}</td>
                    <td className="text-neutral-600">{emailOf(p)}</td>
                    <td>
                      <span className="badge badge-muted capitalize">{p.employment_status ?? p.status ?? "-"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </RegisterShell>
  );
}
