"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { travelApi, type TravelRequest, type TravelAmendment, type ModuleAttachment, TRAVEL_DOCUMENT_TYPES } from "@/lib/api";
import { formatCurrency, formatDateShort, formatDateRelative } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { PrintButton } from "@/components/ui/PrintButton";
import { ApprovalTimeline } from "@/components/workflow/ApprovalTimeline";
import { WorkflowStatusBanner } from "@/components/workflow/WorkflowStatusBanner";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { ReturnModal } from "@/components/workflow/ReturnModal";
import { getListData } from "@/lib/listPagination";
import { useToast } from "@/components/ui/Toast";
import GenericDocumentsPanel from "@/components/ui/GenericDocumentsPanel";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  approved:                { label: "Approved",              cls: "text-green-700 bg-green-50 border-green-200",   icon: "check_circle" },
  submitted:               { label: "Pending Approval",      cls: "text-amber-700 bg-amber-50 border-amber-200",   icon: "pending" },
  rejected:                { label: "Rejected",              cls: "text-red-700 bg-red-50 border-red-200",         icon: "cancel" },
  draft:                   { label: "Draft",                 cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "edit_note" },
  cancelled:               { label: "Cancelled",             cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "cancel" },
  returned_for_correction: { label: "Returned for Correction", cls: "text-amber-700 bg-amber-50 border-amber-200", icon: "undo" },
  withdrawn:               { label: "Withdrawn",             cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "block" },
  amendment_pending:       { label: "Amendment Pending",     cls: "text-blue-700 bg-blue-50 border-blue-200",     icon: "edit_document" },
};

function apiErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as {
    response?: { data?: { message?: string; errors?: Record<string, string[] | string> } };
  };
  const data = axiosErr?.response?.data;
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0];
    if (typeof first === "string" && first.trim()) return first;
  }
  if (data?.message?.trim()) return data.message;
  return fallback;
}

function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  return formatCurrency(Number(amount), currency?.trim() || "NAD");
}

function requesterInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 bg-neutral-100 rounded" />
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="h-4 w-36 bg-neutral-100 rounded" />
    </div>
  );
}

function SectionIcon({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
      <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
    </div>
  );
}

