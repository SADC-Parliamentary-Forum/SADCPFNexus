"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  appraisalApi,
  appraisalAttachmentsApi,
  type Appraisal,
  type AppraisalEvidenceLink,
  type AppraisalAttachment,
} from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { safeExternalUrl } from "@/lib/safeExternalUrl";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ─── Constants ────────────────────────────────────────────────────────────────

const PERFORMANCE_FACTORS = [
  "Mastery of Skills and Knowledge of the Job",
  "Quality of Work",
  "Volume of Work",
  "Timeliness of Output/Efficiency",
  "Commitment",
  "Innovativeness/Resourcefulness",
  "Attitude and Approach to Work",
  "Teamwork",
  "Communication/Intercultural Competence",
  "Respect for Organizational and Ethical Values",
  "Leadership and Managerial Qualities",
] as const;

const RATING_OPTIONS = ["Excellent", "Good", "Average", "Below Average", "Poor"] as const;
type RatingOption = (typeof RATING_OPTIONS)[number];

const RATING_POINTS: Record<RatingOption, number> = {
  Excellent: 10,
  Good: 8,
  Average: 6,
  "Below Average": 1,
  Poor: 0,
};

const RATING_KEYS: Record<string, string> = {
  Excellent: "hr.appraisals.rating.excellent",
  Good: "hr.appraisals.rating.good",
  Average: "hr.appraisals.rating.average",
  "Below Average": "hr.appraisals.rating.belowAverage",
  Poor: "hr.appraisals.rating.poor",
};

/** Catalog key for a stored factor name (the English name is what is saved). */
function factorKey(factor: string): string {
  const i = (PERFORMANCE_FACTORS as readonly string[]).indexOf(factor);
  return i >= 0 ? `hr.appraisals.factor.${i}` : factor;
}

const RATING_CLS: Record<string, string> = {
  Excellent: "bg-green-100 text-green-800 border-green-200",
  Good: "bg-primary/10 text-primary border-primary/20",
  Average: "bg-neutral-100 text-neutral-700 border-neutral-200",
  "Below Average": "bg-amber-100 text-amber-800 border-amber-200",
  Poor: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "hr.appraisals.detail.status.draft",
  employee_submitted: "hr.appraisals.detail.status.employee_submitted",
  supervisor_reviewed: "hr.appraisals.detail.status.supervisor_reviewed",
  hod_reviewed: "hr.appraisals.detail.status.hod_reviewed",
  hr_reviewed: "hr.appraisals.detail.status.hr_reviewed",
  finalized: "hr.appraisals.status.finalized",
};

const STATUS_CLS: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-700 border-neutral-200",
  employee_submitted: "bg-amber-100 text-amber-800 border-amber-200",
  supervisor_reviewed: "bg-blue-100 text-blue-800 border-blue-200",
  hod_reviewed: "bg-indigo-100 text-indigo-800 border-indigo-200",
  hr_reviewed: "bg-teal-100 text-teal-800 border-teal-200",
  finalized: "bg-green-100 text-green-800 border-green-200",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Structured data interfaces ───────────────────────────────────────────────

interface Achievement {
  category: string;
  description: string;
}

interface SelfAssessmentData {
  achievements: Achievement[];
  outputs_not_achieved: string;
  outside_assignments: string;
  resources: string;
  factor_ratings: Record<string, string>;
  general_comments: string;
  section4_comments: string;
  section6_comments: string;
  section9_comments: string;
}

interface FactorRatingEntry {
  rating: string;
  comment: string;
}

interface SupervisorAssessmentData {
  factor_ratings: Record<string, FactorRatingEntry>;
  promotion: boolean;
  merit_increase: boolean;
  confirmation: boolean;
  demotion: boolean;
  other_action: string;
  scope_changes: string;
  skills_knowledge: string;
  developmental_actions: string;
  career_development: string;
  supplemental_review: string;
}

interface HodAssessmentData {
  recommendation: string;
  comments: string;
}

function parseSelfAssessment(raw: string | null | undefined): SelfAssessmentData {
  const defaults: SelfAssessmentData = {
    achievements: [{ category: "", description: "" }],
    outputs_not_achieved: "",
    outside_assignments: "",
    resources: "",
    factor_ratings: {},
    general_comments: "",
    section4_comments: "",
    section6_comments: "",
    section9_comments: "",
  };
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<SelfAssessmentData>;
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults, general_comments: raw };
  }
}

function parseSupervisorAssessment(raw: string | null | undefined): SupervisorAssessmentData {
  const defaults: SupervisorAssessmentData = {
    factor_ratings: {},
    promotion: false,
    merit_increase: false,
    confirmation: false,
    demotion: false,
    other_action: "",
    scope_changes: "",
    skills_knowledge: "",
    developmental_actions: "",
    career_development: "",
    supplemental_review: "",
  };
  if (!raw) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(raw) as Partial<SupervisorAssessmentData>) };
  } catch {
    return { ...defaults, supplemental_review: raw };
  }
}

function parseHodAssessment(raw: string | null | undefined): HodAssessmentData {
  const defaults: HodAssessmentData = { recommendation: "", comments: "" };
  if (!raw) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(raw) as Partial<HodAssessmentData>) };
  } catch {
    return { ...defaults, comments: raw };
  }
}

function computeOverallRating(ratings: Record<string, string>): number {
  const vals = Object.values(ratings)
    .filter(Boolean)
    .map((r) => RATING_POINTS[r as RatingOption] ?? 0);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  number,
  title,
  subtitle,
  badge,
}: {
  number: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">{t(title)}</h2>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{t(subtitle)}</p>}
      </div>
    </div>
  );
}

function CompletedBadge() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
      <span className="material-symbols-outlined text-[12px]">check_circle</span>
      {t("hr.appraisals.detail.submitted")}
    </span>
  );
}

function RatingPill({ rating }: { rating: string }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${RATING_CLS[rating] ?? "bg-neutral-100 text-neutral-700 border-neutral-200"}`}>
      {RATING_KEYS[rating] ? t(RATING_KEYS[rating]) : rating}
    </span>
  );
}

function RatingRadioRow({
  factor,
  index,
  value,
  onChange,
  disabled,
}: {
  factor: string;
  index: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="py-2 pr-3 text-sm text-neutral-800 w-8 text-center font-medium text-neutral-400">{index + 1}</td>
      <td className="py-2 pr-4 text-sm text-neutral-800">{t(factorKey(factor))}</td>
      {RATING_OPTIONS.map((opt) => (
        <td key={opt} className="py-2 text-center w-24">
          {disabled ? (
            value === opt ? <RatingPill rating={opt} /> : null
          ) : (
            <label htmlFor={`hr-appraisal-rating-${index}-${opt}`} className="flex items-center justify-center cursor-pointer">
              <input id={`hr-appraisal-rating-${index}-${opt}`}
                type="radio"
                name={`factor-${index}`}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="sr-only"
              />
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  value === opt
                    ? "border-primary bg-primary"
                    : "border-neutral-300 hover:border-primary/50"
                }`}
              >
                {value === opt && <span className="w-2 h-2 rounded-full bg-white" />}
              </span>
            </label>
          )}
        </td>
      ))}
    </tr>
  );
}

