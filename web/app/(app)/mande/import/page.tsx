"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { mandeApi, type MeImportPreview } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

export default function MandeImportPage() {
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "mande.admin");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MeImportPreview | null>(null);

  const previewMut = useMutation({
    mutationFn: (f: File) => mandeApi.previewImport(f).then((r) => r.data.data),
    onSuccess: setPreview,
  });

  const commitMut = useMutation({
    mutationFn: (f: File) => mandeApi.commitImport(f).then((r) => r.data),
    onSuccess: () => {
      setPreview(null);
      setFile(null);
    },
  });

  if (!canAdmin) {
    return (
      <div className="max-w-3xl">
        <h1 className="page-title">Historical Import</h1>
        <p className="page-subtitle mt-2">You need M&amp;E admin permission to import historical activity reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Historical Import</h1>
        <p className="page-subtitle">
          Upload a CSV with columns: activity_title, start_date, end_date, pif_number, non_pif_reason.
          Preview first, then commit to create draft activity reports.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(null);
          }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-40"
            disabled={!file || previewMut.isPending}
            onClick={() => file && previewMut.mutate(file)}
          >
            Preview
          </button>
          <button
            type="button"
            className="btn-primary text-sm disabled:opacity-40"
            disabled={!file || !preview || preview.valid === 0 || commitMut.isPending}
            onClick={() => file && commitMut.mutate(file)}
          >
            Commit {preview ? `(${preview.valid} valid)` : ""}
          </button>
        </div>
        {previewMut.isError && (
          <p className="text-sm text-red-600">Preview failed. Check CSV headers and try again.</p>
        )}
        {commitMut.isSuccess && (
          <p className="text-sm text-green-700">
            {commitMut.data.message}
          </p>
        )}
      </div>

      {preview && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-100 flex gap-4 text-sm">
            <span>{preview.valid} valid</span>
            <span>{preview.invalid} invalid</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Line</th>
                <th>Title</th>
                <th>PIF / Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.line}>
                  <td className="text-xs">{row.line}</td>
                  <td className="text-sm">{row.data.activity_title}</td>
                  <td className="text-xs">
                    {row.data.pif_number || row.data.non_pif_reason || "—"}
                  </td>
                  <td className="text-xs">
                    {row.ok ? (
                      <span className="badge-success">ok</span>
                    ) : (
                      <span className="badge-danger">{Object.values(row.errors).join("; ")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
