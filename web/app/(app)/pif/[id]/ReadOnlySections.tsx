"use client";

import type { Programme, ProgrammeDocument } from "@/lib/api";
import { SUPPORT_SERVICE_OPTIONS } from "@/lib/api";
import { useFormatDate } from "@/lib/useFormatDate";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type TenantUser = { id: number; name: string; email: string };

const FINANCE_STATUS_LABELS: Record<string, string> = {
  not_checked: "pif.financeStatus.not_checked",
  available: "pif.financeStatus.available",
  partially_available: "pif.financeStatus.partially_available",
  unavailable: "pif.financeStatus.unavailable",
  confirmed_with_conditions: "pif.financeStatus.confirmed_with_conditions",
};

const INTERPRETER_SOURCE_LABELS: Record<string, string> = {
  internal: "pif.interpreterSource.internal",
  supplier: "pif.interpreterSource.supplier",
  partner: "pif.interpreterSource.partner",
  other: "pif.interpreterSource.other",
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="card p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">{t(title)}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div>
      <p className="text-xs text-neutral-400">{t(label)}</p>
      <p className="text-sm font-medium text-neutral-800 mt-0.5">{value ?? "—"}</p>
    </div>
  );
}

/** Read-only display of the sections added to the PIF form in Tasks 17-20:
 * Venue, Budget/Participant Provisions, Personnel, Interpretation, Documents,
 * Arrival/Departure, Support Services, Conflict of Interest. Mirrors the edit
 * form's field set in `edit/page.tsx` but purely for display — none of these
 * fields are editable from this view. */