export default function TravelDetailPage() {
  const { success, error: showErrorToast, info } = useToast();
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);
  const [request, setRequest] = useState<TravelRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [workflowMeta, setWorkflowMeta] = useState<any>(null);
  const { confirm } = useConfirm();

  // Attachments
  const [attachments, setAttachments] = useState<ModuleAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("invitation");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [attachToast, setAttachToast] = useState<string | null>(null);
  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [amendDeparture, setAmendDeparture] = useState("");
  const [amendReturn, setAmendReturn] = useState("");
  const [amendDestination, setAmendDestination] = useState("");
  const [amendPurpose, setAmendPurpose] = useState("");
  const [amendReason, setAmendReason] = useState("");
  const [amendError, setAmendError] = useState<string | null>(null);
  const [dsaRateType, setDsaRateType] = useState(1);
  const [dsaTerminal, setDsaTerminal] = useState("");
  const [dsaWarning, setDsaWarning] = useState<string | null>(null);
  const [dsaSaving, setDsaSaving] = useState(false);
  const [visaStatus, setVisaStatus] = useState("pending");
  const [visaRequired, setVisaRequired] = useState(false);
  const [visaExpiry, setVisaExpiry] = useState("");
  const [visaAppointment, setVisaAppointment] = useState("");
  const [visaNotes, setVisaNotes] = useState("");
  const [visaSaving, setVisaSaving] = useState(false);
  const [itineraryPaste, setItineraryPaste] = useState("");
  const [itineraryPreview, setItineraryPreview] = useState<string | null>(null);
  const [itineraryBusy, setItineraryBusy] = useState(false);
  const [healthVaccReq, setHealthVaccReq] = useState(false);
  const [healthVaccStatus, setHealthVaccStatus] = useState("");
  const [healthProphReq, setHealthProphReq] = useState(false);
  const [healthProphStatus, setHealthProphStatus] = useState("");
  const [healthCost, setHealthCost] = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [healthSaving, setHealthSaving] = useState(false);
  const [procId, setProcId] = useState("");
  const [procReason, setProcReason] = useState("");
  const [procRequired, setProcRequired] = useState(false);
  const [procSaving, setProcSaving] = useState(false);
  const [hotelName, setHotelName] = useState("");
  const [hotelCity, setHotelCity] = useState("");
  const [hotelCheckIn, setHotelCheckIn] = useState("");
  const [hotelCheckOut, setHotelCheckOut] = useState("");
  const [hotelPaidBy, setHotelPaidBy] = useState("sadc_pf");
  const [hotelConfirm, setHotelConfirm] = useState("");
  const [hotelSaving, setHotelSaving] = useState(false);
  const [mileKm, setMileKm] = useState("");
  const [mileRate, setMileRate] = useState("");
  const [mileAirfare, setMileAirfare] = useState("");
  const [mileReason, setMileReason] = useState("");
  const [mileRoute, setMileRoute] = useState("");
  const [mileSaving, setMileSaving] = useState(false);
  const [personalDays, setPersonalDays] = useState<Array<{ date: string; type: "official" | "personal" }>>([]);
  const [personalSaving, setPersonalSaving] = useState(false);
  const [fleet, setFleet] = useState<Array<{ id: number; asset_code: string; name: string; status: string }>>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleAck, setVehicleAck] = useState(false);

  const syncPhase3Fields = (data: TravelRequest | null | undefined) => {
    if (!data) return;
    setHealthVaccReq(Boolean(data.health_vaccination_required));
    setHealthVaccStatus(data.health_vaccination_status ?? "");
    setHealthProphReq(Boolean(data.health_prophylaxis_required));
    setHealthProphStatus(data.health_prophylaxis_status ?? "");
    setHealthCost(data.health_estimated_cost != null ? String(data.health_estimated_cost) : "");
    setHealthNotes(data.health_notes ?? "");
    setProcId(data.procurement_request_id != null ? String(data.procurement_request_id) : "");
    setProcReason(data.procurement_link_reason ?? "");
    setProcRequired(Boolean(data.procurement_link_required));
  };

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setLoading(false);
      setError("Invalid request ID.");
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setAttachToast(null);
    setAttachments([]);
    setAttachmentsLoading(false);

    travelApi.get(id)
      .then((res) => {
        if (!active) return;
        const body = res.data as any;
        const data = body.data ?? body;
        setRequest(data);
        setWorkflowMeta(body.workflow ?? null);
        setDsaRateType(data?.dsa_lines?.[0]?.rate_type ?? 1);
        setDsaTerminal(data?.terminal_comms_total != null ? String(data.terminal_comms_total) : "");
        setVisaRequired(Boolean(data?.visa_required));
        setVisaStatus(data?.visa_status ?? "pending");
        setVisaExpiry(data?.visa_expiry_date ? String(data.visa_expiry_date).slice(0, 10) : "");
        setVisaAppointment(data?.visa_appointment_date ? String(data.visa_appointment_date).slice(0, 10) : "");
        setVisaNotes(data?.visa_notes ?? "");
        syncPhase3Fields(data);
        const days = Array.isArray(data?.official_personal_days) ? data.official_personal_days : [];
        if (days.length > 0) {
          setPersonalDays(days.map((d: any) => ({
            date: String(d.date ?? d).slice(0, 10),
            type: (d.type === "personal" ? "personal" : "official") as "official" | "personal",
          })));
        } else if (data?.departure_date && data?.return_date) {
          const out: Array<{ date: string; type: "official" | "personal" }> = [];
          const start = new Date(String(data.departure_date).slice(0, 10));
          const end = new Date(String(data.return_date).slice(0, 10));
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            out.push({ date: d.toISOString().slice(0, 10), type: "official" });
          }
          setPersonalDays(out);
        }
        setVehicleId(data?.vehicle_asset_id != null ? String(data.vehicle_asset_id) : "");

        setAttachmentsLoading(true);
        travelApi.listAttachments(id)
          .then((res) => {
            if (!active) return;
            setAttachments(getListData<ModuleAttachment>(res.data));
          })
          .catch(() => {
            if (!active) return;
            setAttachments([]);
            setAttachToast("Documents could not be loaded.");
          })
          .finally(() => {
            if (active) setAttachmentsLoading(false);
          });
      })
      .catch(() => {
        if (active) setError("Failed to load travel request.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    travelApi.fleetVehicles()
      .then((r) => {
        if (active) setFleet(getListData<{ id: number; asset_code: string; name: string; status: string }>(r.data));
      })
      .catch(() => {
        if (active) setFleet([]);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const refreshRequest = async () => {
    const res = await travelApi.get(id);
    const body = res.data as any;
    const data = body.data ?? body;
    setRequest(data);
    setWorkflowMeta(body.workflow ?? null);
    setDsaRateType(data?.dsa_lines?.[0]?.rate_type ?? dsaRateType);
    setDsaTerminal(data?.terminal_comms_total != null ? String(data.terminal_comms_total) : "");
    setVisaRequired(Boolean(data?.visa_required));
    setVisaStatus(data?.visa_status ?? "pending");
    setVisaExpiry(data?.visa_expiry_date ? String(data.visa_expiry_date).slice(0, 10) : "");
    setVisaAppointment(data?.visa_appointment_date ? String(data.visa_appointment_date).slice(0, 10) : "");
    setVisaNotes(data?.visa_notes ?? "");
    syncPhase3Fields(data);
  };


  const handleApprove = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      const res = await travelApi.approve(request.id);
      const notified: string[] = (res.data as { notified_approvers?: string[] }).notified_approvers ?? [];
      await refreshRequest();
      if (notified.length > 0) {
        success(`Approved. Notified: ${notified.join(", ")}`);
      } else {
        success("Request fully approved.");
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to approve request."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!request || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await travelApi.reject(request.id, rejectReason.trim());
      await refreshRequest();
      setShowRejectModal(false);
      setRejectReason("");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to reject request."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async (comment: string) => {
    if (!request) return;
    setReturnLoading(true);
    try {
      await travelApi.returnForCorrection(request.id, comment);
      await refreshRequest();
      setShowReturnModal(false);
      success("Request returned to requester for correction.");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to return request."));
    } finally {
      setReturnLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!request) return;
    if (!(await confirm({ title: "Withdraw Request", message: "Withdraw this travel request? This cannot be undone.", variant: "danger" }))) return;
    setActionLoading(true);
    try {
      await travelApi.withdraw(request.id);
      await refreshRequest();
      success("Request withdrawn.");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to withdraw request."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async () => {
    if (!request) return;
    if (!(await confirm({ title: "Resubmit Request", message: "Resubmit this travel request for approval? It will restart from the first step.", variant: "primary" }))) return;
    setActionLoading(true);
    try {
      await travelApi.resubmit(request.id);
      await refreshRequest();
      success("Request resubmitted for approval.");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to resubmit request."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!request) return;
    const reason = window.prompt("Cancellation reason (required):");
    if (!reason?.trim()) return;
    if (!(await confirm({ title: "Cancel Request", message: "Cancel this travel request? Budget reservations will be released where applicable.", variant: "danger" }))) return;
    setActionLoading(true);
    try {
      await travelApi.cancel(request.id, reason.trim());
      await refreshRequest();
      success("Request cancelled.");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to cancel request."));
    } finally {
      setActionLoading(false);
    }
  };

  const openAmendmentModal = () => {
    if (!request) return;
    setAmendDeparture(request.departure_date?.slice(0, 10) ?? "");
    setAmendReturn(request.return_date?.slice(0, 10) ?? "");
    setAmendDestination(request.destination_country ?? "");
    setAmendPurpose(request.purpose ?? "");
    setAmendReason("");
    setAmendError(null);
    setShowAmendmentModal(true);
  };

  const handleRequestAmendment = async () => {
    if (!request) return;
    const changes: Record<string, unknown> = {};
    if (amendDeparture && amendDeparture !== request.departure_date?.slice(0, 10)) {
      changes.departure_date = amendDeparture;
    }
    if (amendReturn && amendReturn !== request.return_date?.slice(0, 10)) {
      changes.return_date = amendReturn;
    }
    if (amendDestination && amendDestination !== request.destination_country) {
      changes.destination_country = amendDestination;
    }
    if (amendPurpose && amendPurpose !== request.purpose) {
      changes.purpose = amendPurpose;
    }
    if (Object.keys(changes).length === 0) {
      setAmendError("Change at least one field before submitting an amendment.");
      return;
    }
    setActionLoading(true);
    setAmendError(null);
    try {
      await travelApi.requestAmendment(request.id, {
        changes,
        reason: amendReason.trim() || undefined,
      });
      setShowAmendmentModal(false);
      await refreshRequest();
      success("Amendment submitted for approval.");
    } catch (err) {
      setAmendError(apiErrorMessage(err, "Failed to submit amendment. Approved requests cannot be edited silently."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveAmendment = async (amendment: TravelAmendment) => {
    if (!(await confirm({
      title: "Approve Amendment",
      message: "Apply the proposed changes to this approved travel request?",
      variant: "primary",
    }))) return;
    setActionLoading(true);
    try {
      await travelApi.approveAmendment(amendment.id);
      await refreshRequest();
      success("Amendment approved and applied.");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to approve amendment."));
    } finally {
      setActionLoading(false);
    }
  };

  const runPostApproval = async (label: string, fn: () => Promise<unknown>) => {
    if (!request) return;
    if (!(await confirm({ title: label, message: `Confirm: ${label}?`, variant: "primary" }))) return;
    setActionLoading(true);
    try {
      await fn();
      await refreshRequest();
      success(`${label} completed.`);
    } catch (err) {
      setError(apiErrorMessage(err, `Failed: ${label}. Check required documents and approval status.`));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveDsa = async () => {
    if (!request) return;
    setDsaSaving(true);
    setDsaWarning(null);
    try {
      const res = await travelApi.saveDsa(request.id, {
        rate_type: dsaRateType,
        terminal_comms_total: dsaTerminal ? Number(dsaTerminal) : 0,
      });
      const warning = (res.data as { warning?: { expected_official_days?: number; payable_line_count?: number } }).warning;
      if (warning) {
        setDsaWarning(
          `Day count variance: expected ${warning.expected_official_days} official days, payable lines ${warning.payable_line_count}.`
        );
      }
      await refreshRequest();
      success("DSA calculation saved (Finance Rate Types 1/2/3).");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save DSA. Only Finance may calculate DSA, and not on their own request."));
    } finally {
      setDsaSaving(false);
    }
  };

  const handleSaveVisa = async () => {
    if (!request) return;
    setVisaSaving(true);
    try {
      await travelApi.updateVisa(request.id, {
        visa_required: visaRequired,
        visa_status: visaRequired ? visaStatus : "not_required",
        visa_expiry_date: visaExpiry || null,
        visa_appointment_date: visaAppointment || null,
        visa_notes: visaNotes || null,
      });
      await refreshRequest();
      success("Visa details updated.");
    } catch {
      setError("Failed to update visa details.");
    } finally {
      setVisaSaving(false);
    }
  };

  const handlePreviewItinerary = async () => {
    if (!request || !itineraryPaste.trim()) return;
    setItineraryBusy(true);
    setItineraryPreview(null);
    try {
      const res = await travelApi.parseItinerary(request.id, itineraryPaste);
      const data = res.data.data;
      if (!data.parseable) {
        setItineraryPreview(data.message ?? "Could not parse itinerary.");
      } else {
        setItineraryPreview(`Parsed ${data.legs.length} leg(s). Apply to replace current itinerary.`);
      }
    } catch {
      setError("Failed to parse itinerary.");
    } finally {
      setItineraryBusy(false);
    }
  };

  const handleApplyItinerary = async () => {
    if (!request || !itineraryPaste.trim()) return;
    setItineraryBusy(true);
    try {
      await travelApi.applyItinerary(request.id, itineraryPaste);
      await refreshRequest();
      success("Itinerary legs applied (versioned).");
      setItineraryPreview(null);
    } catch {
      setError("Failed to apply itinerary. Unparseable text is rejected on apply.");
    } finally {
      setItineraryBusy(false);
    }
  };

  const handleSaveHealth = async () => {
    if (!request) return;
    setHealthSaving(true);
    try {
      await travelApi.updateHealth(request.id, {
        health_vaccination_required: healthVaccReq,
        health_vaccination_status: healthVaccStatus || null,
        health_prophylaxis_required: healthProphReq,
        health_prophylaxis_status: healthProphStatus || null,
        health_estimated_cost: healthCost ? Number(healthCost) : null,
        health_notes: healthNotes || null,
      });
      await refreshRequest();
      success("Health pack updated.");
    } catch {
      setError("Failed to update health pack (restricted to HR/Admin).");
    } finally {
      setHealthSaving(false);
    }
  };

  const handleSaveProcurementLink = async () => {
    if (!request) return;
    setProcSaving(true);
    try {
      await travelApi.updateProcurementLink(request.id, {
        procurement_request_id: procId ? Number(procId) : null,
        procurement_link_reason: procReason || null,
        procurement_link_required: procRequired,
      });
      await refreshRequest();
      success("Procurement link updated.");
    } catch {
      setError("Failed to update procurement link.");
    } finally {
      setProcSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-4 w-48 bg-neutral-100 rounded animate-pulse" />
        <div className="h-7 w-64 bg-neutral-100 rounded animate-pulse" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-[20px] flex-shrink-0 mt-0.5">error_outline</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Error loading request</p>
            <p className="text-sm text-red-600 mt-0.5">{error ?? "Request not found."}</p>
          </div>
        </div>
        <Link href="/travel" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Travel Requests
        </Link>
      </div>
    );
  }

  const s = statusConfig[request.status] ?? statusConfig.draft;
  const itineraries = request.itineraries ?? [];
  const approvalRequest = (request as any).approval_request;
  const currentStep = approvalRequest?.workflow?.steps?.[approvalRequest?.current_step_index];
  const canReturn = approvalRequest?.status === "pending" && currentStep?.allow_return;
  const isReturnedForCorrection = request.status === "returned_for_correction";
  const preparedBy = (request as any).prepared_by_user ?? (request as any).prepared_by;
  const preparedOnBehalf = (request as any).prepared_on_behalf_of_user ?? (request as any).prepared_on_behalf_of;
  const currentlyWith = workflowMeta?.currently_with
    ? (Array.isArray(workflowMeta.currently_with)
        ? workflowMeta.currently_with.map((u: any) => u?.name ?? u).filter(Boolean).join(", ")
        : String(workflowMeta.currently_with))
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {(request as any).prepared_on_behalf_of && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Prepared on behalf of {(request as any).prepared_on_behalf_of?.name ?? preparedOnBehalf?.name ?? "principal"}
          {(request as any).prepared_by?.name || preparedBy?.name
            ? ` by ${(request as any).prepared_by?.name ?? preparedBy?.name}`
            : ""}
        </div>
      )}

      <WorkflowStatusBanner
        status={request.status}
        currentStage={
          workflowMeta?.current_stage_label ??
          workflowMeta?.current_stage?.label ??
          (typeof workflowMeta?.current_stage === "string" ? workflowMeta.current_stage : null) ??
          request.status
        }
        currentHolder={currentlyWith || "—"}
        extras={[
          {
            label: "Next stage",
            value: String(
              workflowMeta?.next_stage_label ??
                workflowMeta?.next_step?.label ??
                (typeof workflowMeta?.next_stage === "string" ? workflowMeta.next_stage : null) ??
                "—",
            ),
          },
          { label: "Submitted on", value: request.submitted_at ? formatDateShort(request.submitted_at) : "—" },
        ]}
      />

      {/* Breadcrumb + title */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-neutral-400 mb-3">
          <Link href="/travel" className="hover:text-primary transition-colors font-medium">Travel</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="font-mono text-neutral-500">{request.reference_number}</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{request.purpose}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-neutral-400">
                <span className="material-symbols-outlined text-[13px]">location_on</span>
                {[request.destination_city, request.destination_country].filter(Boolean).join(", ") || request.destination_country}
              </span>
              <span className="text-neutral-200">·</span>
              <span className="flex items-center gap-1 text-xs text-neutral-400">
                <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                {formatDateShort(request.departure_date)} → {formatDateShort(request.return_date)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {s.label}
            </span>
            {request.status === "approved" && (
              <>
                <Link
                  href={`/travel/${request.id}/certificate`}
                  className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                  Certificate
                </Link>
                <button
                  type="button"
                  onClick={openAmendmentModal}
                  disabled={actionLoading}
                  data-testid="travel-request-amendment"
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">edit_document</span>
                  Request amendment
                </button>
              </>
            )}
            {request.status === "draft" && (
              <>
                <Link
                  href={`/travel/create?edit=${request.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  Edit in wizard
                </Link>
                <button
                  onClick={async () => {
                    if (!(await confirm({ title: "Submit Request", message: "Submit this travel request for approval?", variant: "primary" }))) return;
                    setActionLoading(true);
                    try {
                      await travelApi.submit(request.id);
                      await refreshRequest();
                      success("Request submitted.");
                    } catch (err: unknown) {
                      const axiosErr = err as { response?: { data?: { errors?: { conflicts?: string[] }; message?: string } } };
                      const conflicts = axiosErr?.response?.data?.errors?.conflicts;
                      if (Array.isArray(conflicts) && conflicts.length) {
                        const note = window.prompt(
                          `Conflicts detected:\n${conflicts.join("\n")}\n\nEnter resolution note to acknowledge and submit, or Cancel.`,
                          "Reviewed with supervisor"
                        );
                        if (note) {
                          try {
                            await travelApi.submit(request.id, {
                              acknowledge_conflicts: true,
                              conflict_resolution_note: note,
                            });
                            await refreshRequest();
                            success("Submitted with conflict acknowledgement.");
                          } catch (ackErr) {
                            setError(apiErrorMessage(ackErr, "Failed to submit after acknowledging conflicts."));
                          }
                        } else {
                          setError(conflicts.join(" "));
                        }
                      } else {
                        setError(apiErrorMessage(err, "Failed to submit."));
                      }
                    } finally { setActionLoading(false); }
                  }}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">send</span>
                  Submit
                </button>
                <button
                  onClick={async () => {
                    if (!(await confirm({ title: "Delete Draft", message: "Delete this draft travel request?", variant: "danger" }))) return;
                    try {
                      await travelApi.delete(request.id);
                      router.push("/travel");
                    } catch (err) { setError(apiErrorMessage(err, "Failed to delete.")); }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                  Delete
                </button>
              </>
            )}
            {isReturnedForCorrection && (
              <Link
                href={`/travel/create?edit=${request.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">edit</span>
                Fix in wizard
              </Link>
            )}
            {/* Withdraw: visible when submitted/pending, requester can act */}
            {request.status === "submitted" && approvalRequest?.status === "pending" && (
              <button
                onClick={handleWithdraw}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">block</span>
                Withdraw
              </button>
            )}
            {["approved", "submitted", "amendment_pending"].includes(request.status) && (
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">cancel</span>
                Cancel
              </button>
            )}
            {/* Resubmit: visible when returned for correction */}
            {isReturnedForCorrection && (
              <button
                onClick={handleResubmit}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Resubmit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Returned for correction banner */}
      {isReturnedForCorrection && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <span className="material-symbols-outlined text-[18px] text-amber-600 flex-shrink-0 mt-0.5">undo</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Returned for Correction</p>
            <p className="text-xs text-amber-700 mt-0.5">This request was returned. Make the required corrections and resubmit.</p>
          </div>
        </div>
      )}

      {request.status === "amendment_pending" && (
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3" data-testid="travel-amendment-pending-banner">
          <span className="material-symbols-outlined text-[18px] text-blue-600 flex-shrink-0 mt-0.5">edit_document</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-800">Amendment pending approval</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Controlled post-approval changes are awaiting review. Silent edits remain blocked.
            </p>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <SectionIcon icon="timeline" color="text-primary" bg="bg-primary/10" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Request Progress</h3>
          </div>
          <PrintButton className="text-xs" />
        </div>
        <StatusTimeline
          steps={[
            { key: "draft",     label: "Draft",     icon: "edit_note",    completedAt: request.submitted_at ? request.submitted_at : undefined },
            { key: "submitted", label: "Submitted",  icon: "send",         completedAt: request.submitted_at },
            { key: "approved",  label: "Approved",   icon: "check_circle", completedAt: request.approved_at },
          ]}
          currentStatus={request.status}
          rejectedAt={request.status === "rejected" ? (request.approved_at ?? request.submitted_at) : null}
          rejectionReason={request.rejection_reason}
        />
      </div>

      {/* Approval Timeline */}
      <ApprovalTimeline request={approvalRequest} />

      <AuditTimeline
        subjectType="TravelRequest"
        subjectId={request.id}
        title="Platform Audit Trail"
      />

      {/* Requester */}
      {request.requester && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="person" color="text-primary" bg="bg-primary/10" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Requester</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">
                {requesterInitials(request.requester.name)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900">{request.requester.name?.trim() || "Unknown requester"}</p>
              <p className="text-xs text-neutral-400">{[request.requester.job_title, request.requester.employee_number].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Trip Details */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="flight_takeoff" color="text-primary" bg="bg-primary/10" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Trip Details</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">location_on</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Destination</p>
            </div>
            <p className="font-semibold text-neutral-900">{[request.destination_city, request.destination_country].filter(Boolean).join(", ") || request.destination_country || "—"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">date_range</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Travel Period</p>
            </div>
            <p className="font-semibold text-neutral-900">{formatDateShort(request.departure_date)} → {formatDateShort(request.return_date)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">currency_exchange</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Currency</p>
            </div>
            <p className="font-semibold text-neutral-900">{request.currency || "—"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">payments</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Estimated DSA</p>
            </div>
            <p className="text-lg font-bold text-primary">{formatMoney(request.estimated_dsa, request.currency)}</p>
          </div>
        </div>
        {request.justification && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">description</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Justification</p>
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed">{request.justification}</p>
          </div>
        )}
      </div>

      {/* Itinerary */}
      {itineraries.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="route" color="text-teal-600" bg="bg-teal-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Itinerary</h3>
            <span className="ml-auto text-xs font-semibold text-neutral-400">{itineraries.length} leg{itineraries.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2.5">
            {itineraries.map((leg, i) => (
              <div key={leg.id} className="flex items-center gap-4 rounded-xl bg-neutral-50 border border-neutral-100 p-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white border border-neutral-200 shadow-sm">
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    {leg.transport_mode === "flight" ? "flight" : leg.transport_mode === "road" ? "directions_car" : "train"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{leg.from_location} → {leg.to_location}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{formatDateShort(leg.travel_date)} · {leg.days_count} day{leg.days_count !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wide">DSA</p>
                  <p className="text-sm font-bold text-neutral-900">
                    {formatMoney(
                      (leg as { calculated_dsa?: number | null }).calculated_dsa ??
                        (Number(leg.dsa_rate ?? 0) * Number(leg.days_count ?? 0)),
                      request.currency,
                    )}
                  </p>
                </div>
                {i < itineraries.length - 1 && (
                  <div className="absolute left-7 mt-9 h-2.5 w-px bg-neutral-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Decision */}
      {request.status === "submitted" && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="gavel" color="text-amber-600" bg="bg-amber-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Approval Decision</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">Review the travel request details above and take an action.</p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {actionLoading ? "Processing…" : "Approve Request"}
            </button>
            {canReturn && (
              <button
                onClick={() => setShowReturnModal(true)}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">undo</span>
                Return
              </button>
            )}
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Controlled amendments */}
      {((request.amendments?.length ?? 0) > 0 || request.status === "amendment_pending") && (
        <div className="card p-5" data-testid="travel-amendments-panel">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="edit_document" color="text-blue-600" bg="bg-blue-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Amendments</h3>
          </div>
          <div className="space-y-3">
            {(request.amendments ?? []).slice().reverse().map((a) => (
              <div key={a.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3.5 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900 capitalize">{a.status.replace(/_/g, " ")}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {a.reason || "No reason provided"}
                      {a.creator?.name ? ` · by ${a.creator.name}` : ""}
                    </p>
                    <p className="text-xs text-neutral-600 mt-2 font-mono break-all">
                      {JSON.stringify(a.proposed_changes)}
                    </p>
                    {a.original_snapshot && (
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Original snapshot preserved
                      </p>
                    )}
                  </div>
                  {a.status === "submitted" && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApproveAmendment(a)}
                      data-testid={`travel-approve-amendment-${a.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finance DSA calculation panel */}
      {request.status !== "draft" && request.status !== "cancelled" && request.status !== "withdrawn" && (
        <div className="card p-5" data-testid="travel-finance-dsa-panel">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="calculate" color="text-emerald-700" bg="bg-emerald-50" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Finance DSA calculation</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Authoritative Rate Types 1/2/3. Traveller estimate {formatMoney(request.estimated_dsa, request.currency)} is not binding.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <label className="text-xs text-neutral-600">
              Rate type
              <select
                className="form-input mt-1 w-full text-sm"
                value={dsaRateType}
                onChange={(e) => setDsaRateType(Number(e.target.value))}
                data-testid="travel-dsa-rate-type"
              >
                <option value={1}>Type 1 — Acc + meals + incidentals</option>
                <option value={2}>Type 2 — Meals + incidentals</option>
                <option value={3}>Type 3 — Incidentals only</option>
              </select>
            </label>
            <label className="text-xs text-neutral-600">
              Terminal / comms total
              <input
                className="form-input mt-1 w-full text-sm"
                type="number"
                min={0}
                step="0.01"
                value={dsaTerminal}
                onChange={(e) => setDsaTerminal(e.target.value)}
                data-testid="travel-dsa-terminal"
              />
            </label>
            <div className="text-xs text-neutral-600">
              <p>Finance DSA total</p>
              <p className="mt-2 text-lg font-semibold text-neutral-900" data-testid="travel-finance-dsa-total">
                {request.finance_dsa_total != null ? `${request.finance_dsa_total} ${request.currency}` : "—"}
              </p>
              <p className="text-neutral-400 mt-1 capitalize">{request.finance_status ?? "awaiting calculation"}</p>
            </div>
          </div>
          {(request.dsa_lines?.length ?? 0) > 0 && (
            <div className="overflow-x-auto mb-3">
              <table className="data-table w-full text-xs">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Rate</th>
                    <th>Meal ded.</th>
                    <th>Payable</th>
                    <th>Personal</th>
                  </tr>
                </thead>
                <tbody>
                  {request.dsa_lines!.map((line) => (
                    <tr key={`${line.id ?? line.date}-${line.rate_type}`}>
                      <td>{String(line.date).slice(0, 10)}</td>
                      <td>{line.rate_type}</td>
                      <td>{line.daily_rate}</td>
                      <td>{line.meal_deduction}</td>
                      <td>{line.daily_payable ?? "—"}</td>
                      <td>{line.is_personal ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {dsaWarning && (
            <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">{dsaWarning}</div>
          )}
          <button
            type="button"
            disabled={dsaSaving || actionLoading}
            onClick={handleSaveDsa}
            data-testid="travel-save-dsa"
            className="btn-primary py-2 px-4 text-xs"
          >
            {dsaSaving ? "Saving…" : "Calculate & save DSA"}
          </button>
        </div>
      )}

      {/* Visa status panel */}
      <div className="card p-5" data-testid="travel-visa-panel">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="badge" color="text-violet-700" bg="bg-violet-50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Visa status &amp; reminders</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={visaRequired} onChange={(e) => setVisaRequired(e.target.checked)} />
            Visa required
          </label>
          <label className="text-xs text-neutral-600">
            Status
            <select className="form-input mt-1 w-full text-sm" value={visaStatus} onChange={(e) => setVisaStatus(e.target.value)} disabled={!visaRequired}>
              <option value="pending">Pending</option>
              <option value="appointment_scheduled">Appointment scheduled</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
              <option value="not_required">Not required</option>
            </select>
          </label>
          <label className="text-xs text-neutral-600">
            Appointment date
            <input className="form-input mt-1 w-full text-sm" type="date" value={visaAppointment} onChange={(e) => setVisaAppointment(e.target.value)} />
          </label>
          <label className="text-xs text-neutral-600">
            Expiry date
            <input className="form-input mt-1 w-full text-sm" type="date" value={visaExpiry} onChange={(e) => setVisaExpiry(e.target.value)} />
          </label>
          <label className="text-xs text-neutral-600 sm:col-span-2">
            Notes
            <textarea className="form-input mt-1 w-full text-sm" rows={2} value={visaNotes} onChange={(e) => setVisaNotes(e.target.value)} />
          </label>
        </div>
        <button type="button" disabled={visaSaving} onClick={handleSaveVisa} className="btn-secondary py-2 px-4 text-xs" data-testid="travel-save-visa">
          {visaSaving ? "Saving…" : "Save visa details"}
        </button>
      </div>

      {/* Itinerary paste / ICS parser */}
      <div className="card p-5" data-testid="travel-itinerary-parse-panel">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="flight_takeoff" color="text-sky-700" bg="bg-sky-50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Paste airline itinerary (v{request.itinerary_version ?? 0})
          </h3>
        </div>
        <p className="text-xs text-neutral-500 mb-2">
          Paste confirmation text, ICS, or lines like <code>Flight BA123 WDH-JNB 2026-08-10</code>. No GDS — fail soft if unparseable.
        </p>
        <textarea
          className="form-input w-full text-sm mb-2 font-mono"
          rows={4}
          value={itineraryPaste}
          onChange={(e) => setItineraryPaste(e.target.value)}
          placeholder="Flight BA123 WDH-JNB 2026-08-10"
          data-testid="travel-itinerary-paste"
        />
        {itineraryPreview && <p className="text-xs text-neutral-600 mb-2">{itineraryPreview}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={itineraryBusy} onClick={handlePreviewItinerary} className="btn-secondary py-2 px-4 text-xs">
            Preview parse
          </button>
          <button type="button" disabled={itineraryBusy} onClick={handleApplyItinerary} className="btn-primary py-2 px-4 text-xs" data-testid="travel-apply-itinerary">
            {itineraryBusy ? "Working…" : "Apply & replace legs"}
          </button>
        </div>
      </div>

      {/* Health pack */}
      <div className="card p-5" data-testid="travel-health-panel">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="medical_services" color="text-rose-700" bg="bg-rose-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Travel health pack</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={healthVaccReq} onChange={(e) => setHealthVaccReq(e.target.checked)} />
              Vaccination required
            </label>
            <label className="text-xs text-neutral-600">
              Vaccination status
              <input className="form-input mt-1 w-full text-sm" value={healthVaccStatus} onChange={(e) => setHealthVaccStatus(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={healthProphReq} onChange={(e) => setHealthProphReq(e.target.checked)} />
              Prophylaxis required
            </label>
            <label className="text-xs text-neutral-600">
              Prophylaxis status
              <input className="form-input mt-1 w-full text-sm" value={healthProphStatus} onChange={(e) => setHealthProphStatus(e.target.value)} />
            </label>
            <label className="text-xs text-neutral-600">
              Estimated cost
              <input className="form-input mt-1 w-full text-sm" type="number" value={healthCost} onChange={(e) => setHealthCost(e.target.value)} />
            </label>
            <label className="text-xs text-neutral-600 sm:col-span-2">
              Notes
              <textarea className="form-input mt-1 w-full text-sm" rows={2} value={healthNotes} onChange={(e) => setHealthNotes(e.target.value)} />
            </label>
          </div>
          <button type="button" disabled={healthSaving} onClick={handleSaveHealth} className="btn-secondary py-2 px-4 text-xs" data-testid="travel-save-health">
            {healthSaving ? "Saving…" : "Save health pack"}
          </button>
        </div>

      {/* Accommodation + mileage + travel pack */}
      <div className="card p-5" data-testid="travel-accommodation-panel">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="hotel" color="text-indigo-700" bg="bg-indigo-50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Accommodation records</h3>
        </div>
        {(request as any).accommodations?.length > 0 && (
          <ul className="mb-3 space-y-2 text-sm">
            {(request as any).accommodations.map((a: any) => (
              <li key={a.id} className="rounded border border-neutral-100 px-3 py-2">
                <strong>{a.hotel_name}</strong>
                {a.city ? ` · ${a.city}` : ""}
                {a.confirmation_number ? ` · #${a.confirmation_number}` : ""}
                <span className="block text-xs text-neutral-500">
                  {a.check_in || "?"} → {a.check_out || "?"} · paid by {a.paid_by || "n/a"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <label className="text-xs text-neutral-600">Hotel
            <input className="form-input mt-1 w-full text-sm" value={hotelName} onChange={(e) => setHotelName(e.target.value)} />
          </label>
          <label className="text-xs text-neutral-600">City
            <input className="form-input mt-1 w-full text-sm" value={hotelCity} onChange={(e) => setHotelCity(e.target.value)} />
          </label>
          <label className="text-xs text-neutral-600">Check-in
            <input type="date" className="form-input mt-1 w-full text-sm" value={hotelCheckIn} onChange={(e) => setHotelCheckIn(e.target.value)} />
          </label>
          <label className="text-xs text-neutral-600">Check-out
            <input type="date" className="form-input mt-1 w-full text-sm" value={hotelCheckOut} onChange={(e) => setHotelCheckOut(e.target.value)} />
          </label>
          <label className="text-xs text-neutral-600">Paid by
            <select className="form-input mt-1 w-full text-sm" value={hotelPaidBy} onChange={(e) => setHotelPaidBy(e.target.value)}>
              <option value="sadc_pf">SADC PF</option>
              <option value="host">Host</option>
              <option value="donor">Donor</option>
              <option value="self">Self</option>
            </select>
          </label>
          <label className="text-xs text-neutral-600">Confirmation #
            <input className="form-input mt-1 w-full text-sm" value={hotelConfirm} onChange={(e) => setHotelConfirm(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          disabled={hotelSaving || !hotelName.trim()}
          className="btn-secondary py-2 px-4 text-xs"
          data-testid="travel-save-accommodation"
          onClick={async () => {
            if (!request) return;
            setHotelSaving(true);
            try {
              await travelApi.addAccommodation(request.id, {
                hotel_name: hotelName,
                city: hotelCity || undefined,
                check_in: hotelCheckIn || undefined,
                check_out: hotelCheckOut || undefined,
                paid_by: hotelPaidBy,
                confirmation_number: hotelConfirm || undefined,
              });
              setHotelName(""); setHotelCity(""); setHotelCheckIn(""); setHotelCheckOut(""); setHotelConfirm("");
              await refreshRequest();
              success("Accommodation recorded.");
            } catch {
              setError("Failed to save accommodation.");
            } finally {
              setHotelSaving(false);
            }
          }}
        >
          {hotelSaving ? "Saving…" : "Add accommodation"}
        </button>
      </div>

      <div className="card p-5" data-testid="travel-mileage-panel">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="directions_car" color="text-slate-700" bg="bg-slate-50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Private vehicle mileage comparison</h3>
        </div>
        {(request as any).mileage_reimbursement_estimate != null && (
          <p className="text-xs text-neutral-600 mb-3">
            Estimate {(request as any).mileage_reimbursement_estimate} · capped {(request as any).reimbursement_capped_amount}
            {(request as any).mileage_exceeds_airfare ? " · exceeds equivalent airfare" : ""}
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <label className="text-xs text-neutral-600">Estimated km
            <input type="number" className="form-input mt-1 w-full text-sm" value={mileKm} onChange={(e) => setMileKm(e.target.value)} />
          </label>
          <label className="text-xs text-neutral-600">Rate / km
            <input type="number" className="form-input mt-1 w-full text-sm" value={mileRate} onChange={(e) => setMileRate(e.target.value)} />
          </label>
          <label className="text-xs text-neutral-600">Equivalent airfare
            <input type="number" className="form-input mt-1 w-full text-sm" value={mileAirfare} onChange={(e) => setMileAirfare(e.target.value)} />
          </label>
          <label className="text-xs text-neutral-600">Route
            <input className="form-input mt-1 w-full text-sm" value={mileRoute} onChange={(e) => setMileRoute(e.target.value)} />
          </label>
          <label className="text-xs text-neutral-600 sm:col-span-2">Reason PF vehicle not used
            <textarea className="form-input mt-1 w-full text-sm" rows={2} value={mileReason} onChange={(e) => setMileReason(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          disabled={mileSaving || !mileKm || !mileRate}
          className="btn-secondary py-2 px-4 text-xs"
          data-testid="travel-save-mileage"
          onClick={async () => {
            if (!request) return;
            setMileSaving(true);
            try {
              await travelApi.updateVehicleMileage(request.id, {
                estimated_kilometres: Number(mileKm),
                mileage_rate_per_km: Number(mileRate),
                equivalent_airfare: mileAirfare ? Number(mileAirfare) : undefined,
                private_vehicle_reason: mileReason || undefined,
                private_vehicle_route: mileRoute || undefined,
              });
              await refreshRequest();
              success("Mileage comparison saved.");
            } catch {
              setError("Failed to save mileage comparison.");
            } finally {
              setMileSaving(false);
            }
          }}
        >
          {mileSaving ? "Saving…" : "Save mileage comparison"}
        </button>
      </div>

      {request.status === "approved" && request.booking_committed_at && (
        <div className="card p-5" data-testid="travel-pack-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Traveller travel pack</h3>
              <p className="text-xs text-neutral-500 mt-1">ZIP with requisition PDF, itinerary summary, accommodations, and attachments.</p>
            </div>
            <a
              href={travelApi.travelPackUrl(request.id)}
              className="btn-primary py-2 px-4 text-xs"
              data-testid="travel-download-pack"
            >
              Download pack
            </a>
          </div>
        </div>
      )}

      {/* Procurement soft link */}
      <div className="card p-5" data-testid="travel-procurement-link-panel">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="shopping_cart" color="text-amber-700" bg="bg-amber-50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Procurement / travel-agent link</h3>
        </div>
        {request.procurement_link_suggested && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
            Estimated costs suggest linking a procurement request for booking (soft link — not a marketplace).
          </p>
        )}
        {request.procurement_request && (
          <p className="text-xs text-neutral-600 mb-2">
            Linked: <strong>{request.procurement_request.reference_number}</strong>
            {request.procurement_request.title ? ` — ${request.procurement_request.title}` : ""}
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <label className="text-xs text-neutral-600">
            Procurement request ID
            <input className="form-input mt-1 w-full text-sm" value={procId} onChange={(e) => setProcId(e.target.value)} placeholder="e.g. 42" data-testid="travel-proc-id" />
          </label>
          <label className="flex items-center gap-2 text-sm mt-5">
            <input type="checkbox" checked={procRequired} onChange={(e) => setProcRequired(e.target.checked)} />
            Link required by threshold
          </label>
          <label className="text-xs text-neutral-600 sm:col-span-2">
            Reason
            <textarea className="form-input mt-1 w-full text-sm" rows={2} value={procReason} onChange={(e) => setProcReason(e.target.value)} />
          </label>
        </div>
        <button type="button" disabled={procSaving} onClick={handleSaveProcurementLink} className="btn-secondary py-2 px-4 text-xs" data-testid="travel-save-procurement-link">
          {procSaving ? "Saving…" : "Save procurement link"}
        </button>
      </div>

      {["draft", "returned_for_correction", "submitted", "resubmitted", "approved"].includes(request.status) && personalDays.length > 0 && (
        <div className="card p-5" data-testid="travel-personal-days-editor">
          <div className="flex items-center gap-3 mb-3">
            <SectionIcon icon="event_available" color="text-indigo-600" bg="bg-indigo-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Official vs personal days</h3>
          </div>
          <p className="text-xs text-neutral-500 mb-3">Mark days that are personal (no DSA). Official days remain payable.</p>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {personalDays.map((day, idx) => (
              <label key={day.date} className="flex items-center justify-between gap-3 text-sm border-b border-neutral-50 py-1.5">
                <span className="font-mono text-xs text-neutral-600">{day.date}</span>
                <select
                  className="form-input text-xs py-1"
                  value={day.type}
                  onChange={(e) => {
                    const next = [...personalDays];
                    next[idx] = { ...day, type: e.target.value as "official" | "personal" };
                    setPersonalDays(next);
                  }}
                >
                  <option value="official">Official</option>
                  <option value="personal">Personal</option>
                </select>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={personalSaving}
            className="btn-secondary py-2 px-4 text-xs mt-3"
            onClick={async () => {
              setPersonalSaving(true);
              try {
                await travelApi.updatePersonalDays(request.id, personalDays);
                await refreshRequest();
                success("Personal / official days saved");
              } catch {
                showErrorToast("Failed to save personal days");
              } finally {
                setPersonalSaving(false);
              }
            }}
          >
            {personalSaving ? "Saving…" : "Save day marking"}
          </button>
        </div>
      )}

      {(request.status === "approved" || request.vehicle_type === "sadcpf") && (
        <div className="card p-5" data-testid="travel-vehicle-assign">
          <div className="flex items-center gap-3 mb-3">
            <SectionIcon icon="directions_car" color="text-slate-700" bg="bg-slate-100" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Fleet vehicle assignment</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-neutral-600">Vehicle
              <select className="form-input mt-1 w-full text-sm" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">Select fleet asset…</option>
                {fleet.map((v) => (
                  <option key={v.id} value={v.id}>{v.asset_code} — {v.name} ({v.status})</option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 text-xs text-neutral-600 pb-2">
              <input type="checkbox" checked={vehicleAck} onChange={(e) => setVehicleAck(e.target.checked)} />
              Acknowledge overlapping assignment conflicts
            </label>
          </div>
          <button
            type="button"
            disabled={vehicleSaving || !vehicleId}
            className="btn-secondary py-2 px-4 text-xs mt-3"
            onClick={async () => {
              setVehicleSaving(true);
              try {
                await travelApi.assignVehicle(request.id, {
                  vehicle_asset_id: Number(vehicleId),
                  acknowledge_conflicts: vehicleAck,
                  conflict_resolution_note: vehicleAck ? "Admin acknowledged vehicle conflict" : undefined,
                });
                await refreshRequest();
                success("Vehicle assigned");
              } catch (e: any) {
                const conflicts = e?.response?.data?.errors?.vehicle_conflicts;
                success(Array.isArray(conflicts) ? conflicts.join(" ") : "Vehicle assign failed (check conflicts)");
              } finally {
                setVehicleSaving(false);
              }
            }}
          >
            {vehicleSaving ? "Assigning…" : "Assign vehicle"}
          </button>
        </div>
      )}

      {/* Post-approval lifecycle (booking gate, return, retirement) */}
      {(request.status === "approved" || request.status === "amendment_pending" || request.returned_at || request.booking_committed_at) && (
        <div className="card p-5" data-testid="travel-post-approval-actions">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="flight_land" color="text-teal-600" bg="bg-teal-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Post-approval actions</h3>
          </div>
          <p className="text-xs text-neutral-500 mb-3">
            Booking requires SG approval (or audited emergency). Retirement needs a mission report attachment.
          </p>
          <div className="flex flex-wrap gap-2">
            {!request.director_finance_confirmed_at && request.status === "approved" && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => runPostApproval("Confirm funds", () => travelApi.confirmFunds(request.id))}
                className="btn-secondary py-2 px-3 text-xs"
              >
                Confirm funds
              </button>
            )}
            {!request.booking_committed_at && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => runPostApproval("Mark booked", () => travelApi.markBooked(request.id))}
                className="btn-secondary py-2 px-3 text-xs"
              >
                Mark booked
              </button>
            )}
            {request.status === "approved" && !request.returned_at && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => runPostApproval("Mark returned", () => travelApi.markReturned(request.id))}
                className="btn-secondary py-2 px-3 text-xs"
              >
                Mark returned
              </button>
            )}
            {request.returned_at && request.retirement_status !== "completed" && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => runPostApproval("Complete retirement", () => travelApi.completeRetirement(request.id))}
                className="btn-primary py-2 px-3 text-xs"
              >
                Complete retirement
              </button>
            )}
            {request.returned_at && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  runPostApproval("Create linked imprest", async () => {
                    const res = await travelApi.linkImprest(request.id, {
                      amount_requested: request.finance_dsa_total ?? request.estimated_dsa ?? undefined,
                      purpose: `Travel retirement — ${request.reference_number}`,
                    });
                    const imprestId = res.data.data?.id;
                    if (imprestId) {
                      window.location.href = `/imprest/${imprestId}`;
                    }
                    return res;
                  })
                }
                className="btn-secondary py-2 px-3 text-xs"
                data-testid="travel-link-imprest"
              >
                Create / link imprest
              </button>
            )}
            {(request.imprest_requests?.length ?? 0) > 0 && (
              <div className="w-full text-xs text-neutral-600 mt-1">
                Linked imprests:{" "}
                {(request.imprest_requests ?? []).map((imp) => (
                  <a key={imp.id} href={`/imprest/${imp.id}`} className="text-primary mr-2 underline">
                    {imp.reference_number ?? `#${imp.id}`}
                  </a>
                ))}
              </div>
            )}
          </div>
          {(request.booking_committed_at || request.returned_at || request.retirement_due_at) && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-neutral-600">
              {request.booking_committed_at && (
                <div>
                  <dt className="text-neutral-400">Booked</dt>
                  <dd className="font-medium">{formatDateShort(request.booking_committed_at)}</dd>
                </div>
              )}
              {request.returned_at && (
                <div>
                  <dt className="text-neutral-400">Returned</dt>
                  <dd className="font-medium">{formatDateShort(request.returned_at)}</dd>
                </div>
              )}
              {request.retirement_due_at && (
                <div>
                  <dt className="text-neutral-400">Retirement due</dt>
                  <dd className="font-medium">{formatDateShort(request.retirement_due_at)}</dd>
                </div>
              )}
              {request.retirement_status && (
                <div>
                  <dt className="text-neutral-400">Retirement status</dt>
                  <dd className="font-medium capitalize">{request.retirement_status}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}

      {/* Attachments */}
      <GenericDocumentsPanel
        documents={attachments}
        documentTypes={TRAVEL_DOCUMENT_TYPES}
        defaultType={uploadDocType}
        loading={attachmentsLoading}
        uploading={uploadLoading}
        onUpload={async (file, type) => {
          if (!request) return;
          setUploadLoading(true);
          try {
            const res = await travelApi.uploadAttachment(request.id, file, type);
            const uploaded = res.data.data;
            if (uploaded) setAttachments((prev) => [uploaded, ...prev]);
            setAttachToast("File uploaded successfully.");
            setTimeout(() => setAttachToast(null), 3000);
          } catch (err) {
            setAttachToast(apiErrorMessage(err, "Upload failed. Please try again."));
            setTimeout(() => setAttachToast(null), 5000);
            throw err;
          } finally {
            setUploadLoading(false);
          }
        }}
        onDelete={async (id) => {
          if (!request) return;
          await travelApi.deleteAttachment(request.id, id);
          setAttachments((prev) => prev.filter((x) => x.id !== id));
        }}
        downloadUrl={(id) => travelApi.downloadAttachmentUrl(request!.id, id)}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
      />
      {attachToast && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            /fail|could not|error/i.test(attachToast)
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {attachToast}
        </div>
      )}


      {/* Back link */}
      <Link href="/travel" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Travel Requests
      </Link>

      {/* Return for Correction Modal */}
      <ReturnModal
        open={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onConfirm={handleReturn}
        loading={returnLoading}
      />

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-white p-6 max-w-md w-full shadow-2xl border border-neutral-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                <span className="material-symbols-outlined text-red-600 text-[20px]">cancel</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Reject Travel Request</h3>
                <p className="text-xs text-neutral-400">A reason is required</p>
              </div>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter your reason for rejection…"
              rows={3}
              className="form-input resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Amendment Modal */}
      {showAmendmentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="travel-amendment-modal">
          <div className="rounded-2xl bg-white p-6 max-w-lg w-full shadow-2xl border border-neutral-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <span className="material-symbols-outlined text-blue-600 text-[20px]">edit_document</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Request amendment</h3>
                <p className="text-xs text-neutral-400">Controlled post-approval change — original values are snapshotted</p>
              </div>
            </div>
            {amendError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{amendError}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-neutral-500 space-y-1">
                <span>Departure date</span>
                <input type="date" className="form-input" value={amendDeparture} onChange={(e) => setAmendDeparture(e.target.value)} />
              </label>
              <label className="text-xs text-neutral-500 space-y-1">
                <span>Return date</span>
                <input type="date" className="form-input" value={amendReturn} onChange={(e) => setAmendReturn(e.target.value)} />
              </label>
            </div>
            <label className="block text-xs text-neutral-500 space-y-1">
              <span>Destination country</span>
              <input className="form-input" value={amendDestination} onChange={(e) => setAmendDestination(e.target.value)} />
            </label>
            <label className="block text-xs text-neutral-500 space-y-1">
              <span>Purpose</span>
              <input className="form-input" value={amendPurpose} onChange={(e) => setAmendPurpose(e.target.value)} />
            </label>
            <label className="block text-xs text-neutral-500 space-y-1">
              <span>Reason for amendment</span>
              <textarea
                className="form-input resize-none"
                rows={2}
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
                placeholder="Why is this change needed?"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowAmendmentModal(false)}
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestAmendment}
                disabled={actionLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {actionLoading ? "Submitting…" : "Submit amendment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
