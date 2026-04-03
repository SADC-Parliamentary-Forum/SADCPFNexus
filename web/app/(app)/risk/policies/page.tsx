"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { policyApi, RISK_DOCUMENT_TYPES, type Policy, type RiskDocumentType } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const STATUS_OPTS = ["all", "active", "archived"] as const;

// Policy-specific document types (most relevant subset)
const POLICY_DOC_TYPES = RISK_DOCUMENT_TYPES.filter((t) =>
  ["risk_policy", "risk_assessment", "risk_evidence", "other"].includes(t.value)
);

function RenewalBadge({ date }: { date: string | null }) {
  if (!date) return <span className="text-xs text-neutral-400">—</span>;
  const d    = new Date(date);
  const now  = new Date();
  const days = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
  const cls  = days < 0 ? "text-red-600 bg-red-50 border-red-200"
             : days < 90 ? "text-amber-700 bg-amber-50 border-amber-200"
             : "text-neutral-600 bg-neutral-50 border-neutral-200";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {days < 0 && <span className="material-symbols-outlined text-[12px]">warning</span>}
      {formatDateShort(date)}
    </span>
  );
}

type PolicyForm = {
  title: string;
  description: string;
  owner_name: string;
  renewal_date: string;
  status: "active" | "archived";
};

function EmptyForm(): PolicyForm {
  return { title: "", description: "", owner_name: "", renewal_date: "", status: "active" };
}

interface StagedDoc {
  id: number;
  file: File;
  docType: RiskDocumentType;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PolicyLibraryPage() {
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("active");
  const [search, setSearch]             = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState<Policy | null>(null);
  const [form, setForm]                 = useState<PolicyForm>(EmptyForm());
  const [saving, setSaving]             = useState(false);

  // Document staging
  const [stagedDocs, setStagedDocs] = useState<StagedDoc[]>([]);
  const [stagedSeq, setStagedSeq]   = useState(1);
  const [docDragOver, setDocDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const params = {
    per_page: 50,
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["risk-policies", statusFilter, search],
    queryFn: () => policyApi.list(params).then((r) => r.data.data ?? []),
    staleTime: 30_000,
  });

  const policies: Policy[] = data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => policyApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risk-policies"] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(EmptyForm());
    setStagedDocs([]);
    setShowModal(true);
  }