function SupervisorRatingRow({
  factor,
  index,
  rating,
  comment,
  onRatingChange,
  onCommentChange,
  disabled,
}: {
  factor: string;
  index: number;
  rating: string;
  comment: string;
  onRatingChange: (v: string) => void;
  onCommentChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <tr className="border-b border-neutral-100 last:border-0 align-top">
      <td className="py-2 pr-2 text-sm text-neutral-400 font-medium text-center w-8">{index + 1}</td>
      <td className="py-2 pr-3 text-sm text-neutral-800 min-w-[180px]">{t(factorKey(factor))}</td>
      <td className="py-2 pr-3 w-36">
        {disabled ? (
          rating ? <RatingPill rating={rating} /> : <span className="text-neutral-400 text-xs">—</span>
        ) : (
          <select
            className="form-input w-full text-xs py-1"
            value={rating}
            onChange={(e) => onRatingChange(e.target.value)}
          >
            <option value="">{t("hr.appraisals.detail.select")}</option>
            {RATING_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{t(RATING_KEYS[opt])}</option>
            ))}
          </select>
        )}
      </td>
      <td className="py-2 text-sm text-neutral-700">
        {disabled ? (
          <span className="text-neutral-600 text-xs">{comment || "—"}</span>
        ) : (
          <input
            type="text"
            className="form-input w-full text-xs py-1"
            placeholder={t("hr.appraisals.detail.commentOptional")}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
          />
        )}
      </td>
    </tr>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AppraisalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const id = params?.id != null ? Number(params.id) : NaN;

  const [appraisal, setAppraisal] = useState<Appraisal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Section 2 — employee
  const [achievements, setAchievements] = useState<Achievement[]>([{ category: "", description: "" }]);
  const [outputsNotAchieved, setOutputsNotAchieved] = useState("");
  const [outsideAssignments, setOutsideAssignments] = useState("");
  const [resources, setResources] = useState("");
  const [factorRatings, setFactorRatings] = useState<Record<string, string>>({});
  const [generalComments, setGeneralComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Section 3 — supervisor
  const [svFactorRatings, setSvFactorRatings] = useState<Record<string, FactorRatingEntry>>({});
  const [svPromotion, setSvPromotion] = useState(false);
  const [svMerit, setSvMerit] = useState(false);
  const [svConfirmation, setSvConfirmation] = useState(false);
  const [svDemotion, setSvDemotion] = useState(false);
  const [svOtherAction, setSvOtherAction] = useState("");
  const [svScopeChanges, setSvScopeChanges] = useState("");
  const [svSkillsKnowledge, setSvSkillsKnowledge] = useState("");
  const [svDevActions, setSvDevActions] = useState("");
  const [svCareer, setSvCareer] = useState("");
  const [svSupplemental, setSvSupplemental] = useState("");
  const [svSubmitting, setSvSubmitting] = useState(false);

  // Section 4 — employee comments on supervisor
  const [section4Comments, setSection4Comments] = useState("");
  const [section4Saving, setSection4Saving] = useState(false);

  // Section 5 — HOD
  const [hodRecommendation, setHodRecommendation] = useState("");
  const [hodComments, setHodComments] = useState("");
  const [hodSubmitting, setHodSubmitting] = useState(false);

  // Section 6 — employee comments on HOD
  const [section6Comments, setSection6Comments] = useState("");
  const [section6Saving, setSection6Saving] = useState(false);

  // Sections 7/8 — HR/SG
  const [hrComments, setHrComments] = useState("");
  const [sgDecision, setSgDecision] = useState("");
  const [finalOverallRating, setFinalOverallRating] = useState<string>("");
  const [finalOverallLabel, setFinalOverallLabel] = useState("");
  const [developmentPlan, setDevelopmentPlan] = useState("");
  const [finalSubmitting, setFinalSubmitting] = useState(false);

  // Section 9 — final acknowledgment
  const [section9Comments, setSection9Comments] = useState("");
  const [acknowledging, setAcknowledging] = useState(false);

  // Evidence
  const [evidenceLinks, setEvidenceLinks] = useState<AppraisalEvidenceLink[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [attachments, setAttachments] = useState<AppraisalAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) { router.replace("/hr/appraisals"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await appraisalApi.get(id);
      const data = res.data;
      setAppraisal(data);

      const sa = parseSelfAssessment(data.self_assessment);
      setAchievements(sa.achievements?.length ? sa.achievements : [{ category: "", description: "" }]);
      setOutputsNotAchieved(sa.outputs_not_achieved ?? "");
      setOutsideAssignments(sa.outside_assignments ?? "");
      setResources(sa.resources ?? "");
      setFactorRatings(sa.factor_ratings ?? {});
      setGeneralComments(sa.general_comments ?? "");
      setSection4Comments(sa.section4_comments ?? "");
      setSection6Comments(sa.section6_comments ?? "");
      setSection9Comments(sa.section9_comments ?? "");

      const sv = parseSupervisorAssessment(data.supervisor_comments);
      setSvFactorRatings(sv.factor_ratings ?? {});
      setSvPromotion(sv.promotion ?? false);
      setSvMerit(sv.merit_increase ?? false);
      setSvConfirmation(sv.confirmation ?? false);
      setSvDemotion(sv.demotion ?? false);
      setSvOtherAction(sv.other_action ?? "");
      setSvScopeChanges(sv.scope_changes ?? "");
      setSvSkillsKnowledge(sv.skills_knowledge ?? "");
      setSvDevActions(sv.developmental_actions ?? "");
      setSvCareer(sv.career_development ?? "");
      setSvSupplemental(sv.supplemental_review ?? "");

      const hod = parseHodAssessment(data.hod_comments);
      setHodRecommendation(hod.recommendation ?? "");
      setHodComments(hod.comments ?? "");

      setHrComments(data.hr_comments ?? "");
      setSgDecision(data.sg_decision ?? "");
      setFinalOverallRating(data.overall_rating != null ? String(data.overall_rating) : "");
      setFinalOverallLabel(data.overall_rating_label ?? "");
      setDevelopmentPlan(data.development_plan ?? "");

      setEvidenceLinks(Array.isArray(data.evidence_links) ? data.evidence_links : []);
      setAttachments(data.attachments ?? []);
    } catch {
      setError(t("hr.appraisals.detail.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, router, t]);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUserId(user?.id ?? null);
    load();
  }, [load]);

  // ─── Submit handlers ──────────────────────────────────────────────────────────

  const handleSubmitSection2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appraisal) return;
    setError(null);
    setSubmitting(true);
    try {
      const saData: SelfAssessmentData = {
        achievements,
        outputs_not_achieved: outputsNotAchieved,
        outside_assignments: outsideAssignments,
        resources,
        factor_ratings: factorRatings,
        general_comments: generalComments,
        section4_comments: section4Comments,
        section6_comments: section6Comments,
        section9_comments: section9Comments,
      };
      const overallRating = computeOverallRating(factorRatings) || 3;
      await appraisalApi.submitSelfAssessment(appraisal.id, {
        self_assessment: JSON.stringify(saData),
        self_overall_rating: overallRating,
        evidence_links: evidenceLinks.length ? evidenceLinks : undefined,
      });
      toast.success(t("hr.appraisals.detail.toast.selfSubmitted"));
      load();
    } catch (err: unknown) {
      toast.error(t("hr.appraisals.detail.toast.selfNotSubmitted"), apiErrorMessage(err, t("hr.appraisals.detail.toast.selfFailed")));
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("hr.appraisals.detail.toast.selfFailed")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSection3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appraisal) return;
    setError(null);
    setSvSubmitting(true);
    try {
      const svData: SupervisorAssessmentData = {
        factor_ratings: svFactorRatings,
        promotion: svPromotion,
        merit_increase: svMerit,
        confirmation: svConfirmation,
        demotion: svDemotion,
        other_action: svOtherAction,
        scope_changes: svScopeChanges,
        skills_knowledge: svSkillsKnowledge,
        developmental_actions: svDevActions,
        career_development: svCareer,
        supplemental_review: svSupplemental,
      };
      const svOverallRating = computeOverallRating(
        Object.fromEntries(Object.entries(svFactorRatings).map(([k, v]) => [k, v.rating]))
      ) || 3;
      await appraisalApi.supervisorReview(appraisal.id, {
        supervisor_comments: JSON.stringify(svData),
        supervisor_rating: svOverallRating,
      });
      toast.success(t("hr.appraisals.detail.toast.svSubmitted"));
      load();
    } catch (err: unknown) {
      toast.error(t("hr.appraisals.detail.toast.svNotSubmitted"), apiErrorMessage(err, t("hr.appraisals.detail.toast.svFailed")));
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("hr.appraisals.detail.toast.svFailed")
      );
    } finally {
      setSvSubmitting(false);
    }
  };

  const handleSaveSection4 = async () => {
    if (!appraisal) return;
    setSection4Saving(true);
    try {
      const saData = parseSelfAssessment(appraisal.self_assessment);
      saData.section4_comments = section4Comments;
      await appraisalApi.update(appraisal.id, {
        self_assessment: JSON.stringify(saData),
        evidence_links: Array.isArray(appraisal.evidence_links) ? appraisal.evidence_links : [],
      });
      toast.success(t("hr.appraisals.detail.toast.commentsSaved"));
      load();
    } catch (err) {
      setError(t("hr.appraisals.detail.toast.commentsFailed"));
      toast.error(t("hr.appraisals.detail.toast.commentsNotSaved"), apiErrorMessage(err, t("hr.appraisals.detail.toast.commentsFailed")));
    }
    finally { setSection4Saving(false); }
  };

  const handleSubmitSection5 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appraisal) return;
    setError(null);
    setHodSubmitting(true);
    try {
      const hodData: HodAssessmentData = { recommendation: hodRecommendation, comments: hodComments };
      const hodRating = appraisal.supervisor_rating ?? 3;
      await appraisalApi.hodReview(appraisal.id, {
        hod_comments: JSON.stringify(hodData),
        hod_rating: hodRating,
      });
      toast.success(t("hr.appraisals.detail.toast.hodSubmitted"));
      load();
    } catch (err: unknown) {
      toast.error(t("hr.appraisals.detail.toast.hodNotSubmitted"), apiErrorMessage(err, t("hr.appraisals.detail.toast.hodFailed")));
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("hr.appraisals.detail.toast.hodFailed")
      );
    } finally {
      setHodSubmitting(false);
    }
  };

  const handleSaveSection6 = async () => {
    if (!appraisal) return;
    setSection6Saving(true);
    try {
      const saData = parseSelfAssessment(appraisal.self_assessment);
      saData.section6_comments = section6Comments;
      await appraisalApi.update(appraisal.id, {
        self_assessment: JSON.stringify(saData),
        evidence_links: Array.isArray(appraisal.evidence_links) ? appraisal.evidence_links : [],
      });
      toast.success(t("hr.appraisals.detail.toast.commentsSaved"));
      load();
    } catch (err) {
      setError(t("hr.appraisals.detail.toast.commentsFailed"));
      toast.error(t("hr.appraisals.detail.toast.commentsNotSaved"), apiErrorMessage(err, t("hr.appraisals.detail.toast.commentsFailed")));
    }
    finally { setSection6Saving(false); }
  };

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appraisal) return;
    setError(null);
    setFinalSubmitting(true);
    try {
      const computedRating = computeOverallRating(
        Object.fromEntries(Object.entries(svFactorRatings).map(([k, v]) => [k, v.rating]))
      );
      await appraisalApi.finalize(appraisal.id, {
        overall_rating: finalOverallRating ? Number(finalOverallRating) : computedRating,
        overall_rating_label: finalOverallLabel,
        hr_comments: hrComments || undefined,
        development_plan: developmentPlan || undefined,
        sg_decision: sgDecision || undefined,
      });
      toast.success(t("hr.appraisals.detail.toast.finalised"));
      load();
    } catch (err: unknown) {
      toast.error(t("hr.appraisals.detail.toast.notFinalised"), apiErrorMessage(err, t("hr.appraisals.detail.toast.finaliseFailed")));
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("hr.appraisals.detail.toast.finaliseFailed")
      );
    } finally {
      setFinalSubmitting(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!appraisal) return;
    setAcknowledging(true);
    try {
      if (section9Comments) {
        const saData = parseSelfAssessment(appraisal.self_assessment);
        saData.section9_comments = section9Comments;
        await appraisalApi.update(appraisal.id, {
          self_assessment: JSON.stringify(saData),
          evidence_links: Array.isArray(appraisal.evidence_links) ? appraisal.evidence_links : [],
        });
      }
      await appraisalApi.acknowledge(appraisal.id);
      toast.success(t("hr.appraisals.detail.toast.acknowledged"));
      load();
    } catch (err) {
      setError(t("hr.appraisals.detail.toast.ackFailed"));
      toast.error(t("hr.appraisals.detail.toast.notAcknowledged"), apiErrorMessage(err, t("hr.appraisals.detail.toast.ackFailed")));
    }
    finally { setAcknowledging(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!appraisal || !e.target.files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        await appraisalAttachmentsApi.upload(appraisal.id, file);
      }
      const listRes = await appraisalAttachmentsApi.list(appraisal.id);
      setAttachments(listRes.data?.data ?? []);
      toast.success(t("hr.appraisals.detail.toast.uploaded"));
    } catch (err) {
      setError(t("hr.appraisals.detail.toast.uploadFailedDetail"));
      toast.error(t("hr.appraisals.detail.toast.uploadFailed"), apiErrorMessage(err, t("hr.appraisals.detail.toast.uploadFailedDetail")));
    }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!appraisal) return;
    try {
      await appraisalAttachmentsApi.delete(appraisal.id, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success(t("hr.appraisals.detail.toast.attachmentDeleted"));
    } catch (err) {
      setError(t("hr.appraisals.detail.toast.attachmentDeleteFailed"));
      toast.error(t("hr.appraisals.detail.toast.attachmentNotDeleted"), apiErrorMessage(err, t("hr.appraisals.detail.toast.attachmentDeleteFailed")));
    }
  };

  const handleDownloadAttachment = async (a: AppraisalAttachment) => {
    if (!appraisal) return;
    try {
      const blob = await appraisalAttachmentsApi.downloadBlob(appraisal.id, a.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = a.original_filename; link.click();
      URL.revokeObjectURL(url);
    } catch { setError(t("hr.appraisals.detail.toast.downloadFailed")); }
  };

  // ─── Loading / error states ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-500">
        <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
        <span className="ml-2">{t("hr.appraisals.detail.loading")}</span>
      </div>
    );
  }

  if (error && !appraisal) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        <Link href="/hr/appraisals" className="btn-secondary text-sm">{t("hr.appraisals.detail.backToList")}</Link>
      </div>
    );
  }

  if (!appraisal) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm text-neutral-600">{t("hr.appraisals.detail.notFound")}</div>
        <Link href="/hr/appraisals" className="btn-secondary text-sm">{t("hr.appraisals.detail.backToList")}</Link>
      </div>
    );
  }

  // ─── Role detection ────────────────────────────────────────────────────────────

  const isEmployee = currentUserId != null && appraisal.employee_id === currentUserId;
  const isSupervisor = currentUserId != null && appraisal.supervisor_id === currentUserId;
  const isHod = currentUserId != null && appraisal.hod_id === currentUserId;

  const canFillSection2 = isEmployee && appraisal.status === "draft";
  const canFillSection3 = isSupervisor && appraisal.status === "employee_submitted";
  const canFillSection4 = isEmployee && appraisal.status === "supervisor_reviewed";
  const canFillSection5 = isHod && (appraisal.status === "supervisor_reviewed" || appraisal.status === "employee_submitted");
  const canFillSection6 = isEmployee && appraisal.status === "hod_reviewed";
  const canFillSections78 = !isEmployee && !isSupervisor && !isHod && appraisal.status === "hod_reviewed";
  const canFillSection9 = isEmployee && appraisal.status === "finalized" && !appraisal.employee_acknowledged;

  const section2Done = ["employee_submitted", "supervisor_reviewed", "hod_reviewed", "hr_reviewed", "finalized"].includes(appraisal.status);
  const section3Done = ["supervisor_reviewed", "hod_reviewed", "hr_reviewed", "finalized"].includes(appraisal.status);
  const section5Done = ["hod_reviewed", "hr_reviewed", "finalized"].includes(appraisal.status);
  const sections78Done = ["hr_reviewed", "finalized"].includes(appraisal.status);

  const employeeName = appraisal.employee?.name ?? t("hr.appraisals.detail.employeeNumber", { id: appraisal.employee_id });
  const sa = parseSelfAssessment(appraisal.self_assessment);
  const svData = parseSupervisorAssessment(appraisal.supervisor_comments);
  const hodData = parseHodAssessment(appraisal.hod_comments);

  const svOverallScore = computeOverallRating(
    Object.fromEntries(Object.entries(svData.factor_ratings).map(([k, v]) => [k, v.rating]))
  );

  return (
    <div className="w-full min-w-0 space-y-5">

      <ModulePageHeader
        title={employeeName}
        subtitle={`${appraisal.cycle?.title ?? t("hr.appraisals.list.cycleNumber", { id: appraisal.cycle_id })}${appraisal.cycle?.period_start && appraisal.cycle?.period_end ? ` · ${formatDate(appraisal.cycle.period_start)} – ${formatDate(appraisal.cycle.period_end)}` : ""}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "hr.appraisals.list.crumb", href: "/hr/appraisals" },
              { label: employeeName },
            ]}
          />
        }
      />

      {/* Status bar */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${STATUS_CLS[appraisal.status] ?? ""}`}>
          {STATUS_LABELS[appraisal.status] ? t(STATUS_LABELS[appraisal.status]) : appraisal.status}
        </span>
        <div className="text-sm text-neutral-600">
          <span className="font-medium text-neutral-700">{t("hr.appraisals.detail.supervisorLabel")}</span>{" "}
          {appraisal.supervisor?.name ?? <span className="text-neutral-400">{t("hr.appraisals.detail.notAssigned")}</span>}
        </div>
        <div className="text-sm text-neutral-600">
          <span className="font-medium text-neutral-700">{t("hr.appraisals.detail.hodLabel")}</span>{" "}
          {appraisal.hod?.name ?? <span className="text-neutral-400">{t("hr.appraisals.detail.notAssigned")}</span>}
        </div>
        {appraisal.submitted_at && (
          <div className="text-xs text-neutral-500 ml-auto">
            {t("hr.appraisals.detail.submittedOn", { date: formatDate(appraisal.submitted_at) })}
          </div>
        )}
        {appraisal.finalized_at && (
          <div className="text-xs text-neutral-500">
            {t("hr.appraisals.detail.finalizedOn", { date: formatDate(appraisal.finalized_at) })}
          </div>
        )}
        {appraisal.employee_acknowledged && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 ml-auto">
            <span className="material-symbols-outlined text-[12px]">verified</span>
            {t("hr.appraisals.detail.acknowledgedOn", { date: formatDate(appraisal.employee_acknowledged_at ?? null) })}
          </span>
        )}
      </div>

      {/* Global error banner */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* ─── SECTION 1: Personal Details ──────────────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader number="1" title="hr.appraisals.detail.s1.title" subtitle="hr.appraisals.detail.s1.subtitle" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">{t("hr.appraisals.detail.name")}</p>
            <p className="text-neutral-800 font-medium">{employeeName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">{t("hr.appraisals.detail.email")}</p>
            <p className="text-neutral-700">{appraisal.employee?.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">{t("hr.appraisals.detail.periodOfReview")}</p>
            <p className="text-neutral-700">
              {appraisal.cycle?.period_start ? formatDate(appraisal.cycle.period_start) : "—"}
              {" – "}
              {appraisal.cycle?.period_end ? formatDate(appraisal.cycle.period_end) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">{t("hr.appraisals.detail.appraisalCycle")}</p>
            <p className="text-neutral-700">{appraisal.cycle?.title ?? t("hr.appraisals.list.cycleNumber", { id: appraisal.cycle_id })}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">{t("hr.appraisals.new.supervisor")}</p>
            <p className="text-neutral-700">{appraisal.supervisor?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">{t("hr.appraisals.detail.headOfDepartment")}</p>
            <p className="text-neutral-700">{appraisal.hod?.name ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: Staff Member Self-Assessment ──────────────────────────── */}
      <div className="card p-5">
        <SectionHeader
          number="2"
          title="hr.appraisals.detail.s2.title"
          subtitle={canFillSection2 ? "hr.appraisals.detail.s2.subtitle" : undefined}
          badge={section2Done ? <CompletedBadge /> : undefined}
        />

        {canFillSection2 ? (
          <form onSubmit={handleSubmitSection2} className="space-y-6">

            {/* 2.A Major Achievements */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-800">2.A&nbsp; {t("hr.appraisals.detail.s2.achievements")}</h3>{/* i18n-ignore */}
                  <p className="text-xs text-neutral-500">{t("hr.appraisals.detail.s2.achievementsHint")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAchievements((p) => [...p, { category: "", description: "" }])}
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>{t("hr.appraisals.detail.addRow")}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-neutral-200 rounded-lg overflow-hidden">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-600 w-40">{t("hr.appraisals.detail.category")}</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-600">{t("hr.appraisals.detail.achievementDescription")}</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {achievements.map((row, i) => (
                      <tr key={i} className="border-t border-neutral-100">
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            className="form-input w-full text-xs"
                            placeholder={t("hr.appraisals.detail.categoryPlaceholder")}
                            value={row.category}
                            onChange={(e) => setAchievements((p) => p.map((r, idx) => idx === i ? { ...r, category: e.target.value } : r))}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            className="form-input w-full text-xs"
                            placeholder={t("hr.appraisals.detail.describeAchievement")}
                            value={row.description}
                            onChange={(e) => setAchievements((p) => p.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))}
                          />
                        </td>
                        <td className="px-1 text-center">
                          {achievements.length > 1 && (
                            <button type="button" onClick={() => setAchievements((p) => p.filter((_, idx) => idx !== i))} aria-label={t("hr.appraisals.detail.removeAchievement", { n: i + 1 })} className="text-neutral-300 hover:text-red-500">
                              <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2.B Outputs Not Achieved */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-800 mb-1">2.B&nbsp; {t("hr.appraisals.detail.s2.notAchieved")}</h3>{/* i18n-ignore */}
              <textarea
                className="form-input w-full min-h-[80px] resize-y text-sm"
                placeholder={t("hr.appraisals.detail.s2.notAchievedPlaceholder")}
                value={outputsNotAchieved}
                onChange={(e) => setOutputsNotAchieved(e.target.value)}
              />
            </div>

            {/* 2.C Assignments Outside Work Plan */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-800 mb-1">2.C&nbsp; {t("hr.appraisals.detail.s2.outside")}</h3>{/* i18n-ignore */}
              <textarea
                className="form-input w-full min-h-[70px] resize-y text-sm"
                placeholder={t("hr.appraisals.detail.s2.outsidePlaceholder")}
                value={outsideAssignments}
                onChange={(e) => setOutsideAssignments(e.target.value)}
              />
            </div>

            {/* 2.D Resources */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-800 mb-1">2.D&nbsp; {t("hr.appraisals.detail.s2.resources")}</h3>{/* i18n-ignore */}
              <textarea
                className="form-input w-full min-h-[70px] resize-y text-sm"
                placeholder={t("hr.appraisals.detail.s2.resourcesPlaceholder")}
                value={resources}
                onChange={(e) => setResources(e.target.value)}
              />
            </div>

            {/* 2.E Self-Rating Table */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-800 mb-2">2.E&nbsp; {t("hr.appraisals.detail.s2.selfRating")}</h3>{/* i18n-ignore */}
              <p className="text-xs text-neutral-500 mb-3">
                {t("hr.appraisals.detail.s2.selfRatingHint")}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-neutral-200 rounded-lg overflow-hidden">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-center px-2 py-2 text-xs font-semibold text-neutral-600 w-8">#</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-600">{t("hr.appraisals.detail.performanceFactor")}</th>
                      {RATING_OPTIONS.map((opt) => (
                        <th key={opt} className="text-center px-2 py-2 text-xs font-semibold text-neutral-600 w-24">
                          {t(RATING_KEYS[opt])}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERFORMANCE_FACTORS.map((factor, i) => (
                      <RatingRadioRow
                        key={factor}
                        factor={factor}
                        index={i}
                        value={factorRatings[factor] ?? ""}
                        onChange={(v) => setFactorRatings((p) => ({ ...p, [factor]: v }))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {Object.keys(factorRatings).length > 0 && (
                <p className="text-xs text-neutral-500 mt-2">
                  {t("hr.appraisals.detail.computedAverage")}{" "}
                  <strong className="text-neutral-700">{computeOverallRating(factorRatings)} / 10</strong>{" "}
                  {t("hr.appraisals.detail.factorsRated", { rated: Object.values(factorRatings).filter(Boolean).length, total: PERFORMANCE_FACTORS.length })}
                </p>
              )}
            </div>

            {/* 2.F General Comments */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-800 mb-1">2.F&nbsp; {t("hr.appraisals.detail.s2.generalComments")}</h3>{/* i18n-ignore */}
              <textarea
                className="form-input w-full min-h-[90px] resize-y text-sm"
                placeholder={t("hr.appraisals.detail.s2.generalCommentsPlaceholder")}
                value={generalComments}
                onChange={(e) => setGeneralComments(e.target.value)}
              />
            </div>

            {/* Evidence */}
            <div className="border-t border-neutral-100 pt-5">
              <h3 className="text-sm font-semibold text-neutral-800 mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-neutral-400">attach_file</span>
                {t("hr.appraisals.detail.supportingEvidence")}
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <label htmlFor="hr-appraisals-detail-upload-file" className="btn-secondary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  {uploading ? t("hr.appraisals.detail.uploading") : t("hr.appraisals.detail.uploadFiles")}
                  <input id="hr-appraisals-detail-upload-file" type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
              </div>
              {attachments.length > 0 && (
                <ul className="space-y-1.5 mb-3">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-xs">
                      <span className="font-medium text-neutral-800 truncate">{a.original_filename}</span>
                      <div className="flex gap-2 flex-shrink-0">
                        <button type="button" onClick={() => handleDownloadAttachment(a)} className="btn-secondary text-xs">{t("common.download")}</button>
                        <button type="button" onClick={() => handleDeleteAttachment(a.id)} className="btn-secondary text-xs text-red-600">{t("common.delete")}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 items-end">
                <input type="url" className="form-input flex-1 min-w-[180px] text-sm" placeholder="https://…" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} />{/* i18n-ignore */}
                <input type="text" className="form-input w-36 text-sm" placeholder={t("hr.appraisals.detail.linkTitle")} value={newLinkTitle} onChange={(e) => setNewLinkTitle(e.target.value)} />
                <button
                  type="button"
                  onClick={() => {
                    if (!newLinkUrl.trim()) return;
                    const url = safeExternalUrl(newLinkUrl);
                    if (!url) {
                      setError(t("hr.appraisals.detail.linkInvalid"));
                      return;
                    }
                    setError(null);
                    setEvidenceLinks((p) => [...p, { url, title: newLinkTitle.trim() || undefined }]);
                    setNewLinkUrl(""); setNewLinkTitle("");
                  }}
                  className="btn-secondary py-1.5 px-3 text-xs"
                >
                  {t("hr.appraisals.detail.addLink")}
                </button>
              </div>
              {evidenceLinks.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {evidenceLinks.map((link, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      {safeExternalUrl(link.url) ? (
                        <a href={safeExternalUrl(link.url)!} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs truncate">{link.title || link.url}</a>
                      ) : (
                        <span className="text-xs text-neutral-500 truncate">{link.title || link.url}</span>
                      )}
                      <button type="button" onClick={() => setEvidenceLinks((p) => p.filter((_, idx) => idx !== i))} className="btn-secondary text-xs text-red-600 flex-shrink-0">{t("contracts.detail.remove")}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex gap-3 pt-2 border-t border-neutral-100">
              <button type="submit" disabled={submitting} className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">{submitting ? "progress_activity" : "send"}</span>
                {submitting ? t("hr.appraisals.detail.submitting") : t("hr.appraisals.detail.submitSelf")}
              </button>
            </div>
          </form>
        ) : section2Done ? (
          /* Read-only view of Section 2 */
          <div className="space-y-5 text-sm">
            {/* 2.A */}
            {sa.achievements?.some((a) => a.description) && (
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">2.A — {t("hr.appraisals.detail.s2.achievements")}</h3>
                <table className="w-full border border-neutral-100 rounded-lg overflow-hidden text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-600 w-36">{t("hr.appraisals.detail.category")}</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-600">{t("hr.positions.form.description")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sa.achievements.filter((a) => a.description).map((a, i) => (
                      <tr key={i} className="border-t border-neutral-50">
                        <td className="px-3 py-2 text-neutral-500 text-xs">{a.category || "—"}</td>
                        <td className="px-3 py-2 text-neutral-700">{a.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {sa.outputs_not_achieved && (
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">2.B — {t("hr.appraisals.detail.ro.notAchieved")}</h3>
                <p className="text-neutral-700 whitespace-pre-wrap">{sa.outputs_not_achieved}</p>
              </div>
            )}
            {sa.outside_assignments && (
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">2.C — {t("hr.appraisals.detail.ro.outside")}</h3>
                <p className="text-neutral-700 whitespace-pre-wrap">{sa.outside_assignments}</p>
              </div>
            )}
            {sa.resources && (
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">2.D — {t("hr.appraisals.detail.ro.resources")}</h3>
                <p className="text-neutral-700 whitespace-pre-wrap">{sa.resources}</p>
              </div>
            )}
            {/* 2.E self-ratings */}
            {Object.keys(sa.factor_ratings ?? {}).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">2.E — {t("hr.appraisals.detail.s2.selfRating")}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border border-neutral-100 rounded-lg overflow-hidden text-sm">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="text-center px-2 py-2 text-xs font-semibold text-neutral-500 w-8">#</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-500">{t("hr.appraisals.detail.factor")}</th>
                        {RATING_OPTIONS.map((opt) => (
                          <th key={opt} className="text-center px-2 py-2 text-xs font-semibold text-neutral-500 w-24">{t(RATING_KEYS[opt])}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERFORMANCE_FACTORS.map((factor, i) => (
                        <RatingRadioRow
                          key={factor}
                          factor={factor}
                          index={i}
                          value={sa.factor_ratings?.[factor] ?? ""}
                          onChange={() => {}}
                          disabled
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  {t("hr.appraisals.detail.computedScore")} <strong className="text-neutral-700">{computeOverallRating(sa.factor_ratings ?? {})} / 10</strong>
                </p>
              </div>
            )}
            {sa.general_comments && (
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">2.F — {t("hr.appraisals.detail.s2.generalComments")}</h3>
                <p className="text-neutral-700 whitespace-pre-wrap">{sa.general_comments}</p>
              </div>
            )}
            {/* Evidence read-only */}
            {(attachments.length > 0 || evidenceLinks.length > 0) && (
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">{t("hr.appraisals.detail.supportingEvidence")}</h3>
                {attachments.length > 0 && (
                  <ul className="space-y-1.5 mb-2">
                    {attachments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-xs">
                        <span className="font-medium text-neutral-800">{a.original_filename}</span>
                        <button type="button" onClick={() => handleDownloadAttachment(a)} className="btn-secondary text-xs">{t("common.download")}</button>
                      </li>
                    ))}
                  </ul>
                )}
                {evidenceLinks.length > 0 && (
                  <ul className="space-y-1">
                    {evidenceLinks.map((link, i) => (
                      <li key={i}>
                        {safeExternalUrl(link.url) ? (
                          <a href={safeExternalUrl(link.url)!} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">{link.title || link.url}</a>
                        ) : (
                          <span className="text-xs text-neutral-500">{link.title || link.url}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-neutral-400">
            {isEmployee ? t("hr.appraisals.detail.selfNotDue") : t("hr.appraisals.detail.selfNotSubmitted")}
          </div>
        )}
      </div>

      {/* ─── SECTION 3: Supervisor Assessment ────────────────────────────────── */}
      {(canFillSection3 || section3Done || isSupervisor) && (
        <div className="card p-5">
          <SectionHeader
            number="3"
            title="hr.appraisals.detail.s3.title"
            subtitle={canFillSection3 ? "hr.appraisals.detail.s3.subtitle" : undefined}
            badge={section3Done ? <CompletedBadge /> : undefined}
          />

          {canFillSection3 ? (
            <form onSubmit={handleSubmitSection3} className="space-y-6">

              {/* 3.A Rating Table */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-800 mb-2">3.A&nbsp; {t("hr.appraisals.detail.s3.rating")}</h3>{/* i18n-ignore */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-neutral-200 rounded-lg overflow-hidden">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="text-center px-2 py-2 text-xs font-semibold text-neutral-600 w-8">#</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-600">{t("hr.appraisals.detail.performanceFactor")}</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-neutral-600 w-36">{t("hr.appraisals.detail.rating")}</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-600">{t("hr.appraisals.detail.comments")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERFORMANCE_FACTORS.map((factor, i) => (
                        <SupervisorRatingRow
                          key={factor}
                          factor={factor}
                          index={i}
                          rating={svFactorRatings[factor]?.rating ?? ""}
                          comment={svFactorRatings[factor]?.comment ?? ""}
                          onRatingChange={(v) => setSvFactorRatings((p) => ({ ...p, [factor]: { ...p[factor], rating: v } }))}
                          onCommentChange={(v) => setSvFactorRatings((p) => ({ ...p, [factor]: { ...p[factor], comment: v } }))}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3.B Rating Summary */}
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                <h3 className="text-sm font-semibold text-neutral-800 mb-2">3.B&nbsp; {t("hr.appraisals.detail.s3.scaleKey")}</h3>{/* i18n-ignore */}
                <div className="flex flex-wrap gap-3 text-xs">
                  {RATING_OPTIONS.map((opt) => (
                    <span key={opt} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${RATING_CLS[opt]}`}>
                      {t("hr.appraisals.detail.ratingPoints", { rating: t(RATING_KEYS[opt]), points: RATING_POINTS[opt] })}
                    </span>
                  ))}
                </div>
                {Object.keys(svFactorRatings).length > 0 && (
                  <p className="mt-3 text-xs text-neutral-600">
                    {t("hr.appraisals.detail.yourAverage")}{" "}
                    <strong className="text-neutral-800">
                      {computeOverallRating(Object.fromEntries(Object.entries(svFactorRatings).map(([k, v]) => [k, v.rating])))} / 10
                    </strong>
                  </p>
                )}
              </div>

              {/* 3.C Recommendation */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-800 mb-2">3.C&nbsp; {t("hr.appraisals.detail.s3.recommendation")}</h3>{/* i18n-ignore */}
                <div className="flex flex-wrap gap-4 mb-3">
                  {[
                    { slug: "promotion", label: "hr.appraisals.detail.rec.promotion", state: svPromotion, set: setSvPromotion },
                    { slug: "merit-increase", label: "hr.appraisals.detail.rec.merit", state: svMerit, set: setSvMerit },
                    { slug: "confirmation", label: "hr.appraisals.detail.rec.confirmation", state: svConfirmation, set: setSvConfirmation },
                    { slug: "demotion", label: "hr.appraisals.detail.rec.demotion", state: svDemotion, set: setSvDemotion },
                  ].map(({ slug, label, state, set }) => (
                    <label htmlFor={`hr-appraisals-detail-recommend-${slug}`} key={slug} className="flex items-center gap-2 cursor-pointer text-sm text-neutral-700">
                      <input id={`hr-appraisals-detail-recommend-${slug}`}
                        type="checkbox"
                        checked={state}
                        onChange={(e) => set(e.target.checked)}
                        className="rounded border-neutral-300 text-primary"
                      />
                      {t(label)}
                    </label>
                  ))}
                </div>
                <div>
                  <label htmlFor="hr-appraisals-detail-other-recommended-actions" className="block text-xs font-semibold text-neutral-600 mb-1">{t("hr.appraisals.detail.otherActions")}</label>
                  <textarea id="hr-appraisals-detail-other-recommended-actions"
                    className="form-input w-full min-h-[60px] resize-y text-sm"
                    placeholder={t("hr.appraisals.detail.otherActionsPlaceholder")}
                    value={svOtherAction}
                    onChange={(e) => setSvOtherAction(e.target.value)}
                  />
                </div>
              </div>

              {/* 3.D Development Plan */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-800 mb-3">3.D&nbsp; {t("hr.appraisals.detail.s3.devPlan")}</h3>{/* i18n-ignore */}
                <div className="space-y-3">
                  <div>
                    <label htmlFor="hr-appraisals-detail-i-scope-role-changes" className="block text-xs font-semibold text-neutral-600 mb-1">{t("hr.appraisals.detail.dev.scope")}</label>
                    <textarea id="hr-appraisals-detail-i-scope-role-changes" className="form-input w-full min-h-[60px] resize-y text-sm" placeholder={t("hr.appraisals.detail.dev.scopePlaceholder")} value={svScopeChanges} onChange={(e) => setSvScopeChanges(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="hr-appraisals-detail-ii-a-skills-and-knowledge-development" className="block text-xs font-semibold text-neutral-600 mb-1">{t("hr.appraisals.detail.dev.skills")}</label>
                    <textarea id="hr-appraisals-detail-ii-a-skills-and-knowledge-development" className="form-input w-full min-h-[60px] resize-y text-sm" placeholder={t("hr.appraisals.detail.dev.skillsPlaceholder")} value={svSkillsKnowledge} onChange={(e) => setSvSkillsKnowledge(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="hr-appraisals-detail-ii-b-developmental-actions" className="block text-xs font-semibold text-neutral-600 mb-1">{t("hr.appraisals.detail.dev.actions")}</label>
                    <textarea id="hr-appraisals-detail-ii-b-developmental-actions" className="form-input w-full min-h-[60px] resize-y text-sm" placeholder={t("hr.appraisals.detail.dev.actionsPlaceholder")} value={svDevActions} onChange={(e) => setSvDevActions(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="hr-appraisals-detail-iii-career-development" className="block text-xs font-semibold text-neutral-600 mb-1">{t("hr.appraisals.detail.dev.career")}</label>
                    <textarea id="hr-appraisals-detail-iii-career-development" className="form-input w-full min-h-[60px] resize-y text-sm" placeholder={t("hr.appraisals.detail.dev.careerPlaceholder")} value={svCareer} onChange={(e) => setSvCareer(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* 3.E Supplemental Review */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-800 mb-1">3.E&nbsp; {t("hr.appraisals.detail.s3.supplemental")}</h3>{/* i18n-ignore */}
                <textarea className="form-input w-full min-h-[70px] resize-y text-sm" placeholder={t("hr.appraisals.detail.s3.supplementalPlaceholder")} value={svSupplemental} onChange={(e) => setSvSupplemental(e.target.value)} />
              </div>

              <div className="flex gap-3 pt-2 border-t border-neutral-100">
                <button type="submit" disabled={svSubmitting} className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">{svSubmitting ? "progress_activity" : "rate_review"}</span>
                  {svSubmitting ? t("hr.appraisals.detail.submitting") : t("hr.appraisals.detail.submitSv")}
                </button>
              </div>
            </form>
          ) : section3Done ? (
            <div className="space-y-5 text-sm">
              {/* 3.A read-only */}
              {Object.keys(svData.factor_ratings ?? {}).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">3.A — {t("hr.appraisals.detail.ro.svRatings")}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-neutral-100 rounded-lg overflow-hidden text-sm">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="text-center px-2 py-2 text-xs font-semibold text-neutral-500 w-8">#</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-500">{t("hr.appraisals.detail.factor")}</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-neutral-500 w-36">{t("hr.appraisals.detail.rating")}</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-500">{t("hr.appraisals.detail.comments")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PERFORMANCE_FACTORS.map((factor, i) => (
                          <SupervisorRatingRow
                            key={factor}
                            factor={factor}
                            index={i}
                            rating={svData.factor_ratings?.[factor]?.rating ?? ""}
                            comment={svData.factor_ratings?.[factor]?.comment ?? ""}
                            onRatingChange={() => {}}
                            onCommentChange={() => {}}
                            disabled
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    {t("hr.appraisals.detail.computedScore")} <strong className="text-neutral-700">{svOverallScore} / 10</strong>
                  </p>
                </div>
              )}
              {/* 3.C recommendations */}
              {(svData.promotion || svData.merit_increase || svData.confirmation || svData.demotion || svData.other_action) && (
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">3.C — {t("hr.appraisals.detail.s3.recommendation")}</h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {svData.promotion && <span className="badge badge-primary">{t("hr.appraisals.detail.rec.promotion")}</span>}
                    {svData.merit_increase && <span className="badge badge-primary">{t("hr.appraisals.detail.rec.merit")}</span>}
                    {svData.confirmation && <span className="badge badge-success">{t("hr.appraisals.detail.rec.confirmation")}</span>}
                    {svData.demotion && <span className="badge badge-danger">{t("hr.appraisals.detail.rec.demotion")}</span>}
                  </div>
                  {svData.other_action && <p className="text-neutral-700">{svData.other_action}</p>}
                </div>
              )}
              {/* 3.D development plan */}
              {(svData.scope_changes || svData.skills_knowledge || svData.developmental_actions || svData.career_development) && (
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">3.D — {t("hr.appraisals.detail.ro.devPlan")}</h3>
                  <div className="space-y-2">
                    {svData.scope_changes && <div><span className="text-xs font-medium text-neutral-500">{t("hr.appraisals.detail.ro.scope")}</span><p className="text-neutral-700 mt-0.5">{svData.scope_changes}</p></div>}
                    {svData.skills_knowledge && <div><span className="text-xs font-medium text-neutral-500">{t("hr.appraisals.detail.ro.skills")}</span><p className="text-neutral-700 mt-0.5">{svData.skills_knowledge}</p></div>}
                    {svData.developmental_actions && <div><span className="text-xs font-medium text-neutral-500">{t("hr.appraisals.detail.ro.actions")}</span><p className="text-neutral-700 mt-0.5">{svData.developmental_actions}</p></div>}
                    {svData.career_development && <div><span className="text-xs font-medium text-neutral-500">{t("hr.appraisals.detail.ro.career")}</span><p className="text-neutral-700 mt-0.5">{svData.career_development}</p></div>}
                  </div>
                </div>
              )}
              {svData.supplemental_review && (
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">3.E — {t("hr.appraisals.detail.ro.supplemental")}</h3>
                  <p className="text-neutral-700 whitespace-pre-wrap">{svData.supplemental_review}</p>
                </div>
              )}
              {appraisal.supervisor_reviewed_at && (
                <p className="text-xs text-neutral-400">{t("hr.appraisals.detail.reviewedBy", { date: formatDate(appraisal.supervisor_reviewed_at), name: appraisal.supervisor?.name ?? t("hr.appraisals.detail.supervisorLower") })}</p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ─── SECTION 4: Staff Member's Comments on Supervisor Rating ─────────── */}
      {(canFillSection4 || (section3Done && isEmployee)) && (
        <div className="card p-5">
          <SectionHeader
            number="4"
            title="hr.appraisals.detail.s4.title"
            subtitle="hr.appraisals.detail.s4.subtitle"
            badge={sa.section4_comments ? <CompletedBadge /> : undefined}
          />
          {canFillSection4 ? (
            <div className="space-y-3">
              <textarea
                className="form-input w-full min-h-[90px] resize-y text-sm"
                placeholder={t("hr.appraisals.detail.s4.placeholder")}
                value={section4Comments}
                onChange={(e) => setSection4Comments(e.target.value)}
              />
              <button
                type="button"
                onClick={handleSaveSection4}
                disabled={section4Saving}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">{section4Saving ? "progress_activity" : "save"}</span>
                {section4Saving ? t("hr.positions.form.saving") : t("hr.appraisals.detail.saveComments")}
              </button>
            </div>
          ) : sa.section4_comments ? (
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{sa.section4_comments}</p>
          ) : (
            <p className="text-sm text-neutral-400 italic">{t("hr.appraisals.detail.noComments")}</p>
          )}
        </div>
      )}

      {/* ─── SECTION 5: HOD Review ────────────────────────────────────────────── */}
      {(canFillSection5 || section5Done || isHod) && (
        <div className="card p-5">
          <SectionHeader
            number="5"
            title="hr.appraisals.detail.s5.title"
            subtitle={canFillSection5 ? "hr.appraisals.detail.s5.subtitle" : undefined}
            badge={section5Done ? <CompletedBadge /> : undefined}
          />
          {canFillSection5 ? (
            <form onSubmit={handleSubmitSection5} className="space-y-4">
              <div>
                <label htmlFor="hr-appraisals-detail-recommendation-to-sg" className="block text-sm font-semibold text-neutral-700 mb-1">{t("hr.appraisals.detail.s5.recommendation")}</label>
                <textarea id="hr-appraisals-detail-recommendation-to-sg"
                  className="form-input w-full min-h-[80px] resize-y text-sm"
                  placeholder={t("hr.appraisals.detail.s5.recommendationPlaceholder")}
                  value={hodRecommendation}
                  onChange={(e) => setHodRecommendation(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="hr-appraisals-detail-comments" className="block text-sm font-semibold text-neutral-700 mb-1">{t("hr.appraisals.detail.comments")}</label>
                <textarea id="hr-appraisals-detail-comments"
                  className="form-input w-full min-h-[70px] resize-y text-sm"
                  placeholder={t("hr.appraisals.detail.s5.commentsPlaceholder")}
                  value={hodComments}
                  onChange={(e) => setHodComments(e.target.value)}
                />
              </div>
              <button type="submit" disabled={hodSubmitting} className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">{hodSubmitting ? "progress_activity" : "verified_user"}</span>
                {hodSubmitting ? t("hr.appraisals.detail.submitting") : t("hr.appraisals.detail.submitHod")}
              </button>
            </form>
          ) : section5Done ? (
            <div className="space-y-3 text-sm">
              {hodData.recommendation && (
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">{t("hr.appraisals.detail.s5.recommendation")}</h3>
                  <p className="text-neutral-700 whitespace-pre-wrap">{hodData.recommendation}</p>
                </div>
              )}
              {hodData.comments && (
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">{t("hr.appraisals.detail.s5.hodComments")}</h3>
                  <p className="text-neutral-700 whitespace-pre-wrap">{hodData.comments}</p>
                </div>
              )}
              {appraisal.hod_reviewed_at && (
                <p className="text-xs text-neutral-400">{t("hr.appraisals.detail.reviewedBy", { date: formatDate(appraisal.hod_reviewed_at), name: appraisal.hod?.name ?? t("hr.appraisals.new.hod") })}</p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ─── SECTION 6: Staff Member's Comments on HOD Review ────────────────── */}
      {(canFillSection6 || (section5Done && isEmployee)) && (
        <div className="card p-5">
          <SectionHeader
            number="6"
            title="hr.appraisals.detail.s6.title"
            badge={sa.section6_comments ? <CompletedBadge /> : undefined}
          />
          {canFillSection6 ? (
            <div className="space-y-3">
              <textarea
                className="form-input w-full min-h-[90px] resize-y text-sm"
                placeholder={t("hr.appraisals.detail.s6.placeholder")}
                value={section6Comments}
                onChange={(e) => setSection6Comments(e.target.value)}
              />
              <button
                type="button"
                onClick={handleSaveSection6}
                disabled={section6Saving}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">{section6Saving ? "progress_activity" : "save"}</span>
                {section6Saving ? t("hr.positions.form.saving") : t("hr.appraisals.detail.saveComments")}
              </button>
            </div>
          ) : sa.section6_comments ? (
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{sa.section6_comments}</p>
          ) : (
            <p className="text-sm text-neutral-400 italic">{t("hr.appraisals.detail.noComments")}</p>
          )}
        </div>
      )}

      {/* ─── SECTIONS 7 & 8: Consolidation & SG Review ───────────────────────── */}
      {(canFillSections78 || sections78Done) && (
        <div className="card p-5">
          <SectionHeader
            number="7–8"
            title="hr.appraisals.detail.s78.title"
            subtitle={canFillSections78 ? "hr.appraisals.detail.s78.subtitle" : undefined}
            badge={sections78Done ? <CompletedBadge /> : undefined}
          />
          {canFillSections78 ? (
            <form onSubmit={handleFinalize} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="hr-appraisals-detail-overall-rating-numeric-0-10" className="block text-sm font-semibold text-neutral-700 mb-1">{t("hr.appraisals.detail.s78.overallNumeric")}</label>
                  <input id="hr-appraisals-detail-overall-rating-numeric-0-10"
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    className="form-input w-full text-sm"
                    placeholder={t("hr.appraisals.detail.s78.overallPlaceholder")}
                    value={finalOverallRating}
                    onChange={(e) => setFinalOverallRating(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="hr-appraisals-detail-overall-rating-label" className="block text-sm font-semibold text-neutral-700 mb-1">{t("hr.appraisals.detail.s78.overallLabel")}</label>
                  <select id="hr-appraisals-detail-overall-rating-label" className="form-input w-full text-sm" value={finalOverallLabel} onChange={(e) => setFinalOverallLabel(e.target.value)}>
                    <option value="">{t("hr.appraisals.detail.s78.selectLabel")}</option>
                    {RATING_OPTIONS.map((opt) => <option key={opt} value={opt}>{t(RATING_KEYS[opt])}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="hr-appraisals-detail-hr-consolidation-comments-section-7" className="block text-sm font-semibold text-neutral-700 mb-1">{t("hr.appraisals.detail.s78.hrComments")}</label>
                <textarea id="hr-appraisals-detail-hr-consolidation-comments-section-7" className="form-input w-full min-h-[80px] resize-y text-sm" placeholder={t("hr.appraisals.detail.s78.hrPlaceholder")} value={hrComments} onChange={(e) => setHrComments(e.target.value)} />
              </div>
              <div>
                <label htmlFor="hr-appraisals-detail-sg-decision-section-8" className="block text-sm font-semibold text-neutral-700 mb-1">{t("hr.appraisals.detail.s78.sgDecision")}</label>
                <textarea id="hr-appraisals-detail-sg-decision-section-8" className="form-input w-full min-h-[80px] resize-y text-sm" placeholder={t("hr.appraisals.detail.s78.sgPlaceholder")} value={sgDecision} onChange={(e) => setSgDecision(e.target.value)} />
              </div>
              <div>
                <label htmlFor="hr-appraisals-detail-final-development-plan" className="block text-sm font-semibold text-neutral-700 mb-1">{t("hr.appraisals.detail.s78.finalPlan")}</label>
                <textarea id="hr-appraisals-detail-final-development-plan" className="form-input w-full min-h-[80px] resize-y text-sm" placeholder={t("hr.appraisals.detail.s78.finalPlanPlaceholder")} value={developmentPlan} onChange={(e) => setDevelopmentPlan(e.target.value)} />
              </div>
              <button type="submit" disabled={finalSubmitting || !finalOverallLabel} className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">{finalSubmitting ? "progress_activity" : "gavel"}</span>
                {finalSubmitting ? t("hr.appraisals.detail.finalizing") : t("hr.appraisals.detail.finalize")}
              </button>
            </form>
          ) : sections78Done ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-4">
                {appraisal.overall_rating != null && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">{t("hr.appraisals.detail.overallScore")}</p>
                    <p className="text-2xl font-bold text-neutral-900">{appraisal.overall_rating}<span className="text-sm font-normal text-neutral-500">/10</span></p>
                  </div>
                )}
                {appraisal.overall_rating_label && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">{t("hr.appraisals.detail.overallRating")}</p>
                    <RatingPill rating={appraisal.overall_rating_label} />
                  </div>
                )}
              </div>
              {appraisal.hr_comments && (
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">{t("hr.appraisals.detail.ro.section7")}</h3>
                  <p className="text-neutral-700 whitespace-pre-wrap">{appraisal.hr_comments}</p>
                </div>
              )}
              {appraisal.sg_decision && (
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">{t("hr.appraisals.detail.ro.section8")}</h3>
                  <p className="text-neutral-700 whitespace-pre-wrap">{appraisal.sg_decision}</p>
                </div>
              )}
              {appraisal.development_plan && (
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">{t("hr.appraisals.detail.s78.finalPlan")}</h3>
                  <p className="text-neutral-700 whitespace-pre-wrap">{appraisal.development_plan}</p>
                </div>
              )}
              {appraisal.finalized_at && (
                <p className="text-xs text-neutral-400">{t("hr.appraisals.detail.finalizedOn", { date: formatDate(appraisal.finalized_at) })}</p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ─── SECTION 9: Final Comments by Staff Member ───────────────────────── */}
      {(canFillSection9 || (appraisal.status === "finalized" && isEmployee && appraisal.employee_acknowledged)) && (
        <div className="card p-5">
          <SectionHeader
            number="9"
            title="hr.appraisals.detail.s9.title"
            subtitle={canFillSection9 ? "hr.appraisals.detail.s9.subtitle" : undefined}
            badge={appraisal.employee_acknowledged ? <CompletedBadge /> : undefined}
          />
          {canFillSection9 ? (
            <div className="space-y-4">
              <textarea
                className="form-input w-full min-h-[90px] resize-y text-sm"
                placeholder={t("hr.appraisals.detail.s9.placeholder")}
                value={section9Comments}
                onChange={(e) => setSection9Comments(e.target.value)}
              />
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">info</span>
                <p>{t("hr.appraisals.detail.s9.notice")}</p>
              </div>
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={acknowledging}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">{acknowledging ? "progress_activity" : "verified"}</span>
                {acknowledging ? t("hr.appraisals.detail.acknowledging") : t("hr.appraisals.detail.acknowledge")}
              </button>
            </div>
          ) : sa.section9_comments ? (
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{sa.section9_comments}</p>
          ) : (
            <p className="text-sm text-neutral-400 italic">{t("hr.appraisals.detail.noFinalComments")}</p>
          )}
        </div>
      )}

      {/* Back link */}
      <div className="flex justify-end gap-3 pt-2">
        <Link href="/hr/appraisals" className="btn-secondary text-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t("hr.appraisals.detail.backToList")}
        </Link>
      </div>
    </div>
  );
}
