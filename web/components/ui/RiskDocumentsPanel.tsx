"use client";

import { type RiskAttachment, type RiskDocumentType, RISK_DOCUMENT_TYPES } from "@/lib/api";
import GenericDocumentsPanel from "./GenericDocumentsPanel";

interface Props {
  documents: RiskAttachment[];
  loading: boolean;
  uploading: boolean;
  onUpload: (file: File, type: RiskDocumentType) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  downloadUrl: (id: number) => string;
}

export default function RiskDocumentsPanel({ documents, loading, uploading, onUpload, onDelete, downloadUrl }: Props) {
  return (
    <GenericDocumentsPanel
      documents={documents}
      documentTypes={RISK_DOCUMENT_TYPES as unknown as { value: string; label: string; icon: string }[]}
      defaultType="risk_evidence"
      loading={loading}
      uploading={uploading}
      onUpload={(file, type) => onUpload(file, type as RiskDocumentType)}
      onDelete={onDelete}
      downloadUrl={downloadUrl}
    />
  );
}
