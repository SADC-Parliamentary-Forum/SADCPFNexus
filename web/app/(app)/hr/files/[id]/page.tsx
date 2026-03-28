"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  hrFilesApi,
  type HrPersonalFile,
  type HrFileDocument,
  type HrFileTimelineEvent,
} from "@/lib/api";

const FILE_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  probation: "Probation",
  suspended: "Suspended",
  separated: "Separated",
  archived: "Archived",
};

const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  permanent: "Permanent",
  contract: "Contract",
  secondment: "Secondment",
  acting: "Acting",
  probation: "Probation",
  separated: "Separated",
};

const PROBATION_STATUS_LABELS: Record<string, string> = {
  on_probation: "On probation",
  confirmed: "Confirmed",
  extended: "Extended",
  terminated: "Terminated",
  not_applicable: "N/A",
};

const DOCUMENT_TYPES = [
  "identity",
  "appointment",
  "contract",
  "qualification",
  "training",
  "appraisal",
  "commendation",
  "warning",
  "leave_reference",
  "policy_acknowledgement",
  "medical",
  "separation",
  "other",
];

const EVENT_TYPES = [
  "appointment",
  "probation_start",
  "confirmation",
  "promotion",
  "transfer",
  "training",
  "appraisal",
  "commendation",
  "warning",
  "contract_renewal",
  "acting",
  "separation",
  "other",
];

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type TabId = "summary" | "personal" | "employment" | "performance" | "conduct" | "qualifications" | "documents" | "timeline" | "hr_notes";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "summary", label: "Summary", icon: "dashboard" },
  { id: "personal", label: "Personal details", icon: "person" },
  { id: "employment", label: "Employment", icon: "work" },
  { id: "performance", label: "Performance & appraisal", icon: "trending_up" },
  { id: "conduct", label: "Conduct & recognition", icon: "gavel" },
  { id: "qualifications", label: "Qualifications & training", icon: "school" },
  { id: "documents", label: "Documents", icon: "folder" },
  { id: "timeline", label: "Timeline", icon: "timeline" },
  { id: "hr_notes", label: "HR notes", icon: "lock" },
];

interface FileWithRelations extends HrPersonalFile {
  documents?: HrFileDocument[];
  timeline_events?: HrFileTimelineEvent[];
}

