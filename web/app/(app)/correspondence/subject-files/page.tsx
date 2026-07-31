"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import { correspondenceApi, type CorrespondenceSubjectFile } from "@/lib/api";

export default function SubjectFilesPage() {
  const [files, setFiles] = useState<CorrespondenceSubjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ file_code: "", title: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    correspondenceApi
      .listSubjectFiles({ per_page: 100 })
      .then((res) => setFiles(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function createFile() {
    if (!form.file_code.trim() || !form.title.trim()) {
      setError("File code and title are required.");
      return;
    }
    setError(null);
    try {
      await correspondenceApi.createSubjectFile(form);
      setForm({ file_code: "", title: "", description: "" });
      load();
    } catch {
      setError("Could not create subject file (code must be unique).");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <ModulePageHeader
        title="Subject Files"
        subtitle="Institutional file plan. Correspondence links here — documents are not triplicated."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Subject Files" }]} />}
      />

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="card p-5 grid gap-3 sm:grid-cols-3">
        <input className="form-input" placeholder="File code" value={form.file_code} onChange={(e) => setForm({ ...form, file_code: e.target.value })} />
        <input className="form-input sm:col-span-2" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className="form-input sm:col-span-3" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button type="button" className="btn-primary sm:col-span-3 w-fit" onClick={createFile}>Add subject file</button>
      </div>

      <div className="card divide-y divide-neutral-100">
        {loading && <div className="p-6 text-neutral-400 text-center">Loading…</div>}
        {!loading && files.length === 0 && <div className="p-6 text-neutral-400 text-center">No subject files yet.</div>}
        {files.map((f) => (
          <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-primary">{f.file_code}</p>
              <p className="text-sm font-medium text-neutral-900">{f.title}</p>
              {f.description && <p className="text-xs text-neutral-500 mt-0.5">{f.description}</p>}
            </div>
            <span className="badge-muted">{f.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