  function openEdit(p: Policy) {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description ?? "",
      owner_name: p.owner_name ?? "",
      renewal_date: p.renewal_date ?? "",
      status: p.status,
    });
    setStagedDocs([]);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setStagedDocs([]);
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const added: StagedDoc[] = [];
    let seq = stagedSeq;
    Array.from(files).forEach((file) => {
      if (file.size > 25 * 1024 * 1024) return;
      added.push({ id: seq++, file, docType: "risk_policy" });
    });
    setStagedSeq(seq);
    setStagedDocs((prev) => [...prev, ...added]);
  }

  function removeStagedDoc(id: number) {
    setStagedDocs((prev) => prev.filter((d) => d.id !== id));
  }

  function updateStagedType(id: number, docType: RiskDocumentType) {
    setStagedDocs((prev) => prev.map((d) => (d.id === id ? { ...d, docType } : d)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        renewal_date: form.renewal_date || null,
        description: form.description || null,
        owner_name: form.owner_name || null,
      };

      let policyId: number;
      if (editing) {
        await policyApi.update(editing.id, payload);
        policyId = editing.id;
      } else {
        const res = await policyApi.create(payload);
        policyId = res.data.data.id;
      }

      // Upload any staged documents
      if (stagedDocs.length > 0) {
        await Promise.allSettled(
          stagedDocs.map((d) => policyApi.uploadAttachment(policyId, d.file, d.docType))
        );
      }

      qc.invalidateQueries({ queryKey: ["risk-policies"] });
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Policy Library</h1>
          <p className="page-subtitle">
            Manage organisational policies and link them to risks in the register.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">add</span> New Policy
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {STATUS_OPTS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`filter-tab capitalize ${statusFilter === s ? "active" : ""}`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search policies…"
          className="form-input w-60"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-primary text-2xl mr-2">
              progress_activity
            </span>
            <span className="text-sm text-neutral-400">Loading policies…</span>
          </div>
        ) : policies.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-neutral-200 text-5xl block mb-3">
              policy
            </span>
            <p className="text-sm text-neutral-400">No policies found.</p>
            <button onClick={openCreate} className="btn-primary mt-4 mx-auto">
              Add First Policy
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Policy Title</th>
                <th>Owner</th>
                <th>Renewal Date</th>
                <th>Linked Risks</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/risk/policies/${p.id}`}
                      className="font-semibold text-neutral-900 hover:text-primary"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="text-neutral-600">{p.owner_name ?? "—"}</td>
                  <td>
                    <RenewalBadge date={p.renewal_date} />
                  </td>
                  <td className="text-neutral-500">{p.risks_count ?? 0}</td>
                  <td>
                    <span className={`badge-${p.status === "active" ? "success" : "muted"}`}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <Link
                        href={`/risk/policies/${p.id}`}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-primary"
                        title="View"
                      >
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      </Link>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-primary"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this policy?")) deleteMutation.mutate(p.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-neutral-900">
                {editing ? "Edit Policy" : "New Policy"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              {/* Policy Fields */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    required
                    className="form-input w-full"
                    placeholder="e.g. ICT Security Policy"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="form-input w-full h-20 resize-none"
                    placeholder="Brief description of the policy…"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-neutral-700">Policy Owner</label>
                    <input
                      value={form.owner_name}
                      onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
                      className="form-input w-full"
                      placeholder="e.g. Ronald Windwaai"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-700">Renewal Date</label>
                    <input
                      type="date"
                      value={form.renewal_date}
                      onChange={(e) => setForm((f) => ({ ...f, renewal_date: e.target.value }))}
                      className="form-input w-full"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as "active" | "archived" }))
                    }
                    className="form-input w-full"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Document Attachments */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-neutral-700">
                      Attachments
                      {stagedDocs.length > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold">
                          {stagedDocs.length}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Attach the policy document, evidence, or supporting files.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">attach_file</span>
                    Browse
                  </button>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDocDragOver(true); }}
                  onDragLeave={() => setDocDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDocDragOver(false);
                    addFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed py-4 cursor-pointer transition-colors ${
                    docDragOver
                      ? "border-primary bg-primary/5"
                      : "border-neutral-200 hover:border-primary/40 hover:bg-neutral-50"
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px] text-neutral-300">
                    cloud_upload
                  </span>
                  <p className="text-xs text-neutral-500">
                    Drag &amp; drop or{" "}
                    <span className="text-primary font-medium">click to browse</span>
                    <span className="text-neutral-400"> — PDF, Word, images, max 25 MB</span>
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                />

                {/* Staged file list */}
                {stagedDocs.length > 0 && (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {stagedDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2.5 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
                      >
                        <span className="material-symbols-outlined text-[16px] text-neutral-400 shrink-0">
                          attach_file
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-neutral-800 truncate">
                            {doc.file.name}
                          </p>
                          <p className="text-[11px] text-neutral-400">
                            {formatBytes(doc.file.size)}
                          </p>
                        </div>
                        <select
                          value={doc.docType}
                          onChange={(e) =>
                            updateStagedType(doc.id, e.target.value as RiskDocumentType)
                          }
                          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        >
                          {POLICY_DOC_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeStagedDoc(doc.id)}
                          className="text-neutral-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <span className="material-symbols-outlined text-[15px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 disabled:opacity-60"
                >
                  {saving
                    ? stagedDocs.length > 0
                      ? "Saving & uploading…"
                      : "Saving…"
                    : editing
                    ? "Save Changes"
                    : "Create Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
