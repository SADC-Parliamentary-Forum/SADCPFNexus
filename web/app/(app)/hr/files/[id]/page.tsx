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
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const FILE_STATUS_LABELS: Record<string, string> = {
  active: "hr.files.fileStatus.active",
  probation: "hr.files.fileStatus.probation",
  suspended: "hr.files.fileStatus.suspended",
  separated: "hr.files.fileStatus.separated",
  archived: "hr.files.fileStatus.archived",
};

const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  permanent: "hr.files.employment.permanent",
  contract: "hr.files.employment.contract",
  secondment: "hr.files.employment.secondment",
  acting: "hr.files.employment.acting",
  probation: "hr.files.employment.probation",
  separated: "hr.files.employment.separated",
};

const PROBATION_STATUS_LABELS: Record<string, string> = {
  on_probation: "hr.files.probation.on_probation",
  confirmed: "hr.files.probation.confirmed",
  extended: "hr.files.probation.extended",
  terminated: "hr.files.probation.terminated",
  not_applicable: "hr.files.probation.not_applicable",
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

function formatDateIn(d: string | null, localeTag: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" });
}

type TabId = "summary" | "personal" | "employment" | "performance" | "conduct" | "qualifications" | "documents" | "timeline" | "hr_notes";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "summary", label: "hr.files.tab.summary", icon: "dashboard" },
  { id: "personal", label: "hr.files.tab.personal", icon: "person" },
  { id: "employment", label: "hr.files.tab.employment", icon: "work" },
  { id: "performance", label: "hr.files.tab.performance", icon: "trending_up" },
  { id: "conduct", label: "hr.files.tab.conduct", icon: "gavel" },
  { id: "qualifications", label: "hr.files.tab.qualifications", icon: "school" },
  { id: "documents", label: "hr.files.tab.documents", icon: "folder" },
  { id: "timeline", label: "hr.files.tab.timeline", icon: "timeline" },
  { id: "hr_notes", label: "hr.files.tab.hrNotes", icon: "lock" },
];

interface FileWithRelations extends HrPersonalFile {
  documents?: HrFileDocument[];
  timeline_events?: HrFileTimelineEvent[];
}

