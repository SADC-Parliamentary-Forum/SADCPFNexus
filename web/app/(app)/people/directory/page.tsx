"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { RegisterShell } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormSection";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";

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

function displayName(p: DirectoryPerson): string {
  const preferred = p.preferred_name?.trim();
  if (preferred) return preferred;
  if (p.display_name?.trim()) return p.display_name.trim();
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || `Person #${p.id ?? "-"}`;
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

function normalizeList(payload: unknown): DirectoryPerson[] {
  if (Array.isArray(payload)) return payload as DirectoryPerson[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as DirectoryPerson[];
    if (obj.data && typeof obj.data === "object") {
      const nested = obj.data as Record<string, unknown>;
      if (Array.isArray(nested.data)) return nested.data as DirectoryPerson[];
      if (Array.isArray(nested.people)) return nested.people as DirectoryPerson[];
    }
    if (Array.isArray(obj.people)) return obj.people as DirectoryPerson[];
  }
  return [];
}

export default function StaffDirectoryPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people-authority", "staff-directory"],
    queryFn: async () => {
      return (await peopleAuthorityApi.listPeople({ directory: true })).data;
    },
  });

  const people = useMemo(() => normalizeList(data), [data]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return people;
    return people.filter((p) => {
      const hay = [displayName(p), emailOf(p), numberOf(p), deptLabel(p), positionLabel(p)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [people, q]);

  const pageCount = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const rows = slicePage(filtered, page, DEFAULT_PAGE_SIZE);

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
      setForm(emptyForm);
      setEditingId(null);
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "staff-directory"] });
    },
    onError: () => setErr("Could not create the person. First name and last name are required."),
  });

  const update = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error("No person selected");
      return peopleAuthorityApi.updatePerson(editingId, payload());
    },
    onSuccess: () => {
      setForm(emptyForm);
      setEditingId(null);
      setErr(null);
      qc.invalidateQueries({ queryKey: ["people-authority", "staff-directory"] });
    },
    onError: () => setErr("Could not update the person."),
  });

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
      title="Staff Directory"
      subtitle="Search institutional staff records linked to People & Authority."
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: "People & Authority", href: "/people" },
            { label: "Staff Directory" },
          ]}
        />
      }
      actions={
        <>
          <Link href="/organogram" className="btn-secondary text-sm">
            Organisation chart
          </Link>
          <Link href="/profile" className="btn-secondary text-sm">
            My profile
          </Link>
        </>
      }
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[220px] flex-1 text-xs font-medium text-neutral-600">
            Search
            <input
              className="form-input mt-1"
              placeholder="Name, email, employee number…"
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
      total={filtered.length}
      onPageChange={setPage}
      empty={
        !isLoading && (isError || rows.length === 0)
          ? isError
            ? (
                <EmptyState
                  icon="error"
                  title="Unable to load directory"
                  description="The staff directory could not be retrieved."
                  action={
                    <button type="button" className="btn-primary text-sm" onClick={() => refetch()}>
                      Retry
                    </button>
                  }
                />
              )
            : (
                <EmptyState
                  icon="contacts"
                  title={q ? "No matching staff" : "No staff records"}
                  description={
                    q
                      ? "Try a different search term."
                      : "Staff records will appear here once People & Authority is populated."
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
            setErr("First name and last name are required.");
            return;
          }
          if (editingId) update.mutate();
          else create.mutate();
        }}
      >
        <FormField label="First name" htmlFor="dir-first-name" required>
          <input
            id="dir-first-name"
            className="form-input"
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            required
          />
        </FormField>
        <FormField label="Last name" htmlFor="dir-last-name" required>
          <input
            id="dir-last-name"
            className="form-input"
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            required
          />
        </FormField>
        <FormField label="Preferred name" htmlFor="dir-preferred-name">
          <input
            id="dir-preferred-name"
            className="form-input"
            value={form.preferred_name}
            onChange={(e) => setForm((f) => ({ ...f, preferred_name: e.target.value }))}
          />
        </FormField>
        <FormField label="Work email" htmlFor="dir-work-email">
          <input
            id="dir-work-email"
            type="email"
            className="form-input"
            value={form.work_email}
            onChange={(e) => setForm((f) => ({ ...f, work_email: e.target.value }))}
          />
        </FormField>
        <FormField label="Employee number" htmlFor="dir-person-number">
          <input
            id="dir-person-number"
            className="form-input"
            value={form.person_number}
            onChange={(e) => setForm((f) => ({ ...f, person_number: e.target.value }))}
          />
        </FormField>
        <FormField label="Work phone" htmlFor="dir-work-phone">
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
                ? "Saving…"
                : "Update person"
              : create.isPending
                ? "Saving…"
                : "Add person"}
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
              Cancel edit
            </button>
          ) : null}
          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      </form>

      {rows.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Staff directory</caption>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Employee no.</th>
                  <th>Department</th>
                  <th>Position</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, idx) => (
                  <tr
                    key={p.id ?? idx}
                    className="cursor-pointer"
                    onClick={() => startEdit(p)}
                  >
                    <td className="font-medium text-neutral-800">{displayName(p)}</td>
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