export default function ReadOnlySections({
  programme,
  tenantUsers,
}: {
  programme: Programme;
  tenantUsers: TenantUser[];
}) {
  const { fmt: formatDateShort } = useFormatDate();
  const { t } = useI18n();
  const yesNo = (v: boolean | null | undefined): string => (v ? t("contracts.common.yes") : t("contracts.common.no"));
  const interpreters = (required: boolean | null | undefined, count: number | null | undefined): string =>
    required ? t("pif.readonly.yesInterpreters", { count: count ?? 0 }) : t("contracts.common.no");

  const resolveOwner = (doc: ProgrammeDocument): string => {
    if (doc.owner_user_id != null) {
      const u = tenantUsers.find((tu) => tu.id === doc.owner_user_id);
      if (u) return u.name;
    }
    if (doc.owner_name) {
      return doc.owner_organisation ? `${doc.owner_name} (${doc.owner_organisation})` : doc.owner_name;
    }
    return "—";
  };

  const documents = programme.documents ?? [];
  const arrivalDepartures = programme.arrival_departures ?? [];
  const supportServices = programme.support_services ?? [];

  return (
    <div className="space-y-6">
      {/* Venue */}
      <SectionCard title="pif.field.venue">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="pif.field.country" value={programme.venue_country} />
          <Field label="pif.field.city" value={programme.venue_city} />
          <Field label="pif.field.proposedHotel" value={programme.venue_proposed_hotel} />
          <Field label="pif.field.accommodationRequired" value={yesNo(programme.venue_accommodation_required)} />
          {programme.venue_accommodation_required && (
            <Field label="pif.field.accommodationCount" value={programme.venue_accommodation_count} />
          )}
          <Field label="pif.field.conferencingRequired" value={yesNo(programme.venue_conferencing_required)} />
          {programme.venue_conferencing_required && (
            <Field label="pif.field.conferencingParticipants" value={programme.venue_conferencing_participants} />
          )}
          <Field label="pif.field.venueQuotationAttached" value={yesNo(programme.venue_quotation_attached)} />
          <Field label="pif.field.hotelQuotationAttached" value={yesNo(programme.venue_hotel_quotation_attached)} />
        </div>
        {(programme.venue_accessibility_requirements || programme.venue_security_considerations || programme.venue_comments) && (
          <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t border-neutral-100">
            {programme.venue_accessibility_requirements && (
              <Field label="pif.field.accessibilityRequirements" value={programme.venue_accessibility_requirements} />
            )}
            {programme.venue_security_considerations && (
              <Field label="pif.field.securityConsiderations" value={programme.venue_security_considerations} />
            )}
            {programme.venue_comments && <Field label="pif.field.comments" value={programme.venue_comments} />}
          </div>
        )}
      </SectionCard>

      {/* Budget / Participant Provisions */}
      <SectionCard title="pif.field.budgetProvisions">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="pif.field.proposedDsaRate" value={programme.proposed_dsa_rate != null ? `${programme.primary_currency} ${Number(programme.proposed_dsa_rate).toLocaleString()}` : null} />
          <Field label="pif.field.originalBudgetRate" value={programme.original_budget_rate != null ? `${programme.primary_currency} ${Number(programme.original_budget_rate).toLocaleString()}` : null} />
          {programme.dsa_variance_reason && <Field label="pif.field.dsaVarianceReason" value={programme.dsa_variance_reason} />}
          <Field label="pif.field.proposedParticipants" value={programme.proposed_participants} />
          <Field label="pif.field.budgetedParticipants" value={programme.budgeted_participants} />
          {programme.participants_variance_reason && (
            <Field label="pif.field.participantsVarianceReason" value={programme.participants_variance_reason} />
          )}
          <Field label="pif.field.proposedFundingDifference" value={programme.proposed_funding_difference != null ? `${programme.primary_currency} ${Number(programme.proposed_funding_difference).toLocaleString()}` : null} />
          <Field label="pif.field.estimatedActivityAmount" value={programme.estimated_activity_amount != null ? `${programme.primary_currency} ${Number(programme.estimated_activity_amount).toLocaleString()}` : null} />
        </div>
        {/* Finance review — read-only here; only Finance can set it via a dedicated action elsewhere */}
        <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t border-neutral-100">
          <Field
            label="pif.field.budgetAvailabilityStatus"
            value={
              programme.budget_availability_status
                ? (FINANCE_STATUS_LABELS[programme.budget_availability_status] ? t(FINANCE_STATUS_LABELS[programme.budget_availability_status]) : programme.budget_availability_status)
                : t(FINANCE_STATUS_LABELS.not_checked)
            }
          />
          {programme.finance_comments && <Field label="pif.field.financeComments" value={programme.finance_comments} />}
        </div>
      </SectionCard>

      {/* Personnel */}
      <SectionCard title="pif.field.personnel">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="pif.field.secretariatStaffRequired" value={yesNo(programme.secretariat_staff_required)} />
          {programme.secretariat_staff_required && <Field label="pif.field.secretariatStaffCount" value={programme.secretariat_staff_count} />}
          <Field label="pif.field.consultantsRequired" value={yesNo(programme.consultants_required)} />
          {programme.consultants_required && (
            <>
              <Field label="pif.field.consultantsCount" value={programme.consultants_count} />
              <Field label="pif.field.consultantRate" value={programme.consultants_rate != null ? `${programme.primary_currency} ${Number(programme.consultants_rate).toLocaleString()}` : null} />
            </>
          )}
          <Field label="pif.field.resourcePersonsRequired" value={yesNo(programme.resource_persons_required)} />
          {programme.resource_persons_required && (
            <>
              <Field label="pif.field.resourcePersonsCount" value={programme.resource_persons_count} />
              <Field label="pif.field.resourcePersonRate" value={programme.resource_persons_rate != null ? `${programme.primary_currency} ${Number(programme.resource_persons_rate).toLocaleString()}` : null} />
            </>
          )}
          <Field label="pif.field.rapporteursRequired" value={yesNo(programme.rapporteurs_required)} />
          {programme.rapporteurs_required && (
            <>
              <Field label="pif.field.rapporteursCount" value={programme.rapporteurs_count} />
              <Field label="pif.field.rapporteurRate" value={programme.rapporteurs_rate != null ? `${programme.primary_currency} ${Number(programme.rapporteurs_rate).toLocaleString()}` : null} />
            </>
          )}
          <Field label="pif.field.mediaLiaisonRequired" value={yesNo(programme.media_liaison_required)} />
          {programme.media_liaison_required && (
            <>
              <Field label="pif.field.mediaLiaisonCount" value={programme.media_liaison_count} />
              <Field label="pif.field.mediaLiaisonRate" value={programme.media_liaison_rate != null ? `${programme.primary_currency} ${Number(programme.media_liaison_rate).toLocaleString()}` : null} />
            </>
          )}
          <Field label="pif.field.localSupportRequired" value={yesNo(programme.local_support_required)} />
          {programme.local_support_required && (
            <>
              <Field label="pif.field.localSupportCount" value={programme.local_support_count} />
              <Field label="pif.field.localSupportRate" value={programme.local_support_rate != null ? `${programme.primary_currency} ${Number(programme.local_support_rate).toLocaleString()}` : null} />
            </>
          )}
        </div>
        {programme.personnel_comments && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <Field label="pif.field.personnelComments" value={programme.personnel_comments} />
          </div>
        )}
      </SectionCard>

      {/* Interpretation */}
      <SectionCard title="pif.field.interpretationTitle">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="pif.field.interpretationRequired" value={yesNo(programme.interpretation_required)} />
          {programme.interpretation_required && (
            <>
              <Field label="pif.field.enFr" value={interpreters(programme.en_fr_required, programme.en_fr_interpreters_count)} />
              <Field label="pif.field.enPt" value={interpreters(programme.en_pt_required, programme.en_pt_interpreters_count)} />
              <Field label="pif.field.frPt" value={interpreters(programme.fr_pt_required, programme.fr_pt_interpreters_count)} />
              <Field label="pif.field.interpreterRate" value={programme.interpreter_rate != null ? `${programme.primary_currency} ${Number(programme.interpreter_rate).toLocaleString()}` : null} />
              <Field
                label="pif.field.interpreterSource"
                value={
                  programme.interpreter_source
                    ? (INTERPRETER_SOURCE_LABELS[programme.interpreter_source] ? t(INTERPRETER_SOURCE_LABELS[programme.interpreter_source]) : programme.interpreter_source) +
                      (programme.interpreter_source === "other" && programme.interpreter_source_other_note ? ` — ${programme.interpreter_source_other_note}` : "")
                    : null
                }
              />
              <Field label="pif.field.interpretationEquipmentRequired" value={yesNo(programme.interpretation_equipment_required)} />
            </>
          )}
          <Field label="pif.field.translationRequired" value={yesNo(programme.translation_required)} />
          {programme.translation_required && (programme.languages_required ?? []).length > 0 && (
            <Field label="pif.field.languagesRequired" value={(programme.languages_required ?? []).join(", ")} />
          )}
        </div>
        {programme.interpretation_comments && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <Field label="pif.field.interpretationComments" value={programme.interpretation_comments} />
          </div>
        )}
      </SectionCard>

      {/* Documents */}
      <SectionCard title="pif.field.documents">
        {documents.length === 0 ? (
          <p className="text-sm text-neutral-400">{t("pif.readonly.noDocuments")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("pif.list.title")}</th>
                  <th>{t("pif.detail.type")}</th>
                  <th>{t("pif.readonly.owner")}</th>
                  <th>{t("pif.readonly.translation")}</th>
                  <th>{t("pif.readonly.deadline")}</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium text-neutral-900">{d.title}</td>
                    <td className="text-neutral-600">{d.document_type}</td>
                    <td className="text-neutral-600">{resolveOwner(d)}</td>
                    <td className="text-xs text-neutral-500">
                      {d.translation_required ? (d.target_languages ?? []).join(", ") || t("contracts.settings.required") : t("contracts.settings.notRequired")}
                    </td>
                    <td className="text-xs text-neutral-500">{d.deadline ? formatDateShort(d.deadline) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Arrival / Departure */}
      <SectionCard title="pif.field.arrivalDeparture">
        {arrivalDepartures.length === 0 ? (
          <p className="text-sm text-neutral-400">{t("pif.readonly.noArrivals")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("pif.detail.category")}</th>
                  <th>{t("pif.readonly.arrival")}</th>
                  <th>{t("pif.readonly.departure")}</th>
                  <th>{t("pif.readonly.airport")}</th>
                  <th>{t("pif.readonly.transport")}</th>
                  <th>{t("pif.readonly.accommodation")}</th>
                </tr>
              </thead>
              <tbody>
                {arrivalDepartures.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-neutral-900">{r.category}</td>
                    <td className="text-xs text-neutral-500">{r.arrival_date ? formatDateShort(r.arrival_date) : "—"}</td>
                    <td className="text-xs text-neutral-500">{r.departure_date ? formatDateShort(r.departure_date) : "—"}</td>
                    <td className="text-neutral-600">{r.airport ?? "—"}</td>
                    <td className="text-xs text-neutral-500">{yesNo(r.transport_required)}</td>
                    <td className="text-xs text-neutral-500">{yesNo(r.accommodation_required)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Support Services */}
      <SectionCard title="pif.field.supportServices">
        {supportServices.length === 0 ? (
          <p className="text-sm text-neutral-400">{t("pif.readonly.noSupportServices")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {supportServices.map((key) => (
              <span key={key} className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {SUPPORT_SERVICE_OPTIONS.find((o) => o.key === key)?.label ?? key}
              </span>
            ))}
          </div>
        )}
        {programme.support_services_other_note && (
          <p className="text-sm text-neutral-600 mt-3">{t("pif.readonly.otherNote", { note: programme.support_services_other_note })}</p>
        )}
      </SectionCard>

      {/* Conflict of Interest */}
      <SectionCard title="pif.field.conflictOfInterest">
        <Field label="pif.field.conflictDeclared" value={yesNo(programme.conflict_declared)} />
        {programme.conflict_declared && (
          <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t border-neutral-100">
            <Field label="pif.field.details" value={programme.conflict_details} />
            <Field label="pif.field.mitigationMeasures" value={programme.conflict_mitigation} />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
