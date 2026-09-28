"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hrDryRunSourceApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { getStoredUser, isSystemAdmin } from "@/lib/auth";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HrDryRunSourceUploadPage() {
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const user = getStoredUser();
  if (!isSystemAdmin(user)) {
    return <AccessDenied path="/hr/imports/dry-run-source" reason="System administrator access required — this stages real personal and banking source data." />;
  }

  const { data, isLoading } = useQuery({
    queryKey: ["hr-dry-run-source"],
    queryFn: async () => (await hrDryRunSourceApi.list()).data.data,
  });

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      files.forEach((f) => form.append("files[]", f));
      return hrDryRunSourceApi.upload(form);
    },
    onSuccess: (res) => {
      const { stored, rejected } = res.data.data;
      setMessage(`Staged ${stored.length} file(s).${rejected.length ? ` Rejected: ${rejected.join(", ")}` : ""}`);
      setError(null);
      setFiles([]);
      qc.invalidateQueries({ queryKey: ["hr-dry-run-source"] });
    },
    onError: () => setError("Upload failed."),
  });

  const removeOne = useMutation({
    mutationFn: (name: string) => hrDryRunSourceApi.remove(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-dry-run-source"] }),
  });

  const clearAll = useMutation({
    mutationFn: () => hrDryRunSourceApi.clear(),
    onSuccess: (res) => {
      setMessage(res.data.message);
      qc.invalidateQueries({ queryKey: ["hr-dry-run-source"] });
    },
  });

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="Dry-run source files"
        subtitle="Upload the 13 real Sage VIP export files here so the migration dry-run workflow can read them on the server — no SSH access needed. These files contain real names, bank accounts, and salaries: remove them once the dry run is done."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "HR", href: "/hr" },
              { label: "Historical Import", href: "/hr/imports" },
              { label: "Dry-run source files" },
            ]}
          />
        }
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        These files are stored on the production server&apos;s local disk only — never committed to git, never sent
        through GitHub. After running the{" "}
        <span className="font-mono">HR historical migration — dry run</span> workflow in GitHub Actions, come back
        here and clear them.
      </div>

      <FormSection title="Upload" description="PDF, XLS, XLSX only." icon="upload_file">
        <div className="flex flex-col gap-3">
          <input
            type="file"
            multiple
            accept=".pdf,.xls,.xlsx"
            className="form-input"
            disabled={upload.isPending}
            onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
          />
          {files.length > 0 ? <p className="text-xs text-neutral-600">{files.length} file(s) selected.</p> : null}
          <button
            type="button"
            className="btn-primary text-sm w-fit"
            disabled={files.length === 0 || upload.isPending}
            onClick={() => upload.mutate()}
          >
            {upload.isPending ? "Uploading…" : "Upload"}
          </button>
        </div>
      </FormSection>

      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <FormSection
        title={`Currently staged (${data?.length ?? 0})`}
        icon="folder"
        actions={
          data && data.length > 0 ? (
            <button
              type="button"
              className="btn-secondary text-xs text-red-600"
              disabled={clearAll.isPending}
              onClick={() => clearAll.mutate()}
            >
              {clearAll.isPending ? "Clearing…" : "Clear all"}
            </button>
          ) : undefined
        }
      >
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-neutral-500">No files staged yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((f) => (
                <tr key={f.name}>
                  <td className="font-mono text-xs">{f.name}</td>
                  <td>{formatBytes(f.size_bytes)}</td>
                  <td>{new Date(f.uploaded_at).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      disabled={removeOne.isPending}
                      onClick={() => removeOne.mutate(f.name)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FormSection>

      <p className="text-sm text-neutral-600">
        Once files are staged, run the dry-run from{" "}
        <Link href="https://github.com/SADC-Parliamentary-Forum/SADCPFNexus/actions/workflows/hr-migration-dry-run.yml" className="text-primary-700 underline">
          GitHub Actions
        </Link>
        .
      </p>
    </div>
  );
}