export default function HrFileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id != null ? Number(params.id) : NaN;
  const [file, setFile] = useState<FileWithRelations | null>(null);
  const [tab, setTab] = useState<TabId>("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // HR notes form
  const [hrNote, setHrNote] = useState("");
  const [savingHrNote, setSavingHrNote] = useState(false);
  const [hrNoteSaved, setHrNoteSaved] = useState(false);

  // Document upload form
  const [docType, setDocType] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Timeline form
  const [eventType, setEventType] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      router.replace("/hr/files");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await hrFilesApi.get(id, { with_documents: true, with_timeline: true });
      const fileData = res.data as FileWithRelations;
      setFile(fileData);
      const hrNotes = (fileData as unknown as Record<string, unknown>).hr_notes;
      setHrNote(typeof hrNotes === "string" ? hrNotes : "");
    } catch {
      setError("Failed to load HR file.");
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const handleSaveHrNote = async () => {
    if (!file) return;
    setSavingHrNote(true);
    setHrNoteSaved(false);
    try {
      // hr_notes is an extended field sent to the API; cast to bypass strict TS check
      await hrFilesApi.update(file.id, { hr_notes: hrNote } as unknown as Partial<typeof file>);
      setHrNoteSaved(true);
      setTimeout(() => setHrNoteSaved(false), 3000);
    } catch {
      setError("Failed to save HR notes.");
    } finally {
      setSavingHrNote(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !docType || !docTitle.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      await hrFilesApi.uploadDocument(file.id, { document_type: docType, title: docTitle.trim() });
      setDocType("");
      setDocTitle("");
      load();
    } catch {
      setUploadError("Failed to add document.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddTimelineEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !eventType || !eventTitle.trim() || !eventDate) return;
    setAddingEvent(true);
    try {
      await hrFilesApi.addTimelineEvent(file.id, {
        event_type: eventType,
        title: eventTitle.trim(),
        description: eventDescription.trim() || undefined,
        event_date: eventDate,
      });
      setEventType("");
      setEventTitle("");
      setEventDescription("");
      setEventDate("");
      load();
    } finally {
      setAddingEvent(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!file || !confirm("Delete this document record?")) return;
    try {
      await hrFilesApi.deleteDocument(file.id, docId);
      load();
    } catch {
      setError("Failed to delete document.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-center py-20 text-neutral-500">
          <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
          <span className="ml-2">Loading file…</span>
        </div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? "Not found"}
        </div>
        <Link href="/hr/files" className="text-sm font-semibold text-primary hover:underline">
          Back to HR Files
        </Link>
      </div>
    );
  }

  const employeeName = file.employee?.name ?? `Employee #${file.employee_id}`;
  const documents = file.documents ?? [];
  const timelineEvents = (file.timeline_events ?? []).sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/hr" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-block">
          HR
        </Link>
        <Link href="/hr/files" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 block">
          Personal Files
        </Link>
        <h1 className="page-title">{employeeName}</h1>
        <p className="page-subtitle">
          {file.current_position ?? "—"} · {file.department?.name ?? "—"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      {tab === "summary" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap gap-2">
            <span className={`badge ${file.file_status === "active" ? "badge-success" : "badge-muted"}`}>
              {FILE_STATUS_LABELS[file.file_status] ?? file.file_status}
            </span>
            <span className="badge badge-muted">
              {EMPLOYMENT_STATUS_LABELS[file.employment_status] ?? file.employment_status}
            </span>
            <span className="badge badge-muted">
              {PROBATION_STATUS_LABELS[file.probation_status] ?? file.probation_status}
            </span>
            {file.active_warning_flag && <span className="badge badge-danger">Active warning</span>}
          </div>
          <div className="card p-4 grid gap-3 sm:grid-cols-2">
            <p><span className="text-xs text-neutral-500">Appointment</span><br />{formatDate(file.appointment_date)}</p>
            <p><span className="text-xs text-neutral-500">Contract type</span><br />{file.contract_type ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">Grade</span><br />{file.grade_scale ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">Contract expiry</span><br />{formatDate(file.contract_expiry_date)}</p>
          </div>
          {file.latest_appraisal_summary && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">Latest appraisal summary</h3>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{file.latest_appraisal_summary}</p>
            </div>
          )}
          <div className="card p-4 flex flex-wrap gap-4">
            <p>Commendations: <strong>{file.commendation_count}</strong></p>
            <p>Open development actions: <strong>{file.open_development_action_count}</strong></p>
            <p>Training hours (cycle): <strong>{file.training_hours_current_cycle}</strong></p>
          </div>
          {timelineEvents.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">Recent timeline</h3>
              <ul className="space-y-2">
                {timelineEvents.slice(0, 5).map((ev) => (
                  <li key={ev.id} className="text-sm text-neutral-600 flex gap-2">
                    <span className="text-neutral-400">{formatDate(ev.event_date)}</span>
                    <span>{ev.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Personal details */}
      {tab === "personal" && (
        <div className="card p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <p><span className="text-xs text-neutral-500">Staff number</span><br />{file.staff_number ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">Date of birth</span><br />{formatDate(file.date_of_birth)}</p>
            <p><span className="text-xs text-neutral-500">Gender</span><br />{file.gender ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">Nationality</span><br />{file.nationality ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">ID / Passport</span><br />{file.id_passport_number ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">Marital status</span><br />{file.marital_status ?? "—"}</p>
          </div>
          <div>
            <span className="text-xs text-neutral-500">Residential address</span>
            <p className="text-sm text-neutral-900 mt-1">{file.residential_address ?? "—"}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <p><span className="text-xs text-neutral-500">Emergency contact</span><br />{file.emergency_contact_name ?? "—"} {file.emergency_contact_relationship && `(${file.emergency_contact_relationship})`}</p>
            <p><span className="text-xs text-neutral-500">Emergency phone</span><br />{file.emergency_contact_phone ?? "—"}</p>
          </div>
          {file.next_of_kin_details && (
            <div>
              <span className="text-xs text-neutral-500">Next of kin</span>
              <p className="text-sm text-neutral-900 mt-1">{file.next_of_kin_details}</p>
            </div>
          )}
        </div>
      )}

      {/* Employment */}
      {tab === "employment" && (
        <div className="card p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <p><span className="text-xs text-neutral-500">Appointment date</span><br />{formatDate(file.appointment_date)}</p>
            <p><span className="text-xs text-neutral-500">Confirmation date</span><br />{formatDate(file.confirmation_date)}</p>
            <p><span className="text-xs text-neutral-500">Contract type</span><br />{file.contract_type ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">Contract expiry</span><br />{formatDate(file.contract_expiry_date)}</p>
            <p><span className="text-xs text-neutral-500">Separation date</span><br />{formatDate(file.separation_date)}</p>
            <p><span className="text-xs text-neutral-500">Separation reason</span><br />{file.separation_reason ?? "—"}</p>
          </div>
          {file.promotion_history && Array.isArray(file.promotion_history) && file.promotion_history.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">Promotion history</h3>
              <ul className="list-disc list-inside text-sm text-neutral-700 space-y-1">
                {file.promotion_history.map((p: { date?: string; from_position?: string; to_position?: string }, i: number) => (
                  <li key={i}>{formatDate(p.date)} – {p.from_position} → {p.to_position}</li>
                ))}
              </ul>
            </div>
          )}
          {file.transfer_history && Array.isArray(file.transfer_history) && file.transfer_history.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">Transfer history</h3>
              <ul className="list-disc list-inside text-sm text-neutral-700 space-y-1">
                {file.transfer_history.map((t: { date?: string; from_dept?: string; to_dept?: string }, i: number) => (
                  <li key={i}>{formatDate(t.date)} – {t.from_dept} → {t.to_dept}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Performance & appraisal */}
      {tab === "performance" && (
        <div className="card p-4 space-y-4">
          {file.latest_appraisal_summary ? (
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">Latest appraisal summary</h3>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{file.latest_appraisal_summary}</p>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No appraisal summary on file.</p>
          )}
          <p className="text-sm text-neutral-600">
            Open development actions: <strong>{file.open_development_action_count}</strong> · Training hours this cycle: <strong>{file.training_hours_current_cycle}</strong>
          </p>
          <Link href="/hr/performance" className="text-sm font-semibold text-primary hover:underline">
            View Performance Tracker →
          </Link>
        </div>
      )}

      {/* Conduct & recognition */}
      {tab === "conduct" && (
        <div className="card p-4 space-y-4">
          <div className="flex flex-wrap gap-4">
            <p>Commendations: <strong>{file.commendation_count}</strong></p>
            <p>Active warning: <strong>{file.active_warning_flag ? "Yes" : "No"}</strong></p>
          </div>
          <p className="text-sm text-neutral-500">Detailed conduct and recognition records can be linked here when available.</p>
        </div>
      )}

      {/* Documents */}
      {tab === "documents" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">Add document record</h3>
            {uploadError && <p className="text-sm text-red-600 mb-2">{uploadError}</p>}
            <form onSubmit={handleUploadDocument} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Type</label>
                <select className="form-input py-2 text-sm min-w-[160px]" value={docType} onChange={(e) => setDocType(e.target.value)} required>
                  <option value="">Select…</option>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Title</label>
                <input type="text" className="form-input w-full" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Document title" required />
              </div>
              <button type="submit" disabled={uploading} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
                {uploading ? "Adding…" : "Add"}
              </button>
            </form>
          </div>
          <div className="card overflow-hidden">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-neutral-900">Document vault</h3>
            </div>
            {documents.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">No documents on file.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Issue date</th>
                      <th>Expiry</th>
                      <th>Confidentiality</th>
                      <th>Uploaded by</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="text-sm">{doc.document_type}</td>
                        <td className="font-medium text-neutral-900">{doc.title}</td>
                        <td className="text-sm text-neutral-600">{formatDate(doc.issue_date)}</td>
                        <td className="text-sm text-neutral-600">{formatDate(doc.expiry_date)}</td>
                        <td className="text-sm">{doc.confidentiality_level}</td>
                        <td className="text-sm text-neutral-600">{doc.uploaded_by?.name ?? "—"}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Qualifications & Training */}
      {tab === "qualifications" && (
        <div className="space-y-4">
          {/* Academic qualifications */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-primary">school</span>
              </div>
              Academic &amp; Professional Qualifications
            </h3>
            {(file as unknown as Record<string, unknown>).academic_qualifications ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                {(file as unknown as Record<string, unknown>).academic_qualifications as string}
              </p>
            ) : (
              <p className="text-sm text-neutral-400 italic">No qualification records on file. Add via document vault.</p>
            )}
          </div>

          {/* Professional certifications */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-purple-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-purple-600">workspace_premium</span>
              </div>
              Certifications &amp; Memberships
            </h3>
            {(file as unknown as Record<string, unknown>).certifications ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                {(file as unknown as Record<string, unknown>).certifications as string}
              </p>
            ) : (
              <p className="text-sm text-neutral-400 italic">No certification records on file.</p>
            )}
          </div>

          {/* Training history */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-green-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-green-600">fitness_center</span>
              </div>
              Training &amp; Development History
            </h3>
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="rounded-lg bg-neutral-50 px-4 py-3 min-w-[120px]">
                <p className="text-xs text-neutral-500">Training hours (cycle)</p>
                <p className="text-lg font-bold text-neutral-900">{file.training_hours_current_cycle ?? 0}</p>
              </div>
              <div className="rounded-lg bg-neutral-50 px-4 py-3 min-w-[120px]">
                <p className="text-xs text-neutral-500">Open dev. actions</p>
                <p className="text-lg font-bold text-neutral-900">{file.open_development_action_count ?? 0}</p>
              </div>
            </div>
            {(file as unknown as Record<string, unknown>).training_history ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                {(file as unknown as Record<string, unknown>).training_history as string}
              </p>
            ) : (
              <p className="text-sm text-neutral-400 italic">No training history on file. Records appear here as training is attended and logged.</p>
            )}
          </div>

          {/* Competency gaps & succession */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-amber-600">target</span>
              </div>
              Competency Gaps &amp; Succession Notes
            </h3>
            {(file as unknown as Record<string, unknown>).competency_gaps ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                {(file as unknown as Record<string, unknown>).competency_gaps as string}
              </p>
            ) : (
              <p className="text-sm text-neutral-400 italic">No competency gap notes recorded.</p>
            )}
          </div>

          {/* Link to performance tracker */}
          <div className="flex items-center gap-3">
            <Link href="/hr/performance" className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
              View Performance Tracker
            </Link>
            <Link href="/hr/appraisals" className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm">
              <span className="material-symbols-outlined text-[18px]">rate_review</span>
              View Appraisals
            </Link>
          </div>
        </div>
      )}

      {/* HR Notes & Restricted */}
      {tab === "hr_notes" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-600 text-[20px]">lock</span>
            <p className="text-sm text-amber-800">
              <strong>Restricted.</strong> Contents of this tab are visible to authorised HR staff and executive roles only. Not visible to the employee or general supervisors.
            </p>
          </div>

          {/* HR narrative notes */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-neutral-400">sticky_note_2</span>
              HR Internal Notes
            </h3>
            <p className="text-xs text-neutral-500">
              Confidential observations, risk notes, succession considerations, or any institutional HR commentary on this employee. Not shared with the employee.
            </p>
            <textarea
              className="form-input min-h-[160px] resize-y"
              value={hrNote}
              onChange={(e) => setHrNote(e.target.value)}
              placeholder="Add confidential HR notes…"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveHrNote}
                disabled={savingHrNote}
                className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {savingHrNote ? "progress_activity" : "save"}
                </span>
                {savingHrNote ? "Saving…" : "Save notes"}
              </button>
              {hrNoteSaved && (
                <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Saved
                </span>
              )}
            </div>
          </div>

          {/* Pre-appraisal evidence summary */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-neutral-400">fact_check</span>
              Pre-appraisal Evidence Pack
            </h3>
            <p className="text-xs text-neutral-500">
              Summary of evidence indicators from linked modules. Use this to prepare for the formal appraisal review.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-500">Commendations</p>
                <p className="text-lg font-bold text-neutral-900">{file.commendation_count ?? 0}</p>
              </div>
              <div className="rounded-lg bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-500">Training hours (cycle)</p>
                <p className="text-lg font-bold text-neutral-900">{file.training_hours_current_cycle ?? 0}</p>
              </div>
              <div className="rounded-lg bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-500">Open dev. actions</p>
                <p className="text-lg font-bold text-neutral-900">{file.open_development_action_count ?? 0}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {file.active_warning_flag && (
                <span className="badge badge-danger">Active warning on file</span>
              )}
              <Link href="/hr/performance" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                View performance tracker →
              </Link>
            </div>
          </div>

          {/* File review log */}
          <div className="card p-4 space-y-2">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-neutral-400">history</span>
              File Review History
            </h3>
            <p className="text-sm text-neutral-600">
              Last file review: <strong>{file.last_file_review_date ? new Date(file.last_file_review_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</strong>
            </p>
            <p className="text-xs text-neutral-400">
              Periodic HR file reviews ensure records are complete and up to date.
            </p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {tab === "timeline" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">Add timeline event</h3>
            <form onSubmit={handleAddTimelineEvent} className="space-y-3 max-w-md">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Event type</label>
                <select className="form-input w-full py-2" value={eventType} onChange={(e) => setEventType(e.target.value)} required>
                  <option value="">Select…</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Title</label>
                <input type="text" className="form-input w-full" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Date</label>
                <input type="date" className="form-input w-full" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Description (optional)</label>
                <textarea className="form-input w-full min-h-[80px]" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} />
              </div>
              <button type="submit" disabled={addingEvent} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
                {addingEvent ? "Adding…" : "Add event"}
              </button>
            </form>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">Timeline</h3>
            {timelineEvents.length === 0 ? (
              <p className="text-sm text-neutral-500">No timeline events yet.</p>
            ) : (
              <ul className="space-y-3">
                {timelineEvents.map((ev) => (
                  <li key={ev.id} className="flex gap-4 border-l-2 border-neutral-200 pl-4 py-1">
                    <span className="text-xs text-neutral-500 whitespace-nowrap">{formatDate(ev.event_date)}</span>
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{ev.title}</p>
                      <p className="text-xs text-neutral-500">{ev.event_type}</p>
                      {ev.description && <p className="text-sm text-neutral-600 mt-1">{ev.description}</p>}
                      {ev.recorded_by && <p className="text-xs text-neutral-400 mt-1">Recorded by {ev.recorded_by.name}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Link href="/hr/files" className="text-sm font-semibold text-primary hover:underline">
          Back to HR Files
        </Link>
      </div>
    </div>
  );
}