export default function HrFileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id != null ? Number(params.id) : NaN;
  const { confirm } = useConfirm();
  const toast = useToast();
  const { t, localeTag } = useI18n();
  const formatDate = (d: string | null) => formatDateIn(d, localeTag);
  const tv = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
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
      setError(t("hr.files.detail.loadFailed"));
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, [id, router, t]);

  const handleSaveHrNote = async () => {
    if (!file) return;
    setSavingHrNote(true);
    setHrNoteSaved(false);
    try {
      // hr_notes is an extended field sent to the API; cast to bypass strict TS check
      await hrFilesApi.update(file.id, { hr_notes: hrNote } as unknown as Partial<typeof file>);
      setHrNoteSaved(true);
      setTimeout(() => setHrNoteSaved(false), 3000);
      toast.success(t("hr.files.detail.notesSaved"));
    } catch (err) {
      setError(t("hr.files.detail.notesSaveFailed"));
      toast.error(t("hr.files.detail.notesNotSaved"), apiErrorMessage(err, t("hr.files.detail.notesSaveFailed")));
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
      toast.success(t("hr.files.detail.docAdded"));
      load();
    } catch (err) {
      setUploadError(t("hr.files.docs.addFailed"));
      toast.error(t("hr.files.detail.docNotAdded"), apiErrorMessage(err, t("hr.files.docs.addFailed")));
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
      toast.success(t("hr.files.detail.eventAdded"));
      load();
    } catch (err) {
      toast.error(t("hr.files.detail.eventNotAdded"), apiErrorMessage(err, t("hr.files.detail.eventAddFailed")));
    } finally {
      setAddingEvent(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (
      !file ||
      !(await confirm({
        title: t("hr.files.detail.deleteDocTitle"),
        message: t("hr.files.detail.deleteDocMessage"),
        variant: "danger",
      }))
    ) return;
    try {
      await hrFilesApi.deleteDocument(file.id, docId);
      toast.success(t("hr.files.detail.docDeleted"));
      load();
    } catch (err) {
      setError(t("hr.files.docs.deleteFailed"));
      toast.error(t("hr.files.detail.docNotDeleted"), apiErrorMessage(err, t("hr.files.docs.deleteFailed")));
    }
  };

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <div className="flex items-center justify-center py-20 text-neutral-500">
          <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
          <span className="ml-2">{t("hr.files.detail.loading")}</span>
        </div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? t("hr.files.detail.notFound")}
        </div>
        <Link href="/hr/files" className="btn-secondary text-sm">
          {t("hr.files.detail.back")}
        </Link>
      </div>
    );
  }

  const employeeName = file.employee?.name ?? t("hr.files.detail.employeeNumber", { id: file.employee_id });
  const documents = file.documents ?? [];
  const timelineEvents = (file.timeline_events ?? []).sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={employeeName}
        subtitle={`${file.current_position ?? "—"} · ${file.department?.name ?? "—"}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "hr.files.detail.crumb", href: "/hr/files" },
              { label: employeeName },
            ]}
          />
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200 overflow-x-auto">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === tb.id ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tb.icon}</span>
            {t(tb.label)}
          </button>
        ))}
      </div>

      {/* Summary */}
      {tab === "summary" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap gap-2">
            <span className={`badge ${file.file_status === "active" ? "badge-success" : "badge-muted"}`}>
              {FILE_STATUS_LABELS[file.file_status] ? t(FILE_STATUS_LABELS[file.file_status]) : file.file_status}
            </span>
            <span className="badge badge-muted">
              {EMPLOYMENT_STATUS_LABELS[file.employment_status] ? t(EMPLOYMENT_STATUS_LABELS[file.employment_status]) : file.employment_status}
            </span>
            <span className="badge badge-muted">
              {PROBATION_STATUS_LABELS[file.probation_status] ? t(PROBATION_STATUS_LABELS[file.probation_status]) : file.probation_status}
            </span>
            {file.active_warning_flag && <span className="badge badge-danger">{t("hr.files.detail.activeWarning")}</span>}
          </div>
          <div className="card p-4 grid gap-3 sm:grid-cols-2">
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.appointment")}</span><br />{formatDate(file.appointment_date)}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.contractType")}</span><br />{file.contract_type ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.grade")}</span><br />{file.grade_scale ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.contractExpiry")}</span><br />{formatDate(file.contract_expiry_date)}</p>
          </div>
          {file.latest_appraisal_summary && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">{t("hr.files.detail.latestAppraisal")}</h3>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{file.latest_appraisal_summary}</p>
            </div>
          )}
          <div className="card p-4 flex flex-wrap gap-4">
            <p>{t("hr.files.detail.commendationsLabel")} <strong>{file.commendation_count}</strong></p>
            <p>{t("hr.files.detail.openActionsLabel")} <strong>{file.open_development_action_count}</strong></p>
            <p>{t("hr.files.detail.trainingHoursLabel")} <strong>{file.training_hours_current_cycle}</strong></p>
          </div>
          {timelineEvents.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">{t("hr.files.detail.recentTimeline")}</h3>
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
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.staffNumber")}</span><br />{file.staff_number ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.dob")}</span><br />{formatDate(file.date_of_birth)}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.gender")}</span><br />{file.gender ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.nationality")}</span><br />{file.nationality ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.idPassport")}</span><br />{file.id_passport_number ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.marital")}</span><br />{file.marital_status ?? "—"}</p>
          </div>
          <div>
            <span className="text-xs text-neutral-500">{t("hr.files.detail.address")}</span>
            <p className="text-sm text-neutral-900 mt-1">{file.residential_address ?? "—"}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.emergencyContact")}</span><br />{file.emergency_contact_name ?? "—"} {file.emergency_contact_relationship && `(${file.emergency_contact_relationship})`}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.emergencyPhone")}</span><br />{file.emergency_contact_phone ?? "—"}</p>
          </div>
          {file.next_of_kin_details && (
            <div>
              <span className="text-xs text-neutral-500">{t("hr.files.detail.nextOfKin")}</span>
              <p className="text-sm text-neutral-900 mt-1">{file.next_of_kin_details}</p>
            </div>
          )}
        </div>
      )}

      {/* Employment */}
      {tab === "employment" && (
        <div className="card p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.appointmentDate")}</span><br />{formatDate(file.appointment_date)}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.confirmationDate")}</span><br />{formatDate(file.confirmation_date)}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.contractType")}</span><br />{file.contract_type ?? "—"}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.contractExpiry")}</span><br />{formatDate(file.contract_expiry_date)}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.separationDate")}</span><br />{formatDate(file.separation_date)}</p>
            <p><span className="text-xs text-neutral-500">{t("hr.files.detail.separationReason")}</span><br />{file.separation_reason ?? "—"}</p>
          </div>
          {file.promotion_history && Array.isArray(file.promotion_history) && file.promotion_history.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">{t("hr.files.detail.promotionHistory")}</h3>
              <ul className="list-disc list-inside text-sm text-neutral-700 space-y-1">
                {file.promotion_history.map((p: { date?: string; from_position?: string; to_position?: string }, i: number) => (
                  <li key={i}>{formatDate(p.date ?? null)} – {p.from_position} → {p.to_position}</li>
                ))}
              </ul>
            </div>
          )}
          {file.transfer_history && Array.isArray(file.transfer_history) && file.transfer_history.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">{t("hr.files.detail.transferHistory")}</h3>
              <ul className="list-disc list-inside text-sm text-neutral-700 space-y-1">
                {file.transfer_history.map((tr: { date?: string; from_dept?: string; to_dept?: string }, i: number) => (
                  <li key={i}>{formatDate(tr.date ?? null)} – {tr.from_dept} → {tr.to_dept}</li>
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
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">{t("hr.files.detail.latestAppraisal")}</h3>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{file.latest_appraisal_summary}</p>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">{t("hr.files.detail.noAppraisal")}</p>
          )}
          <p className="text-sm text-neutral-600">
            {t("hr.files.detail.openActionsLabel")} <strong>{file.open_development_action_count}</strong> · {t("hr.files.detail.trainingThisCycleLabel")} <strong>{file.training_hours_current_cycle}</strong>
          </p>
          <Link href="/hr/performance" className="btn-secondary text-sm">
            {t("hr.files.detail.viewTracker")}
          </Link>
        </div>
      )}

      {/* Conduct & recognition */}
      {tab === "conduct" && (
        <div className="card p-4 space-y-4">
          <div className="flex flex-wrap gap-4">
            <p>{t("hr.files.detail.commendationsLabel")} <strong>{file.commendation_count}</strong></p>
            <p>{t("hr.files.detail.activeWarningLabel")} <strong>{file.active_warning_flag ? t("hr.files.detail.yes") : t("hr.files.detail.no")}</strong></p>
          </div>
          <p className="text-sm text-neutral-500">{t("hr.files.detail.conductHint")}</p>
        </div>
      )}

      {/* Documents */}
      {tab === "documents" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">{t("hr.files.detail.addDocRecord")}</h3>
            {uploadError && <p className="text-sm text-red-600 mb-2">{uploadError}</p>}
            <form onSubmit={handleUploadDocument} className="flex flex-wrap gap-3 items-end">
              <div>
                <label htmlFor="hr-files-detail-type" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.files.detail.type")}</label>
                <select id="hr-files-detail-type" className="form-input py-2 text-sm min-w-[160px]" value={docType} onChange={(e) => setDocType(e.target.value)} required>
                  <option value="">{t("hr.files.detail.select")}</option>
                  {DOCUMENT_TYPES.map((dt) => (
                    <option key={dt} value={dt}>{t(`hr.files.detailDocType.${dt}`)}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="hr-files-detail-title" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.files.detail.title")}</label>
                <input id="hr-files-detail-title" type="text" className="form-input w-full" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder={t("hr.files.detail.docTitlePlaceholder")} required />
              </div>
              <button type="submit" disabled={uploading} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
                {uploading ? t("hr.files.detail.adding") : t("hr.files.detail.add")}
              </button>
            </form>
          </div>
          <div className="card overflow-hidden">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-neutral-900">{t("hr.files.detail.vault")}</h3>
            </div>
            {documents.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">{t("hr.files.detail.noDocs")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("hr.files.detail.type")}</th>
                      <th>{t("hr.files.detail.title")}</th>
                      <th>{t("hr.files.detail.issueDate")}</th>
                      <th>{t("hr.files.detail.expiry")}</th>
                      <th>{t("hr.files.detail.confidentiality")}</th>
                      <th>{t("hr.files.detail.uploadedBy")}</th>
                      <th className="text-right">{t("hr.files.detail.action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="text-sm">{tv(`hr.files.detailDocType.${doc.document_type}`, doc.document_type)}</td>
                        <td className="font-medium text-neutral-900">{doc.title}</td>
                        <td className="text-sm text-neutral-600">{formatDate(doc.issue_date)}</td>
                        <td className="text-sm text-neutral-600">{formatDate(doc.expiry_date)}</td>
                        <td className="text-sm">{tv(`hr.files.confidentiality.${doc.confidentiality_level}`, doc.confidentiality_level)}</td>
                        <td className="text-sm text-neutral-600">{doc.uploaded_by?.name ?? "—"}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="btn-secondary text-xs text-red-600"
                          >
                            {t("common.delete")}
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
              {t("hr.files.detail.qualifications")}
            </h3>
            {(file as unknown as Record<string, unknown>).academic_qualifications ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                {(file as unknown as Record<string, unknown>).academic_qualifications as string}
              </p>
            ) : (
              <p className="text-sm text-neutral-400 italic">{t("hr.files.detail.noQualifications")}</p>
            )}
          </div>

          {/* Professional certifications */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-primary">workspace_premium</span>
              </div>
              {t("hr.files.detail.certifications")}
            </h3>
            {(file as unknown as Record<string, unknown>).certifications ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                {(file as unknown as Record<string, unknown>).certifications as string}
              </p>
            ) : (
              <p className="text-sm text-neutral-400 italic">{t("hr.files.detail.noCertifications")}</p>
            )}
          </div>

          {/* Training history */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-green-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-green-600">fitness_center</span>
              </div>
              {t("hr.files.detail.training")}
            </h3>
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="rounded-lg bg-neutral-50 px-4 py-3 min-w-[120px]">
                <p className="text-xs text-neutral-500">{t("hr.files.detail.trainingHours")}</p>
                <p className="text-lg font-bold text-neutral-900">{file.training_hours_current_cycle ?? 0}</p>
              </div>
              <div className="rounded-lg bg-neutral-50 px-4 py-3 min-w-[120px]">
                <p className="text-xs text-neutral-500">{t("hr.files.detail.openActions")}</p>
                <p className="text-lg font-bold text-neutral-900">{file.open_development_action_count ?? 0}</p>
              </div>
            </div>
            {(file as unknown as Record<string, unknown>).training_history ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                {(file as unknown as Record<string, unknown>).training_history as string}
              </p>
            ) : (
              <p className="text-sm text-neutral-400 italic">{t("hr.files.detail.noTraining")}</p>
            )}
          </div>

          {/* Competency gaps & succession */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-amber-600">target</span>
              </div>
              {t("hr.files.detail.competency")}
            </h3>
            {(file as unknown as Record<string, unknown>).competency_gaps ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                {(file as unknown as Record<string, unknown>).competency_gaps as string}
              </p>
            ) : (
              <p className="text-sm text-neutral-400 italic">{t("hr.files.detail.noCompetency")}</p>
            )}
          </div>

          {/* Link to performance tracker */}
          <div className="flex items-center gap-3">
            <Link href="/hr/performance" className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
              {t("hr.files.detail.viewTracker")}
            </Link>
            <Link href="/hr/appraisals" className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm">
              <span className="material-symbols-outlined text-[18px]">rate_review</span>
              {t("hr.files.detail.viewAppraisals")}
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
              <strong>{t("hr.files.detail.restricted")}</strong> {t("hr.files.detail.restrictedHint")}
            </p>
          </div>

          {/* HR narrative notes */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-neutral-400">sticky_note_2</span>
              {t("hr.files.detail.internalNotes")}
            </h3>
            <p className="text-xs text-neutral-500">
              {t("hr.files.detail.internalNotesHint")}
            </p>
            <textarea
              className="form-input min-h-[160px] resize-y"
              value={hrNote}
              onChange={(e) => setHrNote(e.target.value)}
              placeholder={t("hr.files.detail.notesPlaceholder")}
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
                {savingHrNote ? t("hr.files.detail.saving") : t("hr.files.detail.saveNotes")}
              </button>
              {hrNoteSaved && (
                <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  {t("hr.files.detail.saved")}
                </span>
              )}
            </div>
          </div>

          {/* Pre-appraisal evidence summary */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-neutral-400">fact_check</span>
              {t("hr.files.detail.evidencePack")}
            </h3>
            <p className="text-xs text-neutral-500">
              {t("hr.files.detail.evidenceHint")}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-500">{t("hr.files.detail.commendations")}</p>
                <p className="text-lg font-bold text-neutral-900">{file.commendation_count ?? 0}</p>
              </div>
              <div className="rounded-lg bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-500">{t("hr.files.detail.trainingHours")}</p>
                <p className="text-lg font-bold text-neutral-900">{file.training_hours_current_cycle ?? 0}</p>
              </div>
              <div className="rounded-lg bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-500">{t("hr.files.detail.openActions")}</p>
                <p className="text-lg font-bold text-neutral-900">{file.open_development_action_count ?? 0}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {file.active_warning_flag && (
                <span className="badge badge-danger">{t("hr.files.detail.activeWarningOnFile")}</span>
              )}
              <Link href="/hr/performance" className="btn-secondary text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                {t("hr.files.detail.viewTrackerLower")}
              </Link>
            </div>
          </div>

          {/* File review log */}
          <div className="card p-4 space-y-2">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-neutral-400">history</span>
              {t("hr.files.detail.reviewHistory")}
            </h3>
            <p className="text-sm text-neutral-600">
              {t("hr.files.detail.lastReview")} <strong>{file.last_file_review_date ? new Date(file.last_file_review_date).toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" }) : "—"}</strong>
            </p>
            <p className="text-xs text-neutral-400">
              {t("hr.files.detail.reviewHint")}
            </p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {tab === "timeline" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">{t("hr.files.detail.addEvent")}</h3>
            <form onSubmit={handleAddTimelineEvent} className="space-y-3 max-w-md">
              <div>
                <label htmlFor="hr-files-detail-event-type" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.files.detail.eventType")}</label>
                <select id="hr-files-detail-event-type" className="form-input w-full py-2" value={eventType} onChange={(e) => setEventType(e.target.value)} required>
                  <option value="">{t("hr.files.detail.select")}</option>
                  {EVENT_TYPES.map((et) => (
                    <option key={et} value={et}>{t(`hr.files.eventType.${et}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="hr-files-detail-title-2" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.files.detail.title")}</label>
                <input id="hr-files-detail-title-2" type="text" className="form-input w-full" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="hr-files-detail-date" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.files.detail.date")}</label>
                <input id="hr-files-detail-date" type="date" className="form-input w-full" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="hr-files-detail-description-optional" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.files.detail.descriptionOptional")}</label>
                <textarea id="hr-files-detail-description-optional" className="form-input w-full min-h-[80px]" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} />
              </div>
              <button type="submit" disabled={addingEvent} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
                {addingEvent ? t("hr.files.detail.adding") : t("hr.files.detail.addEventButton")}
              </button>
            </form>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">{t("hr.files.detail.timeline")}</h3>
            {timelineEvents.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("hr.files.detail.noEvents")}</p>
            ) : (
              <ul className="space-y-3">
                {timelineEvents.map((ev) => (
                  <li key={ev.id} className="flex gap-4 border-l-2 border-neutral-200 pl-4 py-1">
                    <span className="text-xs text-neutral-500 whitespace-nowrap">{formatDate(ev.event_date)}</span>
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{ev.title}</p>
                      <p className="text-xs text-neutral-500">{tv(`hr.files.eventType.${ev.event_type}`, ev.event_type)}</p>
                      {ev.description && <p className="text-sm text-neutral-600 mt-1">{ev.description}</p>}
                      {ev.recorded_by && <p className="text-xs text-neutral-400 mt-1">{t("hr.files.detail.recordedBy", { name: ev.recorded_by.name })}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Link href="/hr/files" className="btn-secondary text-sm">
          {t("hr.files.detail.back")}
        </Link>
      </div>
    </div>
  );
}
