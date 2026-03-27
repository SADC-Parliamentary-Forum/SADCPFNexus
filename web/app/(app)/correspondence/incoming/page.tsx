"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { correspondenceApi, adminApi, type Department } from "@/lib/api";

const ACCEPTED = ".pdf,.doc,.docx";
const MAX_MB = 25;

export default function IncomingMailPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    subject: "",
    type: "external",
    priority: "normal",
    language: "en",
    file_code: "",
    department_id: "",
    body: "",
  });

  useEffect(() => {
    adminApi.listDepartments().then((res) => setDepartments(res.data.data ?? [])).catch(() => {});
  }, []);

  function handleField(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) validateAndSetFile(picked);
  }

  function validateAndSetFile(f: File) {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "doc", "docx"].includes(ext ?? "")) {
      setError("Only PDF, DOC, and DOCX files are allowed.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_MB} MB.`);
      return;
    }
    setFile(f);
    setError(null);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.subject.trim()) {
      setError("Title and Subject are required.");
      return;
    }
    if (!file) {
      setError("Please upload the incoming document.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      fd.append("direction", "incoming");
      fd.append("file", file);

      const res = await correspondenceApi.create(fd);
      router.push(`/correspondence/${res.data.data.id}`);
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/correspondence" className="hover:text-neutral-700">Correspondence</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Incoming Mail</span>
      </div>

      <div>
        <h1 className="page-title">Capture Incoming Mail</h1>
        <p className="page-subtitle">Upload and register incoming correspondence for tracking and routing.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* File Upload */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900">Upload Incoming Document</h3>
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-neutral-200 hover:border-neutral-300"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleFileChange} />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-4xl text-emerald-500">description</span>
              <p className="text-sm font-semibold text-neutral-900">{file.name}</p>
              <p className="text-xs text-neutral-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs text-red-500 hover:text-red-700">
                Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-4xl text-neutral-300">move_to_inbox</span>
              <p className="text-sm text-neutral-600">
                <span className="font-semibold text-primary">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-neutral-400">PDF, DOC, DOCX — max {MAX_MB} MB</p>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">Classification</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Title / From *</label>
            <input name="title" value={form.title} onChange={handleField} className="form-input w-full" placeholder="e.g. Letter from Ministry of Finance — Budget Queries" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Subject *</label>
            <input name="subject" value={form.subject} onChange={handleField} className="form-input w-full" placeholder="Subject matter of the incoming letter" />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Type</label>
            <select name="type" value={form.type} onChange={handleField} className="form-input w-full">
              <option value="external">External</option>
              <option value="internal_memo">Internal Memo</option>
              <option value="diplomatic_note">Diplomatic Note</option>
              <option value="procurement">Procurement</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Priority</label>
            <select name="priority" value={form.priority} onChange={handleField} className="form-input w-full">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Language</label>
            <select name="language" value={form.language} onChange={handleField} className="form-input w-full">
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="pt">Portuguese</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">File Code</label>
            <input name="file_code" value={form.file_code} onChange={handleField} className="form-input w-full" placeholder="e.g. SRHR, PROC, FIN" />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Route to Department</label>
            <select name="department_id" value={form.department_id} onChange={handleField} className="form-input w-full">
              <option value="">— No routing —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Notes <span className="text-neutral-400 font-normal">(optional)</span></label>
          <textarea name="body" value={form.body} onChange={handleField} rows={3} className="form-input w-full resize-y" placeholder="Any routing instructions or notes…" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pb-4">
        <Link href="/correspondence" className="btn-secondary">Cancel</Link>
        <button type="button" disabled={saving} onClick={handleSave} className="btn-primary">
          {saving ? "Saving…" : "Register Incoming Mail"}
        </button>
      </div>
    </div>
  );
}
