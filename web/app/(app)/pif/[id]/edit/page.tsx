"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  programmeApi,
  tenantUsersApi,
  travelApi,
  SUPPORT_SERVICE_OPTIONS,
  type Programme,
  type TravelDestinationCountry,
} from "@/lib/api";
import DocumentsSection from "./DocumentsSection";
import ArrivalDepartureSection from "./ArrivalDepartureSection";
import { NeedToggle } from "./NeedToggle";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Stepper } from "@/components/ui/Stepper";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { unwrapEntity } from "@/lib/unwrapEntity";
import { useToast } from "@/components/ui/Toast";
import {
  CURRENCIES,
  DEPARTMENTS,
  FUNDING_SOURCES,
  PIF_STRATEGIC_PILLARS,
} from "@/lib/constants";
import { formatDateRange } from "@/lib/utils";
import { commaListHas, inclusiveDayCount, optionsWithCurrent, toggleCommaList } from "@/lib/pifForm";

const STEPS = [
  "Overview",
  "Venue",
  "Budget",
  "Personnel",
  "Language",
  "Support",
  "Attachments",
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export default function PifEditPage() {
  const { success } = useToast();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [step, setStep] = useState<StepIndex>(0);
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [strategicPillar, setStrategicPillar] = useState("");
  const [implementingDepartment, setImplementingDepartment] = useState("");
  const [background, setBackground] = useState("");
  const [overallObjective, setOverallObjective] = useState("");
  const [primaryCurrency, setPrimaryCurrency] = useState("USD");
  const [totalBudget, setTotalBudget] = useState("");
  const [fundingSource, setFundingSource] = useState("");
  const [responsibleOfficerId, setResponsibleOfficerId] = useState<number | "">("");
  const [tenantUsers, setTenantUsers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [destinationCountries, setDestinationCountries] = useState<TravelDestinationCountry[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travelRequired, setTravelRequired] = useState(false);
  const [delegatesCount, setDelegatesCount] = useState("");
  const [procurementRequired, setProcurementRequired] = useState(false);

  // Venue
  const [venueCountry, setVenueCountry] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [venueProposedHotel, setVenueProposedHotel] = useState("");
  const [venueAccommodationRequired, setVenueAccommodationRequired] = useState(false);
  const [venueAccommodationCount, setVenueAccommodationCount] = useState("");
  const [venueConferencingRequired, setVenueConferencingRequired] = useState(false);
  const [venueConferencingParticipants, setVenueConferencingParticipants] = useState("");
  const [venueQuotationAttached, setVenueQuotationAttached] = useState(false);
  const [venueHotelQuotationAttached, setVenueHotelQuotationAttached] = useState(false);
  const [venueAccessibilityRequirements, setVenueAccessibilityRequirements] = useState("");
  const [venueSecurityConsiderations, setVenueSecurityConsiderations] = useState("");
  const [venueComments, setVenueComments] = useState("");

  // Budget variance
  const [proposedDsaRate, setProposedDsaRate] = useState("");
  const [originalBudgetRate, setOriginalBudgetRate] = useState("");
  const [dsaVarianceReason, setDsaVarianceReason] = useState("");
  const [proposedParticipants, setProposedParticipants] = useState("");
  const [budgetedParticipants, setBudgetedParticipants] = useState("");
  const [participantsVarianceReason, setParticipantsVarianceReason] = useState("");
  const [proposedFundingDifference, setProposedFundingDifference] = useState("");
  const [estimatedActivityAmount, setEstimatedActivityAmount] = useState("");

  // Personnel / consultants
  const [secretariatStaffRequired, setSecretariatStaffRequired] = useState(false);
  const [secretariatStaffCount, setSecretariatStaffCount] = useState("");
  const [consultantsRequired, setConsultantsRequired] = useState(false);
  const [consultantsCount, setConsultantsCount] = useState("");
  const [consultantsRate, setConsultantsRate] = useState("");
  const [resourcePersonsRequired, setResourcePersonsRequired] = useState(false);
  const [resourcePersonsCount, setResourcePersonsCount] = useState("");
  const [resourcePersonsRate, setResourcePersonsRate] = useState("");
  const [rapporteursRequired, setRapporteursRequired] = useState(false);
  const [rapporteursCount, setRapporteursCount] = useState("");
  const [rapporteursRate, setRapporteursRate] = useState("");
  const [mediaLiaisonRequired, setMediaLiaisonRequired] = useState(false);
  const [mediaLiaisonCount, setMediaLiaisonCount] = useState("");
  const [mediaLiaisonRate, setMediaLiaisonRate] = useState("");
  const [localSupportRequired, setLocalSupportRequired] = useState(false);
  const [localSupportCount, setLocalSupportCount] = useState("");
  const [localSupportRate, setLocalSupportRate] = useState("");
  const [personnelComments, setPersonnelComments] = useState("");

  // Interpretation / translation
  const [interpretationRequired, setInterpretationRequired] = useState(false);
  const [enFrRequired, setEnFrRequired] = useState(false);
  const [enFrInterpretersCount, setEnFrInterpretersCount] = useState("");
  const [enPtRequired, setEnPtRequired] = useState(false);
  const [enPtInterpretersCount, setEnPtInterpretersCount] = useState("");
  const [frPtRequired, setFrPtRequired] = useState(false);
  const [frPtInterpretersCount, setFrPtInterpretersCount] = useState("");
  const [interpreterRate, setInterpreterRate] = useState("");
  const [interpreterSource, setInterpreterSource] = useState("");
  const [interpreterSourceOtherNote, setInterpreterSourceOtherNote] = useState("");
  const [interpretationEquipmentRequired, setInterpretationEquipmentRequired] = useState(false);
  const [translationRequired, setTranslationRequired] = useState(false);
  const [languagesRequired, setLanguagesRequired] = useState("");
  const [interpretationComments, setInterpretationComments] = useState("");

  // Support services
  const [supportServices, setSupportServices] = useState<string[]>([]);
  const [supportServicesOtherNote, setSupportServicesOtherNote] = useState("");

  // Conflict of interest
  const [conflictDeclared, setConflictDeclared] = useState(false);
  const [conflictDetails, setConflictDetails] = useState("");
  const [conflictMitigation, setConflictMitigation] = useState("");

  useEffect(() => {
    tenantUsersApi.list().then((r) => setTenantUsers(r.data.data ?? [])).catch(() => {});
    travelApi.listDestinations()
      .then((r) => setDestinationCountries(r.data.data?.countries ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    programmeApi
      .get(Number(id))
      .then((r) => {
        if (cancelled) return;
        const p = unwrapEntity<Programme>(r.data);
        if (!p) {
          setError("Programme not found or returned unexpected data.");
          return;
        }
        setProgramme(p);
        setTitle(p.title ?? "");
        setStrategicPillar(p.strategic_pillar ?? "");
        setImplementingDepartment(p.implementing_department ?? "");
        setBackground(p.background ?? "");
        setOverallObjective(p.overall_objective ?? "");
        setPrimaryCurrency(p.primary_currency ?? "USD");
        setTotalBudget(p.total_budget != null ? String(p.total_budget) : "");
        setFundingSource(p.funding_source ?? "");
        const roId = p.responsible_officer_id ?? (p as { responsibleOfficer?: { id: number } }).responsibleOfficer?.id ?? null;
        setResponsibleOfficerId(roId != null ? roId : "");
        setStartDate(p.start_date ?? "");
        setEndDate(p.end_date ?? "");
        setTravelRequired(p.travel_required ?? false);
        setDelegatesCount(p.delegates_count != null ? String(p.delegates_count) : "");
        setProcurementRequired(p.procurement_required ?? false);

        setVenueCountry(p.venue_country ?? "");
        setVenueCity(p.venue_city ?? "");
        setVenueProposedHotel(p.venue_proposed_hotel ?? "");
        setVenueAccommodationRequired(p.venue_accommodation_required ?? false);
        setVenueAccommodationCount(p.venue_accommodation_count != null ? String(p.venue_accommodation_count) : "");
        setVenueConferencingRequired(p.venue_conferencing_required ?? false);
        setVenueConferencingParticipants(p.venue_conferencing_participants != null ? String(p.venue_conferencing_participants) : "");
        setVenueQuotationAttached(p.venue_quotation_attached ?? false);
        setVenueHotelQuotationAttached(p.venue_hotel_quotation_attached ?? false);
        setVenueAccessibilityRequirements(p.venue_accessibility_requirements ?? "");
        setVenueSecurityConsiderations(p.venue_security_considerations ?? "");
        setVenueComments(p.venue_comments ?? "");

        setProposedDsaRate(p.proposed_dsa_rate != null ? String(p.proposed_dsa_rate) : "");
        setOriginalBudgetRate(p.original_budget_rate != null ? String(p.original_budget_rate) : "");
        setDsaVarianceReason(p.dsa_variance_reason ?? "");
        setProposedParticipants(p.proposed_participants != null ? String(p.proposed_participants) : "");
        setBudgetedParticipants(p.budgeted_participants != null ? String(p.budgeted_participants) : "");
        setParticipantsVarianceReason(p.participants_variance_reason ?? "");
        setProposedFundingDifference(p.proposed_funding_difference != null ? String(p.proposed_funding_difference) : "");
        setEstimatedActivityAmount(p.estimated_activity_amount != null ? String(p.estimated_activity_amount) : "");

        setSecretariatStaffRequired(p.secretariat_staff_required ?? false);
        setSecretariatStaffCount(p.secretariat_staff_count != null ? String(p.secretariat_staff_count) : "");
        setConsultantsRequired(p.consultants_required ?? false);
        setConsultantsCount(p.consultants_count != null ? String(p.consultants_count) : "");
        setConsultantsRate(p.consultants_rate != null ? String(p.consultants_rate) : "");
        setResourcePersonsRequired(p.resource_persons_required ?? false);
        setResourcePersonsCount(p.resource_persons_count != null ? String(p.resource_persons_count) : "");
        setResourcePersonsRate(p.resource_persons_rate != null ? String(p.resource_persons_rate) : "");
        setRapporteursRequired(p.rapporteurs_required ?? false);
        setRapporteursCount(p.rapporteurs_count != null ? String(p.rapporteurs_count) : "");
        setRapporteursRate(p.rapporteurs_rate != null ? String(p.rapporteurs_rate) : "");
        setMediaLiaisonRequired(p.media_liaison_required ?? false);
        setMediaLiaisonCount(p.media_liaison_count != null ? String(p.media_liaison_count) : "");
        setMediaLiaisonRate(p.media_liaison_rate != null ? String(p.media_liaison_rate) : "");
        setLocalSupportRequired(p.local_support_required ?? false);
        setLocalSupportCount(p.local_support_count != null ? String(p.local_support_count) : "");
        setLocalSupportRate(p.local_support_rate != null ? String(p.local_support_rate) : "");
        setPersonnelComments(p.personnel_comments ?? "");

        setInterpretationRequired(p.interpretation_required ?? false);
        setEnFrRequired(p.en_fr_required ?? false);
        setEnFrInterpretersCount(p.en_fr_interpreters_count != null ? String(p.en_fr_interpreters_count) : "");
        setEnPtRequired(p.en_pt_required ?? false);
        setEnPtInterpretersCount(p.en_pt_interpreters_count != null ? String(p.en_pt_interpreters_count) : "");
        setFrPtRequired(p.fr_pt_required ?? false);
        setFrPtInterpretersCount(p.fr_pt_interpreters_count != null ? String(p.fr_pt_interpreters_count) : "");
        setInterpreterRate(p.interpreter_rate != null ? String(p.interpreter_rate) : "");
        setInterpreterSource(p.interpreter_source ?? "");
        setInterpreterSourceOtherNote(p.interpreter_source_other_note ?? "");
        setInterpretationEquipmentRequired(p.interpretation_equipment_required ?? false);
        setTranslationRequired(p.translation_required ?? false);
        setLanguagesRequired((p.languages_required ?? []).join(", "));
        setInterpretationComments(p.interpretation_comments ?? "");

        setSupportServices(p.support_services ?? []);
        setSupportServicesOtherNote(p.support_services_other_note ?? "");

        setConflictDeclared(p.conflict_declared ?? false);
        setConflictDetails(p.conflict_details ?? "");
        setConflictMitigation(p.conflict_mitigation ?? "");

        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load programme.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);


  const payloadForStep = useCallback((s: StepIndex): Record<string, unknown> => {
    switch (s) {
      case 0:
        return {
          title: title || undefined,
          strategic_pillar: strategicPillar || undefined,
          implementing_department: implementingDepartment || undefined,
          background: background || undefined,
          overall_objective: overallObjective || undefined,
          responsible_officer_id: responsibleOfficerId === "" ? null : responsibleOfficerId,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          travel_required: travelRequired,
          delegates_count: delegatesCount ? parseInt(delegatesCount, 10) : undefined,
          procurement_required: procurementRequired,
        };
      case 1:
        return {
          venue_country: venueCountry || undefined,
          venue_city: venueCity || undefined,
          venue_proposed_hotel: venueProposedHotel || undefined,
          venue_accommodation_required: venueAccommodationRequired,
          venue_accommodation_count: venueAccommodationCount ? parseInt(venueAccommodationCount, 10) : undefined,
          venue_conferencing_required: venueConferencingRequired,
          venue_conferencing_participants: venueConferencingParticipants ? parseInt(venueConferencingParticipants, 10) : undefined,
          venue_quotation_attached: venueQuotationAttached,
          venue_hotel_quotation_attached: venueHotelQuotationAttached,
          venue_accessibility_requirements: venueAccessibilityRequirements || undefined,
          venue_security_considerations: venueSecurityConsiderations || undefined,
          venue_comments: venueComments || undefined,
        };
      case 2:
        return {
          primary_currency: primaryCurrency || undefined,
          total_budget: totalBudget ? parseFloat(totalBudget) : undefined,
          funding_source: fundingSource || undefined,
          proposed_dsa_rate: proposedDsaRate ? parseFloat(proposedDsaRate) : undefined,
          original_budget_rate: originalBudgetRate ? parseFloat(originalBudgetRate) : undefined,
          dsa_variance_reason: dsaVarianceReason || undefined,
          proposed_participants: proposedParticipants ? parseInt(proposedParticipants, 10) : undefined,
          budgeted_participants: budgetedParticipants ? parseInt(budgetedParticipants, 10) : undefined,
          participants_variance_reason: participantsVarianceReason || undefined,
          proposed_funding_difference: proposedFundingDifference ? parseFloat(proposedFundingDifference) : undefined,
          estimated_activity_amount: estimatedActivityAmount ? parseFloat(estimatedActivityAmount) : undefined,
        };
      case 3:
        return {
          secretariat_staff_required: secretariatStaffRequired,
          secretariat_staff_count: secretariatStaffCount ? parseInt(secretariatStaffCount, 10) : undefined,
          consultants_required: consultantsRequired,
          consultants_count: consultantsCount ? parseInt(consultantsCount, 10) : undefined,
          consultants_rate: consultantsRate ? parseFloat(consultantsRate) : undefined,
          resource_persons_required: resourcePersonsRequired,
          resource_persons_count: resourcePersonsCount ? parseInt(resourcePersonsCount, 10) : undefined,
          resource_persons_rate: resourcePersonsRate ? parseFloat(resourcePersonsRate) : undefined,
          rapporteurs_required: rapporteursRequired,
          rapporteurs_count: rapporteursCount ? parseInt(rapporteursCount, 10) : undefined,
          rapporteurs_rate: rapporteursRate ? parseFloat(rapporteursRate) : undefined,
          media_liaison_required: mediaLiaisonRequired,
          media_liaison_count: mediaLiaisonCount ? parseInt(mediaLiaisonCount, 10) : undefined,
          media_liaison_rate: mediaLiaisonRate ? parseFloat(mediaLiaisonRate) : undefined,
          local_support_required: localSupportRequired,
          local_support_count: localSupportCount ? parseInt(localSupportCount, 10) : undefined,
          local_support_rate: localSupportRate ? parseFloat(localSupportRate) : undefined,
          personnel_comments: personnelComments || undefined,
        };
      case 4:
        return {
          interpretation_required: interpretationRequired,
          en_fr_required: enFrRequired,
          en_fr_interpreters_count: enFrInterpretersCount ? parseInt(enFrInterpretersCount, 10) : undefined,
          en_pt_required: enPtRequired,
          en_pt_interpreters_count: enPtInterpretersCount ? parseInt(enPtInterpretersCount, 10) : undefined,
          fr_pt_required: frPtRequired,
          fr_pt_interpreters_count: frPtInterpretersCount ? parseInt(frPtInterpretersCount, 10) : undefined,
          interpreter_rate: interpreterRate ? parseFloat(interpreterRate) : undefined,
          interpreter_source: interpreterSource || undefined,
          interpreter_source_other_note: interpreterSourceOtherNote || undefined,
          interpretation_equipment_required: interpretationEquipmentRequired,
          translation_required: translationRequired,
          languages_required: languagesRequired
            ? languagesRequired.split(",").map((x) => x.trim()).filter(Boolean)
            : undefined,
          interpretation_comments: interpretationComments || undefined,
        };
      case 5:
        return {
          support_services: supportServices,
          support_services_other_note: supportServicesOtherNote || undefined,
          conflict_declared: conflictDeclared,
          conflict_details: conflictDetails || undefined,
          conflict_mitigation: conflictMitigation || undefined,
        };
      case 6:
        return {};
      default:
        return {};
    }
  }, [
    title, strategicPillar, implementingDepartment, background, overallObjective, responsibleOfficerId,
    startDate, endDate, travelRequired, delegatesCount, procurementRequired,
    venueCountry, venueCity, venueProposedHotel, venueAccommodationRequired, venueAccommodationCount,
    venueConferencingRequired, venueConferencingParticipants, venueQuotationAttached, venueHotelQuotationAttached,
    venueAccessibilityRequirements, venueSecurityConsiderations, venueComments,
    primaryCurrency, totalBudget, fundingSource, proposedDsaRate, originalBudgetRate, dsaVarianceReason,
    proposedParticipants, budgetedParticipants, participantsVarianceReason, proposedFundingDifference, estimatedActivityAmount,
    secretariatStaffRequired, secretariatStaffCount, consultantsRequired, consultantsCount, consultantsRate,
    resourcePersonsRequired, resourcePersonsCount, resourcePersonsRate, rapporteursRequired, rapporteursCount, rapporteursRate,
    mediaLiaisonRequired, mediaLiaisonCount, mediaLiaisonRate, localSupportRequired, localSupportCount, localSupportRate, personnelComments,
    interpretationRequired, enFrRequired, enFrInterpretersCount, enPtRequired, enPtInterpretersCount,
    frPtRequired, frPtInterpretersCount, interpreterRate, interpreterSource, interpreterSourceOtherNote,
    interpretationEquipmentRequired, translationRequired, languagesRequired, interpretationComments,
    supportServices, supportServicesOtherNote, conflictDeclared, conflictDetails, conflictMitigation,
  ]);

  const validateStep = (s: StepIndex): string | null => {
    if (s === 0 && !title.trim()) return "Programme title is required.";
    if (s === 2) {
      if (
        proposedDsaRate !== "" && originalBudgetRate !== ""
        && parseFloat(proposedDsaRate) !== parseFloat(originalBudgetRate)
        && !dsaVarianceReason.trim()
      ) {
        return "Reason for DSA rate variance is required when rates differ.";
      }
      if (
        proposedParticipants !== "" && budgetedParticipants !== ""
        && parseInt(proposedParticipants, 10) !== parseInt(budgetedParticipants, 10)
        && !participantsVarianceReason.trim()
      ) {
        return "Reason for participants variance is required when counts differ.";
      }
    }
    if (s === 4) {
      if (interpreterSource === "other" && !interpreterSourceOtherNote.trim()) {
        return "Please describe the interpreter source.";
      }
      if (translationRequired && !languagesRequired.trim()) {
        return "Languages required is required when translation is selected.";
      }
    }
    if (s === 5) {
      if (supportServices.includes("other") && !supportServicesOtherNote.trim()) {
        return "Please describe other support services.";
      }
      if (conflictDeclared && (!conflictDetails.trim() || !conflictMitigation.trim())) {
        return "Conflict details and mitigation are required when a conflict is declared.";
      }
    }
    return null;
  };

  const saveStep = async (s: StepIndex): Promise<boolean> => {
    if (!programme) return false;
    const validationError = validateStep(s);
    if (validationError) {
      setError(validationError);
      return false;
    }
    const payload = payloadForStep(s);
    if (Object.keys(payload).length === 0) return true;
    setSubmitting(true);
    setError(null);
    try {
      await programmeApi.update(programme.id, payload);
      return true;
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg = ax.response?.data?.message
        ?? (ax.response?.data?.errors && Object.values(ax.response.data.errors).flat()[0])
        ?? "Failed to save this page. Please try again.";
      setError(msg);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = async () => {
    const ok = await saveStep(step);
    if (!ok) return;
    if (step < STEPS.length - 1) {
      success(`${STEPS[step]} saved.`);
      setStep((step + 1) as StepIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = () => {
    if (step === 0) return;
    setError(null);
    setStep((step - 1) as StepIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finish = async () => {
    const ok = await saveStep(step);
    if (!ok || !programme) return;
    success("Programme updated.");
    router.push(`/pif/${programme.id}`);
  };

  const jumpToStep = async (i: StepIndex) => {
    if (i === step) return;
    const ok = await saveStep(step);
    if (!ok) return;
    setError(null);
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveThisPage = async () => {
    const ok = await saveStep(step);
    if (ok) success(`${STEPS[step]} saved.`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-400">
        <span className="material-symbols-outlined animate-spin text-[24px] mr-2">progress_activity</span>
        <span className="text-sm">Loading…</span>
      </div>
    );
  }
  if (error && !programme) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
        <Link href="/pif" className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Programmes
        </Link>
      </div>
    );
  }
  if (!programme) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          Programme not found.
        </div>
        <Link href="/pif" className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Programmes
        </Link>
      </div>
    );
  }

  if (programme.status !== "draft" && programme.status !== "amendment_draft") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Only draft or amendment-draft programmes can be edited.
        </div>
        <Link href={`/pif/${programme.id}`} className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1">
          Back to programme
        </Link>
      </div>
    );
  }


  const isLast = step === STEPS.length - 1;
  const dayCount = inclusiveDayCount(startDate, endDate);
  const dateRangeHint =
    startDate && endDate
      ? `${formatDateRange(startDate, endDate)}${dayCount ? ` · ${dayCount} day${dayCount === 1 ? "" : "s"}` : ""}`
      : "Dates show as 21 Aug 2026.";
  const venueCities =
    destinationCountries.find((country) => country.name === venueCountry)?.cities ?? [];
  const dsaDiff =
    proposedDsaRate !== "" && originalBudgetRate !== ""
      ? parseFloat(proposedDsaRate) - parseFloat(originalBudgetRate)
      : null;
  const participantDiff =
    proposedParticipants !== "" && budgetedParticipants !== ""
      ? parseInt(proposedParticipants, 10) - parseInt(budgetedParticipants, 10)
      : null;
  const headcountHint = delegatesCount || proposedParticipants;

  const actions = (
    <div
      data-testid="pif-edit-actions"
      className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-0"
    >
      {step > 0 && (
        <button
          type="button"
          onClick={goBack}
          disabled={submitting}
          className="btn-secondary px-5 py-2.5 text-sm disabled:opacity-50 inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back
        </button>
      )}
      <button
        type="button"
        onClick={saveThisPage}
        disabled={submitting}
        className="btn-secondary px-5 py-2.5 text-sm disabled:opacity-50"
      >
        Save this page
      </button>
      <div className="flex-1" />
      <Link href={`/pif/${programme.id}`} className="btn-secondary px-5 py-2.5 text-sm">
        Cancel
      </Link>
      {!isLast ? (
        <button
          type="button"
          onClick={goNext}
          disabled={submitting}
          className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50 inline-flex items-center gap-2"
        >
          {submitting ? (
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          )}
          {submitting ? "Saving…" : "Save & continue"}
        </button>
      ) : (
        <button
          type="button"
          onClick={finish}
          disabled={submitting}
          className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50 inline-flex items-center gap-2"
        >
          {submitting ? (
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[18px]">check</span>
          )}
          {submitting ? "Saving…" : "Save & finish"}
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <ModulePageHeader
        title="Edit Programme Implementation Form"
        subtitle="Answer only what this activity needs. Each page saves when you continue — leave and return anytime."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Programmes", href: "/pif" },
              { label: programme.reference_number ?? `PIF #${programme.id}`, href: `/pif/${programme.id}` },
              { label: "Edit" },
            ]}
          />
        }
        actions={
          <Link href={`/pif/${programme.id}`} className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            View
          </Link>
        }
      />

      <div className="card overflow-x-auto p-4 sm:p-5">
        <Stepper
          steps={STEPS.map((label) => ({ label }))}
          currentStep={step + 1}
          onStepSelect={(index) => void jumpToStep(index as StepIndex)}
        />
        <p className="mt-3 text-xs text-neutral-500 md:hidden">
          Page {step + 1} of {STEPS.length}:{" "}
          <span className="font-semibold text-neutral-800">{STEPS[step]}</span>
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {step === 0 && (
        <FormSection
          title="Overview"
          description="Name the programme, who owns it, and when it runs."
          icon="description"
        >
          <div className="space-y-4">
            <FormField label="Title" required>
              <input className="form-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Programme title" />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Strategic pillar">
                <select className="form-input w-full" value={strategicPillar} onChange={(e) => setStrategicPillar(e.target.value)}>
                  <option value="">Select pillar…</option>
                  {optionsWithCurrent(PIF_STRATEGIC_PILLARS, strategicPillar).map((pillar) => (
                    <option key={pillar} value={pillar}>{pillar}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Implementing department">
                <select className="form-input w-full" value={implementingDepartment} onChange={(e) => setImplementingDepartment(e.target.value)}>
                  <option value="">Select department…</option>
                  {optionsWithCurrent(DEPARTMENTS, implementingDepartment).map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Background" hint="Why this activity is needed.">
              <textarea rows={4} className="form-input w-full resize-y" value={background} onChange={(e) => setBackground(e.target.value)} />
            </FormField>
            <FormField label="Overall objective" hint="What success looks like.">
              <textarea rows={3} className="form-input w-full resize-y" value={overallObjective} onChange={(e) => setOverallObjective(e.target.value)} />
            </FormField>
            <FormField label="Responsible officer" hint="Must be a user registered in the system">
              <select
                className="form-input w-full"
                value={responsibleOfficerId === "" ? "" : String(responsibleOfficerId)}
                onChange={(e) => setResponsibleOfficerId(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">Select responsible officer…</option>
                {tenantUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} {u.email ? `(${u.email})` : ""}</option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Start date" hint={dateRangeHint}>
                <input type="date" className="form-input w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </FormField>
              <FormField label="End date">
                <input type="date" className="form-input w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NeedToggle
                label="Travel required"
                hint="Staff or delegates will travel for this activity."
                checked={travelRequired}
                onChange={setTravelRequired}
              >
                <FormField label="Delegates count">
                  <input type="number" min="0" className="form-input w-full max-w-[160px]" value={delegatesCount} onChange={(e) => setDelegatesCount(e.target.value)} />
                </FormField>
              </NeedToggle>
              <NeedToggle
                label="Procurement required"
                hint="Goods or services will be bought for this activity."
                checked={procurementRequired}
                onChange={setProcurementRequired}
              />
            </div>
          </div>
        </FormSection>
      )}

      {step === 1 && (
        <FormSection title="Venue" description="Where the activity takes place, and whether rooms or conferencing are needed." icon="location_on">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Venue country">
                <>
                  <input list="pif-venue-countries" className="form-input w-full" value={venueCountry} onChange={(e) => setVenueCountry(e.target.value)} />
                  <datalist id="pif-venue-countries">
                    {destinationCountries.map((country) => (
                      <option key={country.id ?? country.name} value={country.name} />
                    ))}
                  </datalist>
                </>
              </FormField>
              <FormField label="Venue city">
                <>
                  <input list="pif-venue-cities" className="form-input w-full" value={venueCity} onChange={(e) => setVenueCity(e.target.value)} />
                  <datalist id="pif-venue-cities">
                    {venueCities.map((city) => (
                      <option key={city.id ?? city.name} value={city.name} />
                    ))}
                  </datalist>
                </>
              </FormField>
            </div>
            <FormField label="Proposed hotel">
              <input className="form-input w-full" value={venueProposedHotel} onChange={(e) => setVenueProposedHotel(e.target.value)} />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NeedToggle
                label="Accommodation required"
                hint={headcountHint ? `Prefills from ${headcountHint} people if you leave the count blank.` : "Rooms for overnight stay."}
                checked={venueAccommodationRequired}
                onChange={(next) => {
                  setVenueAccommodationRequired(next);
                  if (next && !venueAccommodationCount && headcountHint) setVenueAccommodationCount(headcountHint);
                }}
              >
                <FormField label="Accommodation count">
                  <input type="number" min="0" className="form-input w-full" value={venueAccommodationCount} onChange={(e) => setVenueAccommodationCount(e.target.value)} />
                </FormField>
              </NeedToggle>
              <NeedToggle
                label="Conferencing required"
                hint="Meeting rooms, hybrid links, or a conference package."
                checked={venueConferencingRequired}
                onChange={(next) => {
                  setVenueConferencingRequired(next);
                  if (next && !venueConferencingParticipants && headcountHint) setVenueConferencingParticipants(headcountHint);
                }}
              >
                <FormField label="Conferencing participants">
                  <input type="number" min="0" className="form-input w-full" value={venueConferencingParticipants} onChange={(e) => setVenueConferencingParticipants(e.target.value)} />
                </FormField>
              </NeedToggle>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NeedToggle label="Venue quotation attached" checked={venueQuotationAttached} onChange={setVenueQuotationAttached} />
              <NeedToggle label="Hotel quotation attached" checked={venueHotelQuotationAttached} onChange={setVenueHotelQuotationAttached} />
            </div>
            <FormField label="Accessibility requirements">
              <textarea rows={2} className="form-input w-full resize-y" value={venueAccessibilityRequirements} onChange={(e) => setVenueAccessibilityRequirements(e.target.value)} />
            </FormField>
            <FormField label="Security considerations">
              <textarea rows={2} className="form-input w-full resize-y" value={venueSecurityConsiderations} onChange={(e) => setVenueSecurityConsiderations(e.target.value)} />
            </FormField>
            <FormField label="Venue comments">
              <textarea rows={2} className="form-input w-full resize-y" value={venueComments} onChange={(e) => setVenueComments(e.target.value)} />
            </FormField>
          </div>
        </FormSection>
      )}

      {step === 2 && (
        <>
          <FormSection title="Budget" description="Currency, envelope, and who is paying." icon="payments">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Primary currency">
                  <select className="form-input w-full" value={primaryCurrency} onChange={(e) => setPrimaryCurrency(e.target.value)}>
                    {optionsWithCurrent(CURRENCIES, primaryCurrency).map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Total budget">
                  <input type="number" min="0" step="any" className="form-input w-full" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} />
                </FormField>
              </div>
              <FormField label="Funding source" hint="Core Budget, Donor, or a named fund.">
                <>
                  <input list="pif-funding-sources" className="form-input w-full" value={fundingSource} onChange={(e) => setFundingSource(e.target.value)} />
                  <datalist id="pif-funding-sources">
                    {FUNDING_SOURCES.map((source) => (
                      <option key={source} value={source} />
                    ))}
                  </datalist>
                </>
              </FormField>
            </div>
          </FormSection>
          <FormSection title="Budget variance" description="Only explain a difference when the proposed figure is not the budgeted one." icon="difference">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Proposed DSA rate">
                  <input type="number" min="0" step="any" className="form-input w-full" value={proposedDsaRate} onChange={(e) => setProposedDsaRate(e.target.value)} />
                </FormField>
                <FormField label="Original budget rate">
                  <input type="number" min="0" step="any" className="form-input w-full" value={originalBudgetRate} onChange={(e) => setOriginalBudgetRate(e.target.value)} />
                </FormField>
              </div>
              {dsaDiff != null && dsaDiff !== 0 && (
                <p className="text-xs font-medium text-amber-800">
                  DSA differs by {dsaDiff > 0 ? "+" : ""}{dsaDiff} {primaryCurrency || ""}. A reason is required.
                </p>
              )}
              {proposedDsaRate !== "" && originalBudgetRate !== "" && parseFloat(proposedDsaRate) !== parseFloat(originalBudgetRate) && (
                <FormField label="Reason for DSA rate variance" required>
                  <textarea rows={2} className="form-input w-full resize-y" value={dsaVarianceReason} onChange={(e) => setDsaVarianceReason(e.target.value)} />
                </FormField>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Proposed participants">
                  <input type="number" min="0" className="form-input w-full" value={proposedParticipants} onChange={(e) => setProposedParticipants(e.target.value)} />
                </FormField>
                <FormField label="Budgeted participants">
                  <input type="number" min="0" className="form-input w-full" value={budgetedParticipants} onChange={(e) => setBudgetedParticipants(e.target.value)} />
                </FormField>
              </div>
              {participantDiff != null && participantDiff !== 0 && (
                <p className="text-xs font-medium text-amber-800">
                  Headcount differs by {participantDiff > 0 ? "+" : ""}{participantDiff}. A reason is required.
                </p>
              )}
              {proposedParticipants !== "" && budgetedParticipants !== "" && parseInt(proposedParticipants, 10) !== parseInt(budgetedParticipants, 10) && (
                <FormField label="Reason for participants variance" required>
                  <textarea rows={2} className="form-input w-full resize-y" value={participantsVarianceReason} onChange={(e) => setParticipantsVarianceReason(e.target.value)} />
                </FormField>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Proposed funding difference">
                  <input type="number" min="0" step="any" className="form-input w-full" value={proposedFundingDifference} onChange={(e) => setProposedFundingDifference(e.target.value)} />
                </FormField>
                <FormField label="Estimated activity amount">
                  <input type="number" min="0" step="any" className="form-input w-full" value={estimatedActivityAmount} onChange={(e) => setEstimatedActivityAmount(e.target.value)} />
                </FormField>
              </div>
            </div>
          </FormSection>
        </>
      )}

      {step === 3 && (
        <FormSection title="Personnel & consultants" description="Turn on only the roles this activity needs. Extra fields appear for that role." icon="groups">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NeedToggle label="Secretariat staff required" checked={secretariatStaffRequired} onChange={setSecretariatStaffRequired}>
                <FormField label="Staff count">
                  <input type="number" min="0" className="form-input w-full" value={secretariatStaffCount} onChange={(e) => setSecretariatStaffCount(e.target.value)} />
                </FormField>
              </NeedToggle>
              <NeedToggle label="Consultants required" checked={consultantsRequired} onChange={setConsultantsRequired}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Consultants count">
                    <input type="number" min="0" className="form-input w-full" value={consultantsCount} onChange={(e) => setConsultantsCount(e.target.value)} />
                  </FormField>
                  <FormField label="Consultant rate">
                    <input type="number" min="0" step="any" className="form-input w-full" value={consultantsRate} onChange={(e) => setConsultantsRate(e.target.value)} />
                  </FormField>
                </div>
              </NeedToggle>
              <NeedToggle label="Resource persons required" checked={resourcePersonsRequired} onChange={setResourcePersonsRequired}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Resource persons count">
                    <input type="number" min="0" className="form-input w-full" value={resourcePersonsCount} onChange={(e) => setResourcePersonsCount(e.target.value)} />
                  </FormField>
                  <FormField label="Resource person rate">
                    <input type="number" min="0" step="any" className="form-input w-full" value={resourcePersonsRate} onChange={(e) => setResourcePersonsRate(e.target.value)} />
                  </FormField>
                </div>
              </NeedToggle>
              <NeedToggle label="Rapporteurs required" checked={rapporteursRequired} onChange={setRapporteursRequired}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Rapporteurs count">
                    <input type="number" min="0" className="form-input w-full" value={rapporteursCount} onChange={(e) => setRapporteursCount(e.target.value)} />
                  </FormField>
                  <FormField label="Rapporteur rate">
                    <input type="number" min="0" step="any" className="form-input w-full" value={rapporteursRate} onChange={(e) => setRapporteursRate(e.target.value)} />
                  </FormField>
                </div>
              </NeedToggle>
              <NeedToggle label="Media liaison required" checked={mediaLiaisonRequired} onChange={setMediaLiaisonRequired}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Media liaison count">
                    <input type="number" min="0" className="form-input w-full" value={mediaLiaisonCount} onChange={(e) => setMediaLiaisonCount(e.target.value)} />
                  </FormField>
                  <FormField label="Media liaison rate">
                    <input type="number" min="0" step="any" className="form-input w-full" value={mediaLiaisonRate} onChange={(e) => setMediaLiaisonRate(e.target.value)} />
                  </FormField>
                </div>
              </NeedToggle>
              <NeedToggle label="Local support required" checked={localSupportRequired} onChange={setLocalSupportRequired}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Local support count">
                    <input type="number" min="0" className="form-input w-full" value={localSupportCount} onChange={(e) => setLocalSupportCount(e.target.value)} />
                  </FormField>
                  <FormField label="Local support rate">
                    <input type="number" min="0" step="any" className="form-input w-full" value={localSupportRate} onChange={(e) => setLocalSupportRate(e.target.value)} />
                  </FormField>
                </div>
              </NeedToggle>
            </div>
            <FormField label="Personnel comments">
              <textarea rows={2} className="form-input w-full resize-y" value={personnelComments} onChange={(e) => setPersonnelComments(e.target.value)} />
            </FormField>
          </div>
        </FormSection>
      )}

      {step === 4 && (
        <FormSection title="Interpretation & translation" description="SADC working languages only appear when you need them." icon="translate">
          <div className="space-y-4">
            <NeedToggle label="Interpretation required" hint="Live interpreting in the room or on a hybrid link." checked={interpretationRequired} onChange={setInterpretationRequired}>
              <div className="space-y-3">
                <NeedToggle label="English ↔ French interpreters required" checked={enFrRequired} onChange={setEnFrRequired}>
                  <FormField label="EN/FR interpreters count">
                    <input type="number" min="0" className="form-input w-full max-w-[160px]" value={enFrInterpretersCount} onChange={(e) => setEnFrInterpretersCount(e.target.value)} />
                  </FormField>
                </NeedToggle>
                <NeedToggle label="English ↔ Portuguese interpreters required" checked={enPtRequired} onChange={setEnPtRequired}>
                  <FormField label="EN/PT interpreters count">
                    <input type="number" min="0" className="form-input w-full max-w-[160px]" value={enPtInterpretersCount} onChange={(e) => setEnPtInterpretersCount(e.target.value)} />
                  </FormField>
                </NeedToggle>
                <NeedToggle label="French ↔ Portuguese interpreters required" checked={frPtRequired} onChange={setFrPtRequired}>
                  <FormField label="FR/PT interpreters count">
                    <input type="number" min="0" className="form-input w-full max-w-[160px]" value={frPtInterpretersCount} onChange={(e) => setFrPtInterpretersCount(e.target.value)} />
                  </FormField>
                </NeedToggle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Interpreter rate">
                    <input type="number" min="0" step="any" className="form-input w-full" value={interpreterRate} onChange={(e) => setInterpreterRate(e.target.value)} />
                  </FormField>
                  <FormField label="Interpreter source">
                    <select className="form-input w-full" value={interpreterSource} onChange={(e) => setInterpreterSource(e.target.value)}>
                      <option value="">Select source…</option>
                      <option value="internal">Internal</option>
                      <option value="supplier">Supplier</option>
                      <option value="partner">Partner</option>
                      <option value="other">Other</option>
                    </select>
                  </FormField>
                </div>
                {interpreterSource === "other" && (
                  <FormField label="Interpreter source (other)" required>
                    <input className="form-input w-full" value={interpreterSourceOtherNote} onChange={(e) => setInterpreterSourceOtherNote(e.target.value)} />
                  </FormField>
                )}
                <NeedToggle label="Interpretation equipment required" checked={interpretationEquipmentRequired} onChange={setInterpretationEquipmentRequired} />
              </div>
            </NeedToggle>
            <NeedToggle label="Translation required" hint="Written documents, not live interpreting." checked={translationRequired} onChange={setTranslationRequired}>
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-neutral-700">
                  Languages required <span className="text-red-500">*</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {["English", "French", "Portuguese"].map((lang) => {
                    const on = commaListHas(languagesRequired, lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setLanguagesRequired(toggleCommaList(languagesRequired, lang))}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-primary bg-primary text-white" : "border-neutral-200 bg-white text-neutral-700"}`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
                <input
                  aria-label="Languages required"
                  className="form-input w-full"
                  value={languagesRequired}
                  onChange={(e) => setLanguagesRequired(e.target.value)}
                  placeholder="English, French"
                />
                <p className="text-[11px] text-neutral-400">Tap a working language. You can still type extras.</p>
              </div>
            </NeedToggle>
            <FormField label="Interpretation comments">
              <textarea rows={2} className="form-input w-full resize-y" value={interpretationComments} onChange={(e) => setInterpretationComments(e.target.value)} />
            </FormField>
          </div>
        </FormSection>
      )}

      {step === 5 && (
        <>
          <FormSection title="Support services" description="Tick only the services this activity will actually use." icon="handyman">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUPPORT_SERVICE_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${supportServices.includes(opt.key) ? "border-primary/30 bg-primary/5" : "border-neutral-200"}`}
                >
                  <input
                    type="checkbox"
                    className="rounded border-neutral-300"
                    checked={supportServices.includes(opt.key)}
                    onChange={(e) =>
                      setSupportServices((prev) =>
                        e.target.checked ? [...prev, opt.key] : prev.filter((k) => k !== opt.key),
                      )
                    }
                  />
                  <span className="text-neutral-800">{opt.label}</span>
                </label>
              ))}
            </div>
            {supportServices.includes("other") && (
              <FormField label="Other support services" required className="mt-4">
                <input required className="form-input w-full" value={supportServicesOtherNote} onChange={(e) => setSupportServicesOtherNote(e.target.value)} />
              </FormField>
            )}
          </FormSection>
          <FormSection title="Conflict of interest" description="Declare only if a conflict exists for this programme." icon="policy">
            <NeedToggle
              label="A conflict of interest is declared for this programme"
              checked={conflictDeclared}
              onChange={setConflictDeclared}
            >
              <FormField label="Conflict details" required>
                <textarea required rows={3} className="form-input w-full resize-y" value={conflictDetails} onChange={(e) => setConflictDetails(e.target.value)} />
              </FormField>
              <FormField label="Mitigation measures" required>
                <textarea required rows={3} className="form-input w-full resize-y" value={conflictMitigation} onChange={(e) => setConflictMitigation(e.target.value)} />
              </FormField>
            </NeedToggle>
          </FormSection>
        </>
      )}

      {step === 6 && (
        <>
          <FormSection title="Documents" description="Each row is saved as soon as it is added — it is not held until you finish." icon="attach_file">
            <DocumentsSection
              programmeId={programme.id}
              initialRows={programme.documents ?? []}
              tenantUsers={tenantUsers}
              onToast={success}
            />
          </FormSection>
          <FormSection title="Arrival / Departure" description="Each row is saved as soon as it is added — it is not held until you finish." icon="flight_land">
            <ArrivalDepartureSection
              programmeId={programme.id}
              initialRows={programme.arrival_departures ?? []}
              onToast={success}
            />
          </FormSection>
        </>
      )}

      {actions}
    </div>
  );
}
