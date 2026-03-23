"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { hrFilesApi, type HrPersonalFile, type HrFileDocument } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { cn } from "@/lib/utils";

const CONFIDENTIALITY_BADGE: Record<HrFileDocument["confidentiality_level"], string> = {
  standard: "badge-muted",
  restricted: "badge-warning",
  confidential: "badge-danger",
};

const DOC_TYPES = [
  "contract", "appointment_letter", "id_copy", "passport_copy", "qualification",
  "performance_review", "warning_letter", "commendation", "payslip", "leave_record",
  "disciplinary", "training_certificate", "medical", "other",
];

export default function HrFileDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = getStoredUser();
  const isHR = user?.roles?.includes("hr") || user?.permissions?.includes("hr.admin");

  const [file, setFile] = useState<HrPersonalFile | null>(null);
  const [documents, setDocuments] = useState<HrFileDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    document_type: "other",
    title: "",
    file_name: "",
    confidentiality_level: "standard" as HrFileDocument["confidentiality_level"],
    issue_date: "",
    remarks: "",
  });

  useEffect(() => {
    hrFilesApi.get(Number(id))
      .then((res) => setFile(res.data))
      .catch(() => {});
  }, [id]);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hrFilesApi.getDocuments(Number(id), docTypeFilter ? { document_type: docTypeFilter } : undefined);
      setDocuments(res.data.data);
    } catch {
      setError("Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, [id, docTypeFilter]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleUpload = async () => {
    if (!uploadForm.title) return;
    setUploading(true);
    try {
      await hrFilesApi.uploadDocument(Number(id), {
        document_type: uploadForm.document_type,
        title: uploadForm.title,
        file_name: uploadForm.file_name || undefined,
        confidentiality_level: uploadForm.confidentiality_level,
        issue_date: uploadForm.issue_date || undefined,
        remarks: uploadForm.remarks || undefined,
      });
      setShowUpload(false);
      setUploadForm({ document_type: "other", title: "", file_name: "", confidentiality_level: "standard", issue_date: "", remarks: "" });
      loadDocs();
    } catch {
      alert("Failed to add document.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    setDeleting(true);
    try {
      await hrFilesApi.deleteDocument(Number(id), docId);
      setDeleteConfirm(null);
      loadDocs();
    } catch {
      alert("Failed to delete document.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-neutral-400">
        <button onClick={() => router.push("/hr")} className="hover:text-neutral-600">HR</button>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <button onClick={() => router.push("/hr/files")} className="hover:text-neutral-600">Employee Files</button>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <button onClick={() => router.push(`/hr/files/${id}`)} className="hover:text-neutral-600">
          {file?.employee?.name ?? `File #${id}`}
        </button>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-700 font-medium">Documents</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Document Vault</h1>
          <p className="page-subtitle">
            {file ? `${file.employee?.name ?? `Employee #${id}`} — all HR documents on file` : "Loading..."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => router.push(`/hr/files/${id}?tab=documents`)}
          >
            <span className="material-symbols-outlined text-[18px]">folder</span>
            Back to File
          </button>
          {isHR && (
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowUpload(true)}>
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              Add Document
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-600 font-medium">Filter by type:</label>
          <select
            className="form-input w-52"
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
          >
            <option value="">All Document Types</option>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <span className="text-sm text-neutral-400">{documents.length} document{documents.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Document Cards */}
      {error ? (
        <div className="card p-8 text-center text-red-500">
          <span className="material-symbols-outlined text-4xl">error</span>
          <p className="mt-2">{error}</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="h-4 bg-neutral-100 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-neutral-100 rounded animate-pulse w-1/2" />
              <div className="h-3 bg-neutral-100 rounded animate-pulse w-2/3" />
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="card p-12 text-center text-neutral-400">
          <span className="material-symbols-outlined text-5xl block mb-2">folder_open</span>
          <p className="font-medium">No documents found</p>
          <p className="text-sm mt-1">{docTypeFilter ? "Try clearing the filter" : "Start by adding a document to this file"}</p>
          {isHR && (
            <button className="btn-primary mt-4" onClick={() => setShowUpload(true)}>Add First Document</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div key={doc.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[22px] text-blue-600">description</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("badge text-xs capitalize", CONFIDENTIALITY_BADGE[doc.confidentiality_level])}>
                    {doc.confidentiality_level}
                  </span>
                  {isHR && (
                    <button
                      className="text-neutral-300 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                      onClick={() => setDeleteConfirm(doc.id)}
                      title="Delete document"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  )}
                </div>
              </div>
              <h3 className="font-semibold text-neutral-800 text-sm mb-1 line-clamp-2">{doc.title}</h3>
              <p className="text-xs text-neutral-500 capitalize mb-2">{doc.document_type.replace(/_/g, " ")}</p>
              {doc.file_name && (
                <p className="text-xs text-neutral-400 font-mono truncate mb-2">{doc.file_name}</p>
              )}
              {doc.remarks && (
                <p className="text-xs text-neutral-500 line-clamp-2 mb-2">{doc.remarks}</p>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100 mt-2">
                <div>
                  {doc.issue_date && (
                    <p className="text-xs text-neutral-400">Issued: {formatDateShort(doc.issue_date)}</p>
                  )}
                  <p className="text-xs text-neutral-400">Added: {formatDateShort(doc.created_at)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-neutral-400">v{doc.version}</span>
                  {doc.verified_at && (
                    <span className="material-symbols-outlined text-[16px] text-green-500" title={`Verified ${formatDateShort(doc.verified_at)}`}>
                      verified
                    </span>
                  )}
                </div>
              </div>
              {doc.uploaded_by && (
                <p className="text-xs text-neutral-400 mt-1">By: {doc.uploaded_by.name}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-800">Add Document</h2>
              <button onClick={() => setShowUpload(false)} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Document Type <span className="text-red-500">*</span></label>
                <select className="form-input" value={uploadForm.document_type} onChange={(e) => setUploadForm((f) => ({ ...f, document_type: e.target.value }))}>
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input type="text" className="form-input" placeholder="Document title" value={uploadForm.title} onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">File Name</label>
                <input type="text" className="form-input" placeholder="e.g. contract_2024.pdf" value={uploadForm.file_name} onChange={(e) => setUploadForm((f) => ({ ...f, file_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Confidentiality</label>
                  <select className="form-input" value={uploadForm.confidentiality_level} onChange={(e) => setUploadForm((f) => ({ ...f, confidentiality_level: e.target.value as HrFileDocument["confidentiality_level"] }))}>
                    <option value="standard">Standard</option>
                    <option value="restricted">Restricted</option>
                    <option value="confidential">Confidential</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Issue Date</label>
                  <input type="date" className="form-input" value={uploadForm.issue_date} onChange={(e) => setUploadForm((f) => ({ ...f, issue_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Remarks</label>
                <textarea className="form-input resize-none" rows={2} placeholder="Optional notes..." value={uploadForm.remarks} onChange={(e) => setUploadForm((f) => ({ ...f, remarks: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn-secondary flex-1" onClick={() => setShowUpload(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={handleUpload} disabled={uploading || !uploadForm.title}>
                {uploading ? "Saving..." : "Add Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card p-6 w-full max-w-sm">
            <div className="text-center mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-red-600 text-[26px]">delete</span>
              </div>
              <h2 className="text-lg font-semibold text-neutral-800">Delete Document?</h2>
              <p className="text-sm text-neutral-500 mt-1">This will remove the document record. This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-700 !border-red-600"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
