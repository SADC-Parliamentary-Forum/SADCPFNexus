"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { programmeApi, tenantUsersApi, SUPPORT_SERVICE_OPTIONS, type Programme } from "@/lib/api";
import DocumentsSection from "./DocumentsSection";
import ArrivalDepartureSection from "./ArrivalDepartureSection";

export default function PifEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    programmeApi
      .get(Number(id))
      .then((r) => {
        const p = r.data;
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
      .catch(() => setError("Failed to load programme."))
      .finally(() => setLoading(false));
  }, [id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programme) return;
    setSubmitting(true);
    try {
      await programmeApi.update(programme.id, {
        title: title || undefined,
        strategic_pillar: strategicPillar || undefined,
        implementing_department: implementingDepartment || undefined,
        background: background || undefined,
        overall_objective: overallObjective || undefined,
        primary_currency: primaryCurrency || undefined,
        total_budget: totalBudget ? parseFloat(totalBudget) : undefined,
        funding_source: fundingSource || undefined,
        responsible_officer_id: responsibleOfficerId === "" ? null : responsibleOfficerId,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        travel_required: travelRequired,
        delegates_count: delegatesCount ? parseInt(delegatesCount, 10) : undefined,
        procurement_required: procurementRequired,

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

        proposed_dsa_rate: proposedDsaRate ? parseFloat(proposedDsaRate) : undefined,
        original_budget_rate: originalBudgetRate ? parseFloat(originalBudgetRate) : undefined,
        dsa_variance_reason: dsaVarianceReason || undefined,
        proposed_participants: proposedParticipants ? parseInt(proposedParticipants, 10) : undefined,
        budgeted_participants: budgetedParticipants ? parseInt(budgetedParticipants, 10) : undefined,
        participants_variance_reason: participantsVarianceReason || undefined,
        proposed_funding_difference: proposedFundingDifference ? parseFloat(proposedFundingDifference) : undefined,
        estimated_activity_amount: estimatedActivityAmount ? parseFloat(estimatedActivityAmount) : undefined,

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
        local_support_required: localSupportRequired,
        local_support_count: localSupportCount ? parseInt(localSupportCount, 10) : undefined,
        local_support_rate: localSupportRate ? parseFloat(localSupportRate) : undefined,
        personnel_comments: personnelComments || undefined,

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
          ? languagesRequired.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        interpretation_comments: interpretationComments || undefined,

        support_services: supportServices,
        support_services_other_note: supportServicesOtherNote || undefined,

        conflict_declared: conflictDeclared,
        conflict_details: conflictDetails || undefined,
        conflict_mitigation: conflictMitigation || undefined,
      });
      showToast("Programme updated.");
      router.push(`/pif/${programme.id}`);
    } catch {
      showToast("Failed to update programme.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-400">
        <span className="material-symbols-outlined animate-spin text-[24px] mr-2">progress_activity</span>
        <span className="text-sm">Loading…</span>
      </div>
    );
  }
  if (error || !programme) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error ?? "Programme not found."}
        </div>
        <Link href="/pif" className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Programmes
        </Link>
      </div>
    );
  }

  if (programme.status !== "draft") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Only draft programmes can be edited.
        </div>
        <Link href={`/pif/${programme.id}`} className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1">
          Back to programme
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {toast}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/pif" className="hover:text-primary transition-colors">Programmes</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href={`/pif/${programme.id}`} className="hover:text-primary transition-colors">{programme.reference_number}</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Edit</span>
      </div>
      <h1 className="text-xl font-bold text-neutral-900">Edit programme</h1>
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Title <span className="text-red-500">*</span></label>
          <input
            required
            className="form-input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Programme title"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Strategic pillar</label>
            <input className="form-input w-full" value={strategicPillar} onChange={(e) => setStrategicPillar(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Implementing department</label>
            <input className="form-input w-full" value={implementingDepartment} onChange={(e) => setImplementingDepartment(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Background</label>
          <textarea rows={4} className="form-input w-full resize-none" value={background} onChange={(e) => setBackground(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Overall objective</label>
          <textarea rows={3} className="form-input w-full resize-none" value={overallObjective} onChange={(e) => setOverallObjective(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Primary currency</label>
            <input className="form-input w-full" value={primaryCurrency} onChange={(e) => setPrimaryCurrency(e.target.value)} placeholder="e.g. USD" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Total budget</label>
            <input type="number" min="0" step="any" className="form-input w-full" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Funding source</label>
            <input className="form-input w-full" value={fundingSource} onChange={(e) => setFundingSource(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Responsible officer</label>
            <p className="text-xs text-neutral-400 mb-1">Must be a user registered in the system</p>
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
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Start date</label>
            <input type="date" className="form-input w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">End date</label>
            <input type="date" className="form-input w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={travelRequired} onChange={(e) => setTravelRequired(e.target.checked)} className="rounded border-neutral-300" />
            <span className="text-sm text-neutral-700">Travel required</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={procurementRequired} onChange={(e) => setProcurementRequired(e.target.checked)} className="rounded border-neutral-300" />
            <span className="text-sm text-neutral-700">Procurement required</span>
          </label>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Delegates count</label>
          <input type="number" min="0" className="form-input w-full max-w-[120px]" value={delegatesCount} onChange={(e) => setDelegatesCount(e.target.value)} />
        </div>

        {/* Venue */}
        <div className="pt-4 border-t border-neutral-100 space-y-4">
          <h2 className="text-sm font-bold text-neutral-900">Venue</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Venue country</label>
              <input className="form-input w-full" value={venueCountry} onChange={(e) => setVenueCountry(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Venue city</label>
              <input className="form-input w-full" value={venueCity} onChange={(e) => setVenueCity(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Proposed hotel</label>
            <input className="form-input w-full" value={venueProposedHotel} onChange={(e) => setVenueProposedHotel(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={venueAccommodationRequired} onChange={(e) => setVenueAccommodationRequired(e.target.checked)} className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-700">Accommodation required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={venueConferencingRequired} onChange={(e) => setVenueConferencingRequired(e.target.checked)} className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-700">Conferencing required</span>
            </label>
          </div>
          {(venueAccommodationRequired || venueConferencingRequired) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {venueAccommodationRequired && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Accommodation count</label>
                  <input type="number" min="0" className="form-input w-full" value={venueAccommodationCount} onChange={(e) => setVenueAccommodationCount(e.target.value)} />
                </div>
              )}
              {venueConferencingRequired && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Conferencing participants</label>
                  <input type="number" min="0" className="form-input w-full" value={venueConferencingParticipants} onChange={(e) => setVenueConferencingParticipants(e.target.value)} />
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={venueQuotationAttached} onChange={(e) => setVenueQuotationAttached(e.target.checked)} className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-700">Venue quotation attached</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={venueHotelQuotationAttached} onChange={(e) => setVenueHotelQuotationAttached(e.target.checked)} className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-700">Hotel quotation attached</span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Accessibility requirements</label>
            <textarea rows={2} className="form-input w-full resize-none" value={venueAccessibilityRequirements} onChange={(e) => setVenueAccessibilityRequirements(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Security considerations</label>
            <textarea rows={2} className="form-input w-full resize-none" value={venueSecurityConsiderations} onChange={(e) => setVenueSecurityConsiderations(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Venue comments</label>
            <textarea rows={2} className="form-input w-full resize-none" value={venueComments} onChange={(e) => setVenueComments(e.target.value)} />
          </div>
        </div>

        {/* Budget variance */}
        <div className="pt-4 border-t border-neutral-100 space-y-4">
          <h2 className="text-sm font-bold text-neutral-900">Budget variance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Proposed DSA rate</label>
              <input type="number" min="0" step="any" className="form-input w-full" value={proposedDsaRate} onChange={(e) => setProposedDsaRate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Original budget rate</label>
              <input type="number" min="0" step="any" className="form-input w-full" value={originalBudgetRate} onChange={(e) => setOriginalBudgetRate(e.target.value)} />
            </div>
          </div>
          {proposedDsaRate !== "" && originalBudgetRate !== "" && parseFloat(proposedDsaRate) !== parseFloat(originalBudgetRate) && (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Reason for DSA rate variance <span className="text-red-500">*</span></label>
              <textarea rows={2} className="form-input w-full resize-none" value={dsaVarianceReason} onChange={(e) => setDsaVarianceReason(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Proposed participants</label>
              <input type="number" min="0" className="form-input w-full" value={proposedParticipants} onChange={(e) => setProposedParticipants(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Budgeted participants</label>
              <input type="number" min="0" className="form-input w-full" value={budgetedParticipants} onChange={(e) => setBudgetedParticipants(e.target.value)} />
            </div>
          </div>
          {proposedParticipants !== "" && budgetedParticipants !== "" && parseInt(proposedParticipants, 10) !== parseInt(budgetedParticipants, 10) && (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Reason for participants variance <span className="text-red-500">*</span></label>
              <textarea rows={2} className="form-input w-full resize-none" value={participantsVarianceReason} onChange={(e) => setParticipantsVarianceReason(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Proposed funding difference</label>
              <input type="number" min="0" step="any" className="form-input w-full" value={proposedFundingDifference} onChange={(e) => setProposedFundingDifference(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Estimated activity amount</label>
              <input type="number" min="0" step="any" className="form-input w-full" value={estimatedActivityAmount} onChange={(e) => setEstimatedActivityAmount(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Personnel / consultants */}
        <div className="pt-4 border-t border-neutral-100 space-y-4">
          <h2 className="text-sm font-bold text-neutral-900">Personnel &amp; consultants</h2>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={secretariatStaffRequired} onChange={(e) => setSecretariatStaffRequired(e.target.checked)} className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-700">Secretariat staff required</span>
            </label>
            {secretariatStaffRequired && (
              <div className="max-w-[200px]">
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Staff count</label>
                <input type="number" min="0" className="form-input w-full" value={secretariatStaffCount} onChange={(e) => setSecretariatStaffCount(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={consultantsRequired} onChange={(e) => setConsultantsRequired(e.target.checked)} className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-700">Consultants required</span>
            </label>
            {consultantsRequired && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Consultants count</label>
                  <input type="number" min="0" className="form-input w-full" value={consultantsCount} onChange={(e) => setConsultantsCount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Consultant rate</label>
                  <input type="number" min="0" step="any" className="form-input w-full" value={consultantsRate} onChange={(e) => setConsultantsRate(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={resourcePersonsRequired} onChange={(e) => setResourcePersonsRequired(e.target.checked)} className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-700">Resource persons required</span>
            </label>
            {resourcePersonsRequired && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Resource persons count</label>
                  <input type="number" min="0" className="form-input w-full" value={resourcePersonsCount} onChange={(e) => setResourcePersonsCount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Resource person rate</label>
                  <input type="number" min="0" step="any" className="form-input w-full" value={resourcePersonsRate} onChange={(e) => setResourcePersonsRate(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={rapporteursRequired} onChange={(e) => setRapporteursRequired(e.target.checked)} className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-700">Rapporteurs required</span>
            </label>
            {rapporteursRequired && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Rapporteurs count</label>
                  <input type="number" min="0" className="form-input w-full" value={rapporteursCount} onChange={(e) => setRapporteursCount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Rapporteur rate</label>
                  <input type="number" min="0" step="any" className="form-input w-full" value={rapporteursRate} onChange={(e) => setRapporteursRate(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={mediaLiaisonRequired} onChange={(e) => setMediaLiaisonRequired(e.target.checked)} className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-700">Media liaison required</span>
            </label>
            {mediaLiaisonRequired && (
              <div className="max-w-[200px]">
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Media liaison count</label>
                <input type="number" min="0" className="form-input w-full" value={mediaLiaisonCount} onChange={(e) => setMediaLiaisonCount(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={localSupportRequired} onChange={(e) => setLocalSupportRequired(e.target.checked)} className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-700">Local support required</span>
            </label>
            {localSupportRequired && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Local support count</label>
                  <input type="number" min="0" className="form-input w-full" value={localSupportCount} onChange={(e) => setLocalSupportCount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Local support rate</label>
                  <input type="number" min="0" step="any" className="form-input w-full" value={localSupportRate} onChange={(e) => setLocalSupportRate(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Personnel comments</label>
            <textarea rows={2} className="form-input w-full resize-none" value={personnelComments} onChange={(e) => setPersonnelComments(e.target.value)} />
          </div>
        </div>

        {/* Interpretation & translation */}
        <div className="pt-4 border-t border-neutral-100 space-y-4">
          <h2 className="text-sm font-bold text-neutral-900">Interpretation &amp; translation</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={interpretationRequired} onChange={(e) => setInterpretationRequired(e.target.checked)} className="rounded border-neutral-300" />
            <span className="text-sm text-neutral-700">Interpretation required</span>
          </label>

          {interpretationRequired && (
            <div className="space-y-4 pl-1">
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={enFrRequired} onChange={(e) => setEnFrRequired(e.target.checked)} className="rounded border-neutral-300" />
                  <span className="text-sm text-neutral-700">English ↔ French interpreters required</span>
                </label>
                {enFrRequired && (
                  <div className="max-w-[200px]">
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">EN/FR interpreters count</label>
                    <input type="number" min="0" className="form-input w-full" value={enFrInterpretersCount} onChange={(e) => setEnFrInterpretersCount(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={enPtRequired} onChange={(e) => setEnPtRequired(e.target.checked)} className="rounded border-neutral-300" />
                  <span className="text-sm text-neutral-700">English ↔ Portuguese interpreters required</span>
                </label>
                {enPtRequired && (
                  <div className="max-w-[200px]">
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">EN/PT interpreters count</label>
                    <input type="number" min="0" className="form-input w-full" value={enPtInterpretersCount} onChange={(e) => setEnPtInterpretersCount(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={frPtRequired} onChange={(e) => setFrPtRequired(e.target.checked)} className="rounded border-neutral-300" />
                  <span className="text-sm text-neutral-700">French ↔ Portuguese interpreters required</span>
                </label>
                {frPtRequired && (
                  <div className="max-w-[200px]">
                    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">FR/PT interpreters count</label>
                    <input type="number" min="0" className="form-input w-full" value={frPtInterpretersCount} onChange={(e) => setFrPtInterpretersCount(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Interpreter rate</label>
                  <input type="number" min="0" step="any" className="form-input w-full" value={interpreterRate} onChange={(e) => setInterpreterRate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Interpreter source</label>
                  <select className="form-input w-full" value={interpreterSource} onChange={(e) => setInterpreterSource(e.target.value)}>
                    <option value="">Select source…</option>
                    <option value="internal">Internal</option>
                    <option value="supplier">Supplier</option>
                    <option value="partner">Partner</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              {interpreterSource === "other" && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Interpreter source (other) <span className="text-red-500">*</span></label>
                  <input className="form-input w-full" value={interpreterSourceOtherNote} onChange={(e) => setInterpreterSourceOtherNote(e.target.value)} />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={interpretationEquipmentRequired} onChange={(e) => setInterpretationEquipmentRequired(e.target.checked)} className="rounded border-neutral-300" />
                <span className="text-sm text-neutral-700">Interpretation equipment required</span>
              </label>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={translationRequired} onChange={(e) => setTranslationRequired(e.target.checked)} className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-700">Translation required</span>
            </label>
            {translationRequired && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Languages required <span className="text-red-500">*</span></label>
                <p className="text-xs text-neutral-400 mb-1">Comma-separated list, e.g. English, French, Portuguese</p>
                <input className="form-input w-full" value={languagesRequired} onChange={(e) => setLanguagesRequired(e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Interpretation comments</label>
            <textarea rows={2} className="form-input w-full resize-none" value={interpretationComments} onChange={(e) => setInterpretationComments(e.target.value)} />
          </div>
        </div>

        {/* Support services */}
        <div className="pt-4 border-t border-neutral-100 space-y-4">
          <h2 className="text-sm font-bold text-neutral-900">Support services</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUPPORT_SERVICE_OPTIONS.map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-neutral-300"
                  checked={supportServices.includes(opt.key)}
                  onChange={(e) =>
                    setSupportServices((prev) =>
                      e.target.checked ? [...prev, opt.key] : prev.filter((k) => k !== opt.key)
                    )
                  }
                />
                <span className="text-sm text-neutral-700">{opt.label}</span>
              </label>
            ))}
          </div>
          {supportServices.includes("other") && (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Other support services <span className="text-red-500">*</span></label>
              <input required className="form-input w-full" value={supportServicesOtherNote} onChange={(e) => setSupportServicesOtherNote(e.target.value)} />
            </div>
          )}
        </div>

        {/* Conflict of interest */}
        <div className="pt-4 border-t border-neutral-100 space-y-4">
          <h2 className="text-sm font-bold text-neutral-900">Conflict of interest</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={conflictDeclared} onChange={(e) => setConflictDeclared(e.target.checked)} className="rounded border-neutral-300" />
            <span className="text-sm text-neutral-700">A conflict of interest is declared for this programme</span>
          </label>
          {conflictDeclared && (
            <div className="space-y-4 pl-1">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Conflict details <span className="text-red-500">*</span></label>
                <textarea required rows={3} className="form-input w-full resize-none" value={conflictDetails} onChange={(e) => setConflictDetails(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Mitigation measures <span className="text-red-500">*</span></label>
                <textarea required rows={3} className="form-input w-full resize-none" value={conflictMitigation} onChange={(e) => setConflictMitigation(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="pt-4 border-t border-neutral-100 space-y-4">
          <h2 className="text-sm font-bold text-neutral-900">Documents</h2>
          <p className="text-xs text-neutral-400">Each row is saved to the server as soon as it's added — it is not held until the form is submitted.</p>
          <DocumentsSection
            programmeId={programme.id}
            initialRows={programme.documents ?? []}
            tenantUsers={tenantUsers}
            onToast={showToast}
          />
        </div>

        {/* Arrival / Departure */}
        <div className="pt-4 border-t border-neutral-100 space-y-4">
          <h2 className="text-sm font-bold text-neutral-900">Arrival / Departure</h2>
          <p className="text-xs text-neutral-400">Each row is saved to the server as soon as it's added — it is not held until the form is submitted.</p>
          <ArrivalDepartureSection
            programmeId={programme.id}
            initialRows={programme.arrivalDepartures ?? []}
            onToast={showToast}
          />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-neutral-100">
          <button type="submit" disabled={submitting} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
            {submitting ? "Saving…" : "Save changes"}
          </button>
          <Link href={`/pif/${programme.id}`} className="btn-secondary px-5 py-2.5 text-sm">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
