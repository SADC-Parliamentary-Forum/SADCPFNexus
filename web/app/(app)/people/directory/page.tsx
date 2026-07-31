"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { RegisterShell } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";

type DirectoryPerson = {
  id?: number;
  first_name?: string;
  last_name?: string;
  preferred_name?: string | null;
  email?: string | null;
  employee_number?: string | null;
  department?: string | { name?: string } | null;
  position?: string | { title?: string; name?: string } | null;
  status?: string | null;
};

function displayName(p: DirectoryPerson): string {
  const preferred = p.preferred_name?.trim();
  if (preferred) return preferred;
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
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

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
      const hay = [displayName(p), p.email, p.employee_number, deptLabel(p), positionLabel(p)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [people, q]);

  const pageCount = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const rows = slicePage(filtered, page, DEFAULT_PAGE_SIZE);

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
                  <tr key={p.id ?? idx}>
                    <td className="font-medium text-neutral-800">{displayName(p)}</td>
                    <td>{p.employee_number ?? "-"}</td>
                    <td>{deptLabel(p)}</td>
                    <td>{positionLabel(p)}</td>
                    <td className="text-neutral-600">{p.email ?? "-"}</td>
                    <td>
                      <span className="badge badge-muted capitalize">{p.status ?? "-"}</span>
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
