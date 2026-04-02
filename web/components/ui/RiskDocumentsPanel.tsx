"use client";

import { useState, useRef } from "react";
import { type RiskAttachment, type RiskDocumentType, RISK_DOCUMENT_TYPES } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function docTypeLabel(type: string): string {
  return RISK_DOCUMENT_TYPES.find(t => t.value === type)?.label ?? type;
}
function docTypeIcon(type: string): string {
  return RISK_DOCUMENT_TYPES.find(t => t.value === type)?.icon ?? "attach_file";
}

interface Props {
  documents: RiskAttachment[];
  loading: boolean;
  uploading: boolean;
  onUpload: (file: File, type: RiskDocumentType) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  downloadUrl: (id: number) => string;
}

export default function RiskDocumentsPanel({ documents, loading, uploading, onUpload, onDelete, downloadUrl }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<RiskDocumentType>("risk_evidence");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleFileChange = (file: File) => setSelectedFile(file);

  const handleUpload = async () => {
    if (!selectedFile) return;
    await onUpload(selectedFile, docType);
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try { await onDelete(id); } finally { setDeletingId(null); }
  };

  const handleDownload = async (doc: RiskAttachment, url: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sadcpf_token") : null;
    try {
      const resp = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = doc.original_filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      alert("Failed to download file.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="space-y-4">
        <div
          className={cn(
            "border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer",
            dragOver ? "border-primary bg-primary/5" : "border-neutral-200 hover:border-primary/50 hover:bg-neutral-50"
          )}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFileChange(f);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
          />
          <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2 block">upload_file</span>
          {selectedFile ? (
            <p className="text-sm font-semibold text-primary">{selectedFile.name} ({formatBytes(selectedFile.size)})</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-neutral-700">Click to select or drag &amp; drop</p>
              <p className="text-xs text-neutral-400 mt-1">PDF, Word, JPG, PNG · Max 25 MB</p>
            </>
          )}
        </div>

        {selectedFile && (
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 min-w-[200px]">
              <label className="text-xs font-semibold text-neutral-600">Document Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as RiskDocumentType)}
                className="form-input"
              >
                {RISK_DOCUMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="btn-primary disabled:opacity-60"
              >
                {uploading ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                )}
                Upload
              </button>
              <button
                type="button"
                onClick={() => { setSelectedFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="btn-secondary px-3"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document List */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <span className="material-symbols-outlined animate-spin text-primary text-2xl mr-2">progress_activity</span>
          <span className="text-sm text-neutral-400">Loading documents…</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="py-10 text-center text-sm text-neutral-400 italic">No documents uploaded yet.</div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-4 p-4 rounded-xl border border-neutral-100 bg-neutral-50/50 hover:bg-white hover:border-neutral-200 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-[20px]">{docTypeIcon(doc.document_type)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-900 truncate">{doc.original_filename}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {docTypeLabel(doc.document_type)}
                  </span>
                  <span className="text-xs text-neutral-400">{formatBytes(doc.size_bytes)}</span>
                  {doc.uploader && (
                    <span className="text-xs text-neutral-400">by {doc.uploader.name}</span>
                  )}
                  <span className="text-xs text-neutral-400">
                    {new Date(doc.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(doc, downloadUrl(doc.id))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-600 hover:text-primary hover:border-primary text-xs font-semibold transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="flex items-center justify-center h-8 w-8 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
