"use client";

import type { Programme, ProgrammeDocument } from "@/lib/api";
import { SUPPORT_SERVICE_OPTIONS } from "@/lib/api";
import { useFormatDate } from "@/lib/useFormatDate";

type TenantUser = { id: number; name: string; email: string };

const FINANCE_STATUS_LABELS: Record<string, string> = {
  not_checked: "Not Checked",
  available: "Available",
  partially_available: "Partially Available",
  unavailable: "Unavailable",
  confirmed_with_conditions: "Confirmed with Conditions",
};

const INTERPRETER_SOURCE_LABELS: Record<string, string> = {
  internal: "Internal",
  supplier: "Supplier",
  partner: "Partner",
  other: "Other",
};

function yesNo(v: boolean | null | undefined): string {
  return v ? "Yes" : "No";
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-neutral-400">{label}</p>
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

  const resolveOwner = (doc: ProgrammeDocument): string => {
    if (doc.owner_user_id != null) {
      const u = tenantUsers.find((t) => t.id === doc.owner_user_id);
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
      <SectionCard title="Venue">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country" value={programme.venue_country} />
          <Field label="City" value={programme.venue_city} />
          <Field label="Proposed hotel" value={programme.venue_proposed_hotel} />
          <Field label="Accommodation required" value={yesNo(programme.venue_accommodation_required)} />
          {programme.venue_accommodation_required && (
            <Field label="Accommodation count" value={programme.venue_accommodation_count} />
          )}
          <Field label="Conferencing required" value={yesNo(programme.venue_conferencing_required)} />
          {programme.venue_conferencing_required && (
            <Field label="Conferencing participants" value={programme.venue_conferencing_participants} />
          )}
          <Field label="Venue quotation attached" value={yesNo(programme.venue_quotation_attached)} />
          <Field label="Hotel quotation attached" value={yesNo(programme.venue_hotel_quotation_attached)} />
        </div>
        {(programme.venue_accessibility_requirements || programme.venue_security_considerations || programme.venue_comments) && (
          <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t border-neutral-100">
            {programme.venue_accessibility_requirements && (
              <Field label="Accessibility requirements" value={programme.venue_accessibility_requirements} />
            )}
            {programme.venue_security_considerations && (
              <Field label="Security considerations" value={programme.venue_security_considerations} />
            )}
            {programme.venue_comments && <Field label="Comments" value={programme.venue_comments} />}
          </div>
        )}
      </SectionCard>

      {/* Budget / Participant Provisions */}
      <SectionCard title="Budget &amp; Participant Provisions">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Proposed DSA rate" value={programme.proposed_dsa_rate != null ? `${programme.primary_currency} ${Number(programme.proposed_dsa_rate).toLocaleString()}` : null} />
          <Field label="Original budget rate" value={programme.original_budget_rate != null ? `${programme.primary_currency} ${Number(programme.original_budget_rate).toLocaleString()}` : null} />
          {programme.dsa_variance_reason && <Field label="DSA variance reason" value={programme.dsa_variance_reason} />}
          <Field label="Proposed participants" value={programme.proposed_participants} />
          <Field label="Budgeted participants" value={programme.budgeted_participants} />
          {programme.participants_variance_reason && (
            <Field label="Participants variance reason" value={programme.participants_variance_reason} />
          )}
          <Field label="Proposed funding difference" value={programme.proposed_funding_difference != null ? `${programme.primary_currency} ${Number(programme.proposed_funding_difference).toLocaleString()}` : null} />
          <Field label="Estimated activity amount" value={programme.estimated_activity_amount != null ? `${programme.primary_currency} ${Number(programme.estimated_activity_amount).toLocaleString()}` : null} />
        </div>
        {/* Finance review — read-only here; only Finance can set it via a dedicated action elsewhere */}
        <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t border-neutral-100">
          <Field
            label="Budget availability status"
            value={
              programme.budget_availability_status
                ? FINANCE_STATUS_LABELS[programme.budget_availability_status] ?? programme.budget_availability_status
                : FINANCE_STATUS_LABELS.not_checked
            }
          />
          {programme.finance_comments && <Field label="Finance comments" value={programme.finance_comments} />}
        </div>
      </SectionCard>

      {/* Personnel */}
      <SectionCard title="Personnel &amp; Consultants">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Secretariat staff required" value={yesNo(programme.secretariat_staff_required)} />
          {programme.secretariat_staff_required && <Field label="Secretariat staff count" value={programme.secretariat_staff_count} />}
          <Field label="Consultants required" value={yesNo(programme.consultants_required)} />
          {programme.consultants_required && (
            <>
              <Field label="Consultants count" value={programme.consultants_count} />
              <Field label="Consultant rate" value={programme.consultants_rate != null ? `${programme.primary_currency} ${Number(programme.consultants_rate).toLocaleString()}` : null} />
            </>
          )}
          <Field label="Resource persons required" value={yesNo(programme.resource_persons_required)} />
          {programme.resource_persons_required && (
            <>
              <Field label="Resource persons count" value={programme.resource_persons_count} />
              <Field label="Resource person rate" value={programme.resource_persons_rate != null ? `${programme.primary_currency} ${Number(programme.resource_persons_rate).toLocaleString()}` : null} />
            </>
          )}
          <Field label="Rapporteurs required" value={yesNo(programme.rapporteurs_required)} />
          {programme.rapporteurs_required && (
            <>
              <Field label="Rapporteurs count" value={programme.rapporteurs_count} />
              <Field label="Rapporteur rate" value={programme.rapporteurs_rate != null ? `${programme.primary_currency} ${Number(programme.rapporteurs_rate).toLocaleString()}` : null} />
            </>
          )}
          <Field label="Media liaison required" value={yesNo(programme.media_liaison_required)} />
          {programme.media_liaison_required && <Field label="Media liaison count" value={programme.media_liaison_count} />}
          <Field label="Local support required" value={yesNo(programme.local_support_required)} />
          {programme.local_support_required && (
            <>
              <Field label="Local support count" value={programme.local_support_count} />
              <Field label="Local support rate" value={programme.local_support_rate != null ? `${programme.primary_currency} ${Number(programme.local_support_rate).toLocaleString()}` : null} />
            </>
          )}
        </div>
        {programme.personnel_comments && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <Field label="Personnel comments" value={programme.personnel_comments} />
          </div>
        )}
      </SectionCard>

      {/* Interpretation */}
      <SectionCard title="Interpretation &amp; Translation">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Interpretation required" value={yesNo(programme.interpretation_required)} />
          {programme.interpretation_required && (
            <>
              <Field label="English ↔ French" value={programme.en_fr_required ? `Yes — ${programme.en_fr_interpreters_count ?? 0} interpreter(s)` : "No"} />
              <Field label="English ↔ Portuguese" value={programme.en_pt_required ? `Yes — ${programme.en_pt_interpreters_count ?? 0} interpreter(s)` : "No"} />
              <Field label="French ↔ Portuguese" value={programme.fr_pt_required ? `Yes — ${programme.fr_pt_interpreters_count ?? 0} interpreter(s)` : "No"} />
              <Field label="Interpreter rate" value={programme.interpreter_rate != null ? `${programme.primary_currency} ${Number(programme.interpreter_rate).toLocaleString()}` : null} />
              <Field
                label="Interpreter source"
                value={
                  programme.interpreter_source
                    ? (INTERPRETER_SOURCE_LABELS[programme.interpreter_source] ?? programme.interpreter_source) +
                      (programme.interpreter_source === "other" && programme.interpreter_source_other_note ? ` — ${programme.interpreter_source_other_note}` : "")
                    : null
                }
              />
              <Field label="Interpretation equipment required" value={yesNo(programme.interpretation_equipment_required)} />
            </>
          )}
          <Field label="Translation required" value={yesNo(programme.translation_required)} />
          {programme.translation_required && (programme.languages_required ?? []).length > 0 && (
            <Field label="Languages required" value={(programme.languages_required ?? []).join(", ")} />
          )}
        </div>
        {programme.interpretation_comments && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <Field label="Interpretation comments" value={programme.interpretation_comments} />
          </div>
        )}
      </SectionCard>

      {/* Documents */}
      <SectionCard title="Documents">
        {documents.length === 0 ? (
          <p className="text-sm text-neutral-400">No documents registered.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Owner</th>
                  <th>Translation</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium text-neutral-900">{d.title}</td>
                    <td className="text-neutral-600">{d.document_type}</td>
                    <td className="text-neutral-600">{resolveOwner(d)}</td>
                    <td className="text-xs text-neutral-500">
                      {d.translation_required ? (d.target_languages ?? []).join(", ") || "Required" : "Not required"}
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
      <SectionCard title="Arrival / Departure">
        {arrivalDepartures.length === 0 ? (
          <p className="text-sm text-neutral-400">No arrival/departure rows recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Arrival</th>
                  <th>Departure</th>
                  <th>Airport</th>
                  <th>Transport</th>
                  <th>Accommodation</th>
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
      <SectionCard title="Support Services">
        {supportServices.length === 0 ? (
          <p className="text-sm text-neutral-400">No support services selected.</p>
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
          <p className="text-sm text-neutral-600 mt-3">Other: {programme.support_services_other_note}</p>
        )}
      </SectionCard>

      {/* Conflict of Interest */}
      <SectionCard title="Conflict of Interest">
        <Field label="Conflict declared" value={yesNo(programme.conflict_declared)} />
        {programme.conflict_declared && (
          <div className="grid gap-4 sm:grid-cols-2 mt-4 pt-4 border-t border-neutral-100">
            <Field label="Details" value={programme.conflict_details} />
            <Field label="Mitigation measures" value={programme.conflict_mitigation} />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
