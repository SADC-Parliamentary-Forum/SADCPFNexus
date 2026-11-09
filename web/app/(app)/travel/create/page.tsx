"use client";

import { Suspense, useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { travelApi, programmeApi, TRAVEL_DOCUMENT_TYPES } from "@/lib/api";
import type { Programme, TravelDestinationCountry, TravelRequest } from "@/lib/api";
import { TravelDestinationFields, locationLabels } from "@/components/travel/DestinationPickers";
import { nextTravelLeg, emptyTravelLeg, type TravelLegDraft } from "@/lib/travelLegs";
import { FormField } from "@/components/ui/FormSection";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import BudgetLinePicker from "@/components/budget/BudgetLinePicker";
import { getListData } from "@/lib/listPagination";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Stepper } from "@/components/ui/Stepper";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { NexusPicker } from "@/components/ui/NexusPicker";
import { NexusMoneyInput } from "@/components/ui/NexusMoneyInput";
import { useFormDraft } from "@/lib/useFormDraft";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ─── Funding items with icons ─────────────────────────────────────────────────
const FUNDING_ITEMS: { item: string; icon: string }[] = [
  { item: "Air Fare",                      icon: "flight" },
  { item: "Transport to/from Airport",     icon: "directions_bus" },
  { item: "Accommodation",                 icon: "hotel" },
  { item: "Per Diems",                     icon: "payments" },
  { item: "Visa Fees",                     icon: "badge" },
  { item: "Airport Fees",                  icon: "local_airport" },
  { item: "Ground Transport",              icon: "directions_car" },
  { item: "Participation Fees",            icon: "confirmation_number" },
];

/** i18n keys of the funding item labels; `item` itself is the value sent to the API. */
const FUNDING_ITEM_LABELS: Record<string, string> = {
  "Air Fare": "travel.create.funding.airFare",
  "Transport to/from Airport": "travel.create.funding.airportTransport",
  Accommodation: "travel.create.funding.accommodation",
  "Per Diems": "travel.create.funding.perDiems",
  "Visa Fees": "travel.create.funding.visaFees",
  "Airport Fees": "travel.create.funding.airportFees",
  "Ground Transport": "travel.create.funding.groundTransport",
  "Participation Fees": "travel.create.funding.participationFees",
};

/** i18n keys of the wizard steps. */
const STEPS = [
  "travel.create.step.trip",
  "travel.create.step.itinerary",
  "travel.create.step.funding",
  "travel.create.step.vehicle",
  "travel.create.step.documents",
  "travel.create.step.review",
];

interface PendingDoc {
  key: string;
  file: File;
  documentType: string;
}

const REQUIRED_ON_SUBMIT = ["invitation", "agenda"] as const;

const CURRENCIES = ["USD", "EUR", "ZAR", "NAD", "BWP", "ZMW", "MWK", "TZS", "MZN"] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type Leg = TravelLegDraft;

interface FundingRow {
  item: string;
  icon: string;
  forum_amount: string;
  host_amount: string;
  funding_agency: string;
  project: string;
  budget_line: string;
  expanded: boolean;
  payor_sadc_pf: boolean;
  payor_host: boolean;
  payor_donor: boolean;
  payor_self: boolean;
}

interface FormData {
  purpose: string;
  host_organization: string;
  destination_country: string;
  destination_city: string;
  departure_date: string;
  return_date: string;
  currency: string;
  pif_type: "linked" | "justification" | "";
  programme_id: string;
  justification: string;
  budget_line_id: number | null;
  legs: Leg[];
  funding_rows: FundingRow[];
  vehicle_type: "sadcpf" | "private" | "";
  driver_required: boolean;
  driver_name: string;
  private_vehicle_reason: string;
  private_vehicle_route: string;
  estimated_kilometres: string;
  mileage_rate_per_km: string;
  equivalent_airfare: string;
  prepared_on_behalf_of: string;
}

// ─── Location combobox for legs (type or pick from list) ─────────────────────
function LocationCombobox({
  value,
  onChange,
  placeholder,
  locations,
  id,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  locations: string[];
  id?: string;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = locations.filter((l) =>
    l.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        id={id}
        className="w-full rounded-md border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        placeholder={placeholder ?? t("travel.create.typeOrSelect")}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((loc) => (
            <button
              key={loc}
              type="button"
              className="w-full text-left px-3 py-2 text-xs hover:bg-primary/5 text-neutral-700"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(loc);
                setQuery(loc);
                setOpen(false);
              }}
            >
              {loc}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function emptyFundingRows(): FundingRow[] {
  return FUNDING_ITEMS.map(({ item, icon }) => ({
    item,
    icon,
    forum_amount: "",
    host_amount: "",
    funding_agency: "",
    project: "",
    budget_line: "",
    expanded: false,
    payor_sadc_pf: false,
    payor_host: false,
    payor_donor: false,
    payor_self: false,
  }));
}

function hydrateFormFromRequest(data: TravelRequest): FormData {
  const fundingRows = emptyFundingRows();
  const lines = (data as TravelRequest & { funding_lines?: Array<Record<string, unknown>> }).funding_lines ?? [];
  for (const line of lines) {
    const idx = fundingRows.findIndex((r) => r.item === line.item);
    const target = idx >= 0 ? fundingRows[idx] : null;
    if (!target) continue;
    target.forum_amount = line.forum_amount != null ? String(line.forum_amount) : "";
    target.host_amount = line.host_amount != null ? String(line.host_amount) : "";
    target.funding_agency = typeof line.funding_agency === "string" ? line.funding_agency : "";
    target.project = typeof line.project === "string" ? line.project : "";
    target.budget_line = typeof line.budget_line === "string" ? line.budget_line : "";
    target.payor_sadc_pf = Boolean(line.payor_sadc_pf);
    target.payor_host = Boolean(line.payor_host);
    target.payor_donor = Boolean(line.payor_donor);
    target.payor_self = Boolean(line.payor_self);
    target.expanded = !!(target.forum_amount || target.host_amount);
  }

  const legs = (data.itineraries ?? []).map((leg) => ({
    from_location: leg.from_location ?? "",
    to_location: leg.to_location ?? "",
    travel_date: String(leg.travel_date ?? "").slice(0, 10),
    transport_mode: leg.transport_mode ?? "flight",
    days_count: Number(leg.days_count ?? 1) || 1,
    flight_name: leg.flight_name ?? leg.carrier ?? "",
    flight_number: leg.flight_number ?? "",
  }));

  const hasProgramme = data.programme_id != null;
  const hasJustification = Boolean(data.justification?.trim());

  return {
    purpose: data.purpose ?? "",
    host_organization: data.host_organization ?? "",
    destination_country: data.destination_country ?? "",
    destination_city: data.destination_city ?? "",
    departure_date: String(data.departure_date ?? "").slice(0, 10),
    return_date: String(data.return_date ?? "").slice(0, 10),
    currency: data.currency || "USD",
    pif_type: hasProgramme ? "linked" : hasJustification ? "justification" : "",
    programme_id: data.programme_id != null ? String(data.programme_id) : "",
    justification: data.justification ?? "",
    budget_line_id: (data as { budget_line_id?: number | null }).budget_line_id ?? null,
    legs: legs.length ? legs : [emptyTravelLeg()],
    funding_rows: fundingRows,
    vehicle_type: data.vehicle_type === "sadcpf" || data.vehicle_type === "private" ? data.vehicle_type : "",
    driver_required: Boolean((data as { driver_required?: boolean }).driver_required),
    driver_name: (data as { driver_name?: string | null }).driver_name ?? "",
    private_vehicle_reason: (data as { private_vehicle_reason?: string | null }).private_vehicle_reason ?? "",
    private_vehicle_route: (data as { private_vehicle_route?: string | null }).private_vehicle_route ?? "",
    estimated_kilometres:
      (data as { estimated_kilometres?: number | null }).estimated_kilometres != null
        ? String((data as { estimated_kilometres?: number | null }).estimated_kilometres)
        : "",
    mileage_rate_per_km:
      (data as { mileage_rate_per_km?: number | null }).mileage_rate_per_km != null
        ? String((data as { mileage_rate_per_km?: number | null }).mileage_rate_per_km)
        : "",
    equivalent_airfare:
      (data as { equivalent_airfare?: number | null }).equivalent_airfare != null
        ? String((data as { equivalent_airfare?: number | null }).equivalent_airfare)
        : "",
    prepared_on_behalf_of:
      data.prepared_on_behalf_of != null ? String(data.prepared_on_behalf_of) : "",
  };
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function TravelCreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { prompt } = useConfirm();
  const toast = useToast();
  const { t, localeTag } = useI18n();
  const editParam = searchParams.get("edit");
  const editId = editParam && /^\d+$/.test(editParam) ? Number(editParam) : null;

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stepHint, setStepHint] = useState<string | null>(null);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [pendingDocType, setPendingDocType] = useState<string>("invitation");
  const [existingDocTypes, setExistingDocTypes] = useState<string[]>([]);
  const [loadingDraft, setLoadingDraft] = useState(Boolean(editId));
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [travellers, setTravellers] = useState<Array<{ id: number; name: string; email?: string }>>([]);
  const [destinations, setDestinations] = useState<TravelDestinationCountry[]>([]);
  const [addingDestination, setAddingDestination] = useState(false);
  const catalogLocations = useMemo(() => locationLabels(destinations), [destinations]);
  // Defer localStorage user until after mount to avoid hydration #418 text mismatch.
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setUser(getStoredUser());
    setMounted(true);
  }, []);
  const canPrepareForOthers =
    mounted && (isSystemAdmin(user) || hasPermission(user, "travel.prepare-for-others"));
  const todayIso = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<FormData>({
    purpose: "",
    host_organization: "",
    destination_country: "",
    destination_city: "",
    departure_date: "",
    return_date: "",
    currency: "USD",
    pif_type: "",
    programme_id: "",
    justification: "",
    budget_line_id: null,
    legs: [emptyTravelLeg()],
    funding_rows: emptyFundingRows(),
    vehicle_type: "",
    driver_required: false,
    driver_name: "",
    private_vehicle_reason: "",
    private_vehicle_route: "",
    estimated_kilometres: "",
    mileage_rate_per_km: "",
    equivalent_airfare: "",
    prepared_on_behalf_of: "",
  });

  // Autosave new requests locally (files are not stored and must be re-attached),
  // and remember the server id once created so a retry updates it instead of
  // creating a second request.
  const draft = useFormDraft("travel.create", form, { enabled: !editId });
  const createdIdRef = useRef<number | null>(null);

  const requiredDocTypes = (): string[] => {
    const required: string[] = [...REQUIRED_ON_SUBMIT];
    if (form.programme_id) required.push("approved_pif");
    return required;
  };

  const missingRequiredDocs = (): string[] => {
    const attached = new Set([...existingDocTypes, ...pendingDocs.map((d) => d.documentType)]);
    return requiredDocTypes().filter((dt) => !attached.has(dt));
  };

  // Load approved programmes for PIF dropdown
  useEffect(() => {
    programmeApi
      .list({ status: "approved", per_page: 100 })
      .then((res) => {
        setProgrammes(getListData<Programme>(res.data));
      })
      .catch(() => setProgrammes([]));
  }, []);

  useEffect(() => {
    if (!canPrepareForOthers) return;
    travelApi
      .travellers()
      .then((r) => setTravellers(getListData<{ id: number; name: string; email?: string }>(r.data)))
      .catch(() => setTravellers([]));
  }, [canPrepareForOthers]);

  const reloadDestinations = () =>
    travelApi
      .listDestinations()
      .then((r) => setDestinations(r.data.data?.countries ?? []))
      .catch(() => setDestinations([]));

  useEffect(() => {
    void reloadDestinations();
  }, []);

  useEffect(() => {
    if (!editId) {
      setLoadingDraft(false);
      return;
    }
    let active = true;
    setLoadingDraft(true);
    setSubmitError(null);
    Promise.all([travelApi.get(editId), travelApi.listAttachments(editId)])
      .then(([reqRes, attRes]) => {
        if (!active) return;
        const body = reqRes.data as { data?: TravelRequest } | TravelRequest;
        const data = ("data" in body && body.data ? body.data : body) as TravelRequest;
        if (!data || typeof data !== "object" || !("id" in data)) {
          setSubmitError(t("travel.create.err.loadEdit"));
          return;
        }
        if (data.status !== "draft" && data.status !== "returned_for_correction") {
          setSubmitError(t("travel.create.err.notEditable"));
          return;
        }
        setForm(hydrateFormFromRequest(data));
        const docs = getListData<{ document_type?: string | null }>(attRes.data);
        setExistingDocTypes(docs.map((d) => d.document_type).filter((dt): dt is string => Boolean(dt)));
      })
      .catch(() => {
        if (active) setSubmitError(t("travel.create.err.loadEditFailed"));
      })
      .finally(() => {
        if (active) setLoadingDraft(false);
      });
    return () => {
      active = false;
    };
  }, [editId, t]);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleAddCountry = async (name: string) => {
    setAddingDestination(true);
    try {
      const res = await travelApi.createCountry({ name });
      await reloadDestinations();
      updateField("destination_country", res.data.data.name);
      updateField("destination_city", "");
    } finally {
      setAddingDestination(false);
    }
  };

  const handleAddCity = async (country: string, name: string) => {
    setAddingDestination(true);
    try {
      const res = await travelApi.createCity({ country, name });
      await reloadDestinations();
      updateField("destination_country", res.data.data.country);
      updateField("destination_city", res.data.data.name);
    } finally {
      setAddingDestination(false);
    }
  };

  const updateLeg = (index: number, field: keyof Leg, value: string | number) =>
    setForm((prev) => {
      const legs = [...prev.legs];
      legs[index] = { ...legs[index], [field]: value };
      return { ...prev, legs };
    });

  const addLeg = () =>
    setForm((prev) => ({
      ...prev,
      legs: [...prev.legs, nextTravelLeg(prev.legs[prev.legs.length - 1])],
    }));

  const removeLeg = (index: number) =>
    setForm((prev) => ({ ...prev, legs: prev.legs.filter((_, i) => i !== index) }));

  const updateFundingRow = (index: number, field: keyof FundingRow, value: string | boolean) =>
    setForm((prev) => {
      const rows = [...prev.funding_rows];
      rows[index] = { ...rows[index], [field]: value };
      return { ...prev, funding_rows: rows };
    });

  const docLabel = (type: string) =>
    TRAVEL_DOCUMENT_TYPES.find((dt) => dt.value === type)?.label ?? type.replace(/_/g, " ");

  const canNext = () => {
    if (step === 0) {
      const baseOk = !!(
        form.purpose &&
        form.destination_country &&
        form.departure_date &&
        form.return_date &&
        form.pif_type
      );
      if (!baseOk) return false;
      if (form.return_date < form.departure_date) return false;
      if (form.pif_type === "linked") return !!form.programme_id;
      if (form.pif_type === "justification") return !!form.justification.trim();
      return false;
    }
    if (step === 1)
      return form.legs.every((l) => l.from_location && l.to_location && l.travel_date);
    if (step === 4) return missingRequiredDocs().length === 0;
    return true;
  };

  const nextBlockedReason = (): string | null => {
    if (canNext()) return null;
    if (step === 0) {
      if (!form.purpose) return t("travel.create.hint.purpose");
      if (!form.destination_country) return t("travel.create.hint.country");
      if (!form.departure_date || !form.return_date) return t("travel.create.hint.dates");
      if (form.return_date < form.departure_date) return t("travel.create.hint.returnDate");
      if (!form.pif_type) return t("travel.create.hint.pifType");
      if (form.pif_type === "linked" && !form.programme_id) return t("travel.create.hint.pif");
      if (form.pif_type === "justification" && !form.justification.trim()) {
        return t("travel.create.hint.justification");
      }
    }
    if (step === 1) return t("travel.create.hint.legs");
    if (step === 4) {
      return t("travel.create.hint.docs", { docs: missingRequiredDocs().map(docLabel).join(", ") });
    }
    return t("travel.create.hint.generic");
  };

  const addPendingDoc = (file: File | undefined) => {
    if (!file) return;
    setPendingDocs((prev) => [
      ...prev,
      { key: `${Date.now()}-${file.name}`, file, documentType: pendingDocType },
    ]);
    setStepHint(null);
  };

  const buildPayload = () => ({
    purpose: form.purpose,
    destination_country: form.destination_country,
    destination_city: form.destination_city || undefined,
    departure_date: form.departure_date,
    return_date: form.return_date,
    currency: form.currency,
    justification: form.justification || undefined,
    host_organization: form.host_organization || undefined,
    programme_id: form.programme_id ? parseInt(form.programme_id) : undefined,
    budget_line_id: form.budget_line_id ?? undefined,
    vehicle_type: form.vehicle_type || undefined,
    driver_required: form.driver_required || undefined,
    driver_name: form.driver_name || undefined,
    private_vehicle_reason: form.private_vehicle_reason || undefined,
    private_vehicle_route: form.private_vehicle_route || undefined,
    estimated_kilometres: form.estimated_kilometres ? Number(form.estimated_kilometres) : undefined,
    mileage_rate_per_km: form.mileage_rate_per_km ? Number(form.mileage_rate_per_km) : undefined,
    equivalent_airfare: form.equivalent_airfare ? Number(form.equivalent_airfare) : undefined,
    prepared_on_behalf_of: form.prepared_on_behalf_of ? Number(form.prepared_on_behalf_of) : undefined,
    funding_details: form.funding_rows
      .filter((r) => r.forum_amount || r.host_amount || r.payor_sadc_pf || r.payor_host || r.payor_donor || r.payor_self)
      .map((r) => ({
        item: r.item,
        forum_amount: r.forum_amount || 0,
        host_amount: r.host_amount || 0,
        payor_sadc_pf: r.payor_sadc_pf || Number(r.forum_amount) > 0,
        payor_host: r.payor_host || Number(r.host_amount) > 0,
        payor_donor: r.payor_donor,
        payor_self: r.payor_self,
        funding_agency: r.funding_agency || undefined,
        project: r.project || undefined,
        budget_line: r.budget_line || undefined,
      })),
    itineraries: form.legs
      .filter((l) => l.from_location && l.to_location && l.travel_date)
      .map((l) => ({
        from_location: l.from_location,
        to_location: l.to_location,
        travel_date: l.travel_date,
        transport_mode: l.transport_mode,
        dsa_rate: 0,
        days_count: l.days_count,
        flight_name: l.flight_name,
        flight_number: l.flight_number,
      })),
  });

  const handleSubmit = async (asDraft: boolean) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!asDraft && missingRequiredDocs().length > 0) {
        setSubmitError(
          t("travel.create.err.docsBeforeSubmit", { docs: missingRequiredDocs().map(docLabel).join(", ") }),
        );
        setStep(4);
        return;
      }

      const payload = buildPayload();
      const existingId = editId ?? createdIdRef.current;
      let createdId = existingId;

      if (existingId) {
        const { data } = await travelApi.update(existingId, payload);
        createdId = data.data?.id ?? existingId;
      } else {
        const { data } = await travelApi.create(payload, `${draft.operationKey}:create`);
        createdId = data.data?.id ?? (data as { id?: number }).id ?? null;
      }

      if (!createdId) {
        setSubmitError(t("travel.create.err.noId"));
        toast.error(t("travel.create.toast.notSaved"), t("travel.create.err.noId"));
        return;
      }
      // The server now holds the request; the local autosave is no longer needed.
      createdIdRef.current = createdId;
      draft.clear();

      try {
        for (const doc of pendingDocs) {
          await travelApi.uploadAttachment(createdId, doc.file, doc.documentType);
        }
        if (pendingDocs.length) {
          setExistingDocTypes((prev) => [...prev, ...pendingDocs.map((d) => d.documentType)]);
          setPendingDocs([]);
        }
      } catch (uploadErr: unknown) {
        const axiosErr = uploadErr as {
          response?: { data?: { message?: string; errors?: Record<string, string[] | string> } };
        };
        const errors = axiosErr?.response?.data?.errors;
        const fileMsg = errors?.file;
        const first =
          (Array.isArray(fileMsg) ? fileMsg[0] : typeof fileMsg === "string" ? fileMsg : undefined) ||
          (errors ? Object.values(errors).flat()[0] : undefined) ||
          axiosErr?.response?.data?.message ||
          t("travel.create.err.upload");
        setStep(4);
        const uploadMsg = t("travel.create.err.uploadSaved", { error: first, id: createdId });
        setSubmitError(uploadMsg);
        toast.error(t("travel.create.toast.docsNotUploaded"), uploadMsg);
        return;
      }

      if (!asDraft) {
        try {
          await travelApi.submit(createdId);
        } catch (err: unknown) {
          const axiosErr = err as { response?: { data?: { errors?: Record<string, string[] | string>; message?: string } } };
          const errors = axiosErr?.response?.data?.errors;
          const conflicts = errors?.conflicts;
          if (Array.isArray(conflicts) && conflicts.length) {
            const note = await prompt({
              title: "travel.conflicts.noteTitle",
              message: conflicts.join("\n"),
              label: "travel.conflicts.noteLabel",
              defaultValue: "travel.conflicts.noteDefault",
              required: true,
            });
            if (note) {
              await travelApi.submit(createdId, {
                acknowledge_conflicts: true,
                conflict_resolution_note: note,
              });
            } else {
              setSubmitError(t("travel.create.err.conflicts"));
              toast.warning(t("travel.create.toast.notSubmitted"), t("travel.create.err.conflicts"));
              router.push(`/travel/${createdId}`);
              return;
            }
          } else {
            const attachMsg = errors?.attachments;
            const msg = Array.isArray(attachMsg)
              ? attachMsg.join(" ")
              : typeof attachMsg === "string"
                ? attachMsg
                : axiosErr?.response?.data?.message || t("travel.create.err.submitAfterUpload");
            setSubmitError(msg);
            toast.error(t("travel.create.toast.notSubmitted"), msg);
            router.push(`/travel/${createdId}`);
            return;
          }
        }
      }
      toast.success(asDraft ? t("travel.create.toast.savedDraft") : t("travel.create.toast.submitted"));
      router.push(asDraft ? `/travel/${createdId}` : "/travel");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      if (axiosErr?.response?.data?.message?.includes("Idempotency-Key was already used")) {
        // A previous attempt reached the server (its response was lost) and the form changed since.
        setSubmitError(t("travel.create.err.idempotency"));
        toast.warning(t("travel.create.toast.maybeSaved"), t("travel.create.toast.maybeSavedBody"));
        return;
      }
      const first = axiosErr?.response?.data?.errors
        ? Object.values(axiosErr.response.data.errors).flat()[0]
        : undefined;
      const message = first || axiosErr?.response?.data?.message || t("travel.create.err.save");
      setSubmitError(message);
      toast.error(t("travel.create.toast.notSaved"), message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalForum = form.funding_rows.reduce((s, r) => s + (parseFloat(r.forum_amount) || 0), 0);
  const totalHost = form.funding_rows.reduce((s, r) => s + (parseFloat(r.host_amount) || 0), 0);
  const grandTotal = totalForum + totalHost;

  if (loadingDraft) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-50" />
        <p className="text-sm text-neutral-400">{t("travel.create.loadingRequest")}</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={editId ? t("travel.create.titleEdit") : t("travel.create.titleNew")}
        subtitle={editId ? t("travel.create.subtitleEdit") : t("travel.create.subtitleNew")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.travel", href: "/travel" },
              { label: editId ? "travel.create.crumbEdit" : "travel.create.crumbNew" },
            ]}
          />
        }
      />

      {draft.restorable && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800" role="status">
          <span className="material-symbols-outlined text-[16px]">history</span>
          <span className="flex-1">
            {t("travel.create.draftFound", { date: new Date(draft.restorable.savedAt).toLocaleString(localeTag) })}
          </span>
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs"
            onClick={() => {
              const restored = draft.restore();
              if (restored) setForm(restored);
            }}
          >
            {t("travel.create.restore")}
          </button>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={draft.discard}>
            {t("travel.create.discard")}
          </button>
        </div>
      )}

      <div className="card p-4">
        <Stepper
          steps={STEPS.map((label) => ({ label: t(label) }))}
          currentStep={step + 1}
        />
      </div>

      {/* ── Step 0: Trip Details ────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 shadow-card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[14px]">flight_takeoff</span>
            </span>
            {t("travel.create.travellerDetails")}
          </h3>

          {canPrepareForOthers && (
            <div className="space-y-1.5 rounded-lg border border-blue-100 bg-blue-50/60 p-3" data-testid="travel-on-behalf-picker">
              <NexusPicker<{ id: number; name: string; email?: string }>
                id="travel-create-traveller"
                label={t("travel.create.onBehalfLabel")}
                value={
                  form.prepared_on_behalf_of
                    ? travellers.find((tr) => String(tr.id) === form.prepared_on_behalf_of) ?? null
                    : null
                }
                onSelect={(tr) => updateField("prepared_on_behalf_of", tr ? String(tr.id) : "")}
                fetchOptions={async (search) => {
                  const eligible = travellers.filter((tr) => tr.id !== user?.id);
                  if (!search) return eligible;
                  const q = search.toLowerCase();
                  return eligible.filter((tr) => tr.name.toLowerCase().includes(q) || tr.email?.toLowerCase().includes(q));
                }}
                getId={(tr) => tr.id}
                getLabel={(tr) => tr.name}
                getSecondaryLabel={(tr) => tr.email}
                placeholder={t("travel.create.onBehalfPlaceholder")}
                clearLabel={t("travel.create.onBehalfClear")}
              />
              <p className="text-[11px] text-neutral-500">
                {t("travel.create.onBehalfHint")}
              </p>
            </div>
          )}

          {/* Purpose */}
          <div className="space-y-1.5">
            <label htmlFor="travel-create-purpose-of-travel" className="block text-xs font-medium text-neutral-700">
              {t("travel.create.purpose")} <span className="text-red-500">*</span>
            </label>
            <input id="travel-create-purpose-of-travel"
              className="form-input"
              placeholder={t("travel.create.purposePlaceholder")}
              value={form.purpose}
              onChange={(e) => updateField("purpose", e.target.value)}
            />
          </div>

          {/* Destination */}
          <TravelDestinationFields
            country={form.destination_country}
            city={form.destination_city}
            countries={destinations}
            adding={addingDestination}
            onCountryChange={(v) => updateField("destination_country", v)}
            onCityChange={(v) => updateField("destination_city", v)}
            onAddCountry={handleAddCountry}
            onAddCity={handleAddCity}
          />

          {/* Host Organization */}
          <div className="space-y-1.5">
            <label htmlFor="travel-create-host-organization" className="block text-xs font-medium text-neutral-700">{t("travel.create.hostOrg")}</label>
            <input id="travel-create-host-organization"
              className="form-input"
              placeholder={t("travel.create.hostOrgPlaceholder")}
              value={form.host_organization}
              onChange={(e) => updateField("host_organization", e.target.value)}
            />
          </div>

          {/* Dates + Currency */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="travel-create-departure-date" className="block text-xs font-medium text-neutral-700">
                {t("travel.create.departureDate")} <span className="text-red-500">*</span>
              </label>
              <input id="travel-create-departure-date"
                type="date"
                className="form-input"
                min={todayIso}
                value={form.departure_date}
                onChange={(e) => updateField("departure_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="travel-create-return-date" className="block text-xs font-medium text-neutral-700">
                {t("travel.create.returnDate")} <span className="text-red-500">*</span>
              </label>
              <input id="travel-create-return-date"
                type="date"
                className="form-input"
                min={form.departure_date || todayIso}
                value={form.return_date}
                onChange={(e) => updateField("return_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="travel-create-currency" className="block text-xs font-medium text-neutral-700">{t("travel.create.currency")}</label>
              <select id="travel-create-currency"
                className="form-input"
                value={form.currency}
                onChange={(e) => updateField("currency", e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* PIF / Mission link */}
          <div className="space-y-3 pt-3 border-t border-neutral-100">
            <p className="block text-xs font-semibold text-neutral-700">
              {t("travel.create.pifConnection")} <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => updateField("pif_type", "linked")}
                className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  form.pif_type === "linked"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">link</span>
                {t("travel.create.linkPif")}
              </button>
              <button
                type="button"
                onClick={() => updateField("pif_type", "justification")}
                className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  form.pif_type === "justification"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                {t("travel.create.provideJustification")}
              </button>
            </div>

            {form.pif_type === "linked" && (
              <div className="space-y-1.5">
                <select
                  className="form-input"
                  value={form.programme_id}
                  onChange={(e) => updateField("programme_id", e.target.value)}
                >
                  <option value="">{t("travel.create.selectPif")}</option>
                  {programmes.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.reference_number} — {p.title}
                    </option>
                  ))}
                </select>
                {programmes.length === 0 && (
                  <p className="text-xs text-neutral-400">
                    {t("travel.create.noProgrammes")}
                  </p>
                )}
              </div>
            )}

            {form.pif_type === "justification" && (
              <textarea
                rows={3}
                className="form-input resize-none"
                placeholder={t("travel.create.justificationPlaceholder")}
                value={form.justification}
                onChange={(e) => updateField("justification", e.target.value)}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Step 1: Itinerary ───────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-[14px]">route</span>
                </span>
                {t("travel.create.flightItinerary")}
              </h3>
              <button
                type="button"
                onClick={addLeg}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                {t("travel.create.addLeg")}
              </button>
            </div>

            <p className="mb-4 text-xs text-neutral-500">
              {t("travel.create.addLegHint")}
            </p>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2 mb-4">
              <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">calculate</span>
              <p className="text-xs text-amber-700">
                {t("travel.create.dsaNote")}
              </p>
            </div>

            <div className="space-y-4">
              {form.legs.map((leg, i) => (
                <div key={i} className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {t("travel.create.legN", { n: i + 1 })}
                    </span>
                    {form.legs.length > 1 && (
                      <button
                        onClick={() => removeLeg(i)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        aria-label={t("travel.create.removeLeg", { n: i + 1 })}
                        title={t("travel.create.removeLeg", { n: i + 1 })}
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor={`travel-create-from-${i}`} className="block text-[11px] font-medium text-neutral-600">
                        {t("travel.create.from")} <span className="text-red-500">*</span>
                      </label>
                      <LocationCombobox
                        id={`travel-create-from-${i}`}
                        value={leg.from_location}
                        onChange={(v) => updateLeg(i, "from_location", v)}
                        placeholder={t("travel.create.originPlaceholder")}
                        locations={catalogLocations}
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`travel-create-to-${i}`} className="block text-[11px] font-medium text-neutral-600">
                        {t("travel.create.to")} <span className="text-red-500">*</span>
                      </label>
                      <LocationCombobox
                        id={`travel-create-to-${i}`}
                        value={leg.to_location}
                        onChange={(v) => updateLeg(i, "to_location", v)}
                        placeholder={t("travel.create.destinationPlaceholder")}
                        locations={catalogLocations}
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`travel-create-travel-date-${i}`} className="block text-[11px] font-medium text-neutral-600">
                        {t("travel.create.travelDate")} <span className="text-red-500">*</span>
                      </label>
                      <input id={`travel-create-travel-date-${i}`}
                        type="date"
                        className="w-full rounded-md border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        value={leg.travel_date}
                        onChange={(e) => updateLeg(i, "travel_date", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`travel-create-transport-mode-${i}`} className="block text-[11px] font-medium text-neutral-600">{t("travel.create.transportMode")}</label>
                      <select id={`travel-create-transport-mode-${i}`}
                        className="w-full rounded-md border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        value={leg.transport_mode}
                        onChange={(e) => updateLeg(i, "transport_mode", e.target.value)}
                      >
                        <option value="flight">{t("travel.create.mode.flight")}</option>
                        <option value="road">{t("travel.create.mode.road")}</option>
                        <option value="rail">{t("travel.create.mode.rail")}</option>
                        <option value="sea">{t("travel.create.mode.sea")}</option>
                      </select>
                    </div>
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label htmlFor={`travel-create-nights-${i}`} className="block text-[11px] font-medium text-neutral-600">
                        {t("travel.create.nights")}
                      </label>
                      <input id={`travel-create-nights-${i}`}
                        type="number"
                        min="0"
                        className="w-full rounded-md border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        value={leg.days_count}
                        onChange={(e) => updateLeg(i, "days_count", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    {leg.transport_mode === "flight" && (
                      <>
                        <FormField label={t("travel.create.flightName")} htmlFor={`leg-${i}-flight-name`}>
                          <input
                            id={`leg-${i}-flight-name`}
                            className="w-full rounded-md border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            placeholder={t("travel.create.flightNamePlaceholder")}
                            maxLength={120}
                            value={leg.flight_name}
                            onChange={(e) => updateLeg(i, "flight_name", e.target.value)}
                          />
                        </FormField>
                        <FormField label={t("travel.create.flightNumber")} htmlFor={`leg-${i}-flight-number`}>
                          <input
                            id={`leg-${i}-flight-number`}
                            className="w-full rounded-md border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            placeholder={t("travel.create.flightNumberPlaceholder")}
                            maxLength={32}
                            value={leg.flight_number}
                            onChange={(e) => updateLeg(i, "flight_number", e.target.value)}
                          />
                        </FormField>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Funding Details ─────────────────────────────────────────── */}
      {step === 2 && (
        <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 shadow-card p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
              </span>
              {t("travel.create.step.funding")}
            </h3>
            <p className="text-xs text-neutral-500 mt-1 ml-8">
              {t("travel.create.fundingHint")}
            </p>
          </div>

          <BudgetLinePicker
            value={form.budget_line_id}
            amount={grandTotal > 0 ? grandTotal : null}
            label={t("travel.create.budgetLine")}
            onChange={(id, line) => {
              setForm((prev) => ({
                ...prev,
                budget_line_id: id,
                funding_rows: prev.funding_rows.map((row, idx) =>
                  idx === 0 && line
                    ? { ...row, budget_line: line.code || line.name || row.budget_line }
                    : row,
                ),
              }));
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {form.funding_rows.map((row, i) => {
              const rowTotal = (parseFloat(row.forum_amount) || 0) + (parseFloat(row.host_amount) || 0);
              const hasAmount = rowTotal > 0;
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-4 space-y-3 transition-colors ${
                    hasAmount
                      ? "border-primary/30 bg-primary/[0.03]"
                      : "border-neutral-200 bg-neutral-50/50"
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[15px] ${
                          hasAmount
                            ? "bg-primary/10 text-primary"
                            : "bg-neutral-100 text-neutral-400"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">{row.icon}</span>
                      </span>
                      <span className="text-xs font-semibold text-neutral-700">
                        {FUNDING_ITEM_LABELS[row.item] ? t(FUNDING_ITEM_LABELS[row.item]) : row.item}
                      </span>
                    </div>
                    {hasAmount && (
                      <span className="text-xs font-bold text-primary">
                        {form.currency} {rowTotal.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Amount inputs */}
                  <div className="grid grid-cols-2 gap-2">
                    <NexusMoneyInput
                      id={`travel-create-forum-${i}`}
                      label={t("travel.create.forum")}
                      currency={form.currency}
                      value={row.forum_amount === "" ? null : Number(row.forum_amount)}
                      onValueChange={(v) => updateFundingRow(i, "forum_amount", v === null ? "" : String(v))}
                    />
                    <NexusMoneyInput
                      id={`travel-create-host-${i}`}
                      label={t("travel.create.host")}
                      currency={form.currency}
                      value={row.host_amount === "" ? null : Number(row.host_amount)}
                      onValueChange={(v) => updateFundingRow(i, "host_amount", v === null ? "" : String(v))}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 text-[10px] text-neutral-600" data-testid="funding-payor-matrix">
                    {([
                      ["payor_sadc_pf", "travel.create.payor.sadcpf"],
                      ["payor_host", "travel.create.host"],
                      ["payor_donor", "travel.create.payor.donor"],
                      ["payor_self", "travel.create.payor.self"],
                    ] as const).map(([key, label]) => (
                      <label htmlFor={`travel-create-payor-${i}-${key}`} key={key} className="inline-flex items-center gap-1">
                        <input id={`travel-create-payor-${i}-${key}`}
                          type="checkbox"
                          checked={Boolean(row[key])}
                          onChange={(e) => updateFundingRow(i, key, e.target.checked)}
                        />
                        {t(label)}
                      </label>
                    ))}
                  </div>

                  {/* Toggle details */}
                  <button
                    type="button"
                    onClick={() => updateFundingRow(i, "expanded", !row.expanded)}
                    className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {row.expanded ? "expand_less" : "expand_more"}
                    </span>
                    {row.expanded ? t("travel.create.hideDetails") : t("travel.create.addFundingDetails")}
                  </button>

                  {/* Expanded details */}
                  {row.expanded && (
                    <div className="space-y-2 pt-1 border-t border-neutral-100">
                      <div>
                        <label htmlFor={`travel-create-funding-agency-${i}`} className="block text-[10px] font-medium text-neutral-500 mb-1">{t("travel.create.fundingAgency")}</label>
                        <input id={`travel-create-funding-agency-${i}`}
                          className="w-full rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          placeholder={t("travel.create.fundingAgencyPlaceholder")}
                          value={row.funding_agency}
                          onChange={(e) => updateFundingRow(i, "funding_agency", e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor={`travel-create-project-${i}`} className="block text-[10px] font-medium text-neutral-500 mb-1">{t("travel.create.project")}</label>
                          <input id={`travel-create-project-${i}`}
                            className="w-full rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder={t("travel.create.projectPlaceholder")}
                            value={row.project}
                            onChange={(e) => updateFundingRow(i, "project", e.target.value)}
                          />
                        </div>
                        <div>
                          <label htmlFor={`travel-create-budget-line-${i}`} className="block text-[10px] font-medium text-neutral-500 mb-1">{t("travel.create.budgetLineNote")}</label>
                          <input id={`travel-create-budget-line-${i}`}
                            className="w-full rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder={t("travel.create.budgetLineNotePlaceholder")}
                            value={row.budget_line}
                            onChange={(e) => updateFundingRow(i, "budget_line", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Grand total */}
          {grandTotal > 0 && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 px-5 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-neutral-600">{t("travel.create.totalCost")}</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {t("travel.create.forumTotal", { amount: `${form.currency} ${totalForum.toFixed(2)}` })} &nbsp;·&nbsp;
                  {t("travel.create.hostTotal", { amount: `${form.currency} ${totalHost.toFixed(2)}` })}
                </p>
              </div>
              <span className="text-xl font-bold text-primary">
                {form.currency} {grandTotal.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Vehicle & Driver ────────────────────────────────────────── */}
      {step === 3 && (
        <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 shadow-card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[14px]">directions_car</span>
            </span>
            {t("travel.create.vehicleDetails")}
          </h3>

          {/* Vehicle type */}
          <div className="space-y-2">
            <p className="block text-xs font-medium text-neutral-700">{t("travel.create.vehicleRequired")}</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "sadcpf" as const, label: t("travel.create.vehicle.sadcpf"), icon: "directions_car" },
                { value: "private" as const, label: t("travel.create.vehicle.private"), icon: "car_rental" },
                { value: "" as const, label: t("travel.create.vehicle.notRequiredOpt"), icon: "do_not_disturb" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField("vehicle_type", opt.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-colors ${
                    form.vehicle_type === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.vehicle_type !== "" && (
            <div className="space-y-4">
              {/* Driver required */}
              <div className="flex items-center gap-4">
                <p className="text-xs font-medium text-neutral-700 shrink-0">{t("travel.create.driverRequired")}</p>
                <div className="flex gap-2">
                  {[true, false].map((val) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => updateField("driver_required", val)}
                      className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        form.driver_required === val
                          ? "bg-primary text-white border-primary"
                          : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                      }`}
                    >
                      {val ? t("travel.create.yes") : t("travel.create.no")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Driver name (SADCPF vehicle + driver required) */}
              {form.driver_required && form.vehicle_type === "sadcpf" && (
                <div className="space-y-1.5">
                  <label htmlFor="travel-create-driver-name" className="block text-xs font-medium text-neutral-700">{t("travel.create.driverName")}</label>
                  <input id="travel-create-driver-name"
                    className="form-input"
                    placeholder={t("travel.create.driverNamePlaceholder")}
                    value={form.driver_name}
                    onChange={(e) => updateField("driver_name", e.target.value)}
                  />
                </div>
              )}

              {form.vehicle_type === "private" && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3" data-testid="private-mileage-fields">
                  <p className="text-xs text-amber-800">{t("travel.create.privateNote")}</p>
                  <label htmlFor="travel-create-private-reason" className="block text-xs font-medium text-neutral-700">{t("travel.create.privateReason")}
                    <textarea id="travel-create-private-reason" className="form-input mt-1" rows={2} value={form.private_vehicle_reason} onChange={(e) => updateField("private_vehicle_reason", e.target.value)} />
                  </label>
                  <label htmlFor="travel-create-private-route" className="block text-xs font-medium text-neutral-700">{t("travel.create.route")}
                    <input id="travel-create-private-route" className="form-input mt-1" value={form.private_vehicle_route} onChange={(e) => updateField("private_vehicle_route", e.target.value)} />
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label htmlFor="travel-create-private-km" className="text-xs font-medium text-neutral-700">{t("travel.create.km")}
                      <input id="travel-create-private-km" type="number" className="form-input mt-1" value={form.estimated_kilometres} onChange={(e) => updateField("estimated_kilometres", e.target.value)} />
                    </label>
                    <label htmlFor="travel-create-private-rate" className="text-xs font-medium text-neutral-700">{t("travel.create.ratePerKm")}
                      <input id="travel-create-private-rate" type="number" className="form-input mt-1" value={form.mileage_rate_per_km} onChange={(e) => updateField("mileage_rate_per_km", e.target.value)} />
                    </label>
                    <label htmlFor="travel-create-private-airfare" className="text-xs font-medium text-neutral-700">{t("travel.create.equivAirfare")}
                      <input id="travel-create-private-airfare" type="number" className="form-input mt-1" value={form.equivalent_airfare} onChange={(e) => updateField("equivalent_airfare", e.target.value)} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">
              <strong className="text-neutral-700">{t("travel.create.noteLabel")}</strong>{" "}
              {t("travel.create.vehicleNote")}
            </p>
          </div>
        </div>
      )}

      {/* ── Step 4: Documents ───────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          {submitError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              <span className="material-symbols-outlined text-[16px] mt-0.5">error_outline</span>
              <span>{submitError}</span>
            </div>
          )}
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 shadow-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[14px]">attach_file</span>
              </span>
              {t("travel.create.supportingDocs")}
            </h3>
            <p className="text-xs text-neutral-500">
              {t("travel.create.docsHint")}
            </p>

            <div className="flex flex-wrap gap-2">
              {requiredDocTypes().map((type) => {
                const ok =
                  existingDocTypes.includes(type) || pendingDocs.some((d) => d.documentType === type);
                return (
                  <span
                    key={type}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-800 border border-amber-200"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{ok ? "check_circle" : "error"}</span>
                    {ok
                      ? existingDocTypes.includes(type) && !pendingDocs.some((d) => d.documentType === type)
                        ? t("travel.create.docOnFile", { doc: docLabel(type) })
                        : docLabel(type)
                      : t("travel.create.docRequired", { doc: docLabel(type) })}
                  </span>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="form-input text-xs py-1.5 w-48"
                value={pendingDocType}
                onChange={(e) => setPendingDocType(e.target.value)}
              >
                {TRAVEL_DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
              <label htmlFor="travel-create-upload-file-add-file" className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer">
                <span className="material-symbols-outlined text-[15px]">upload_file</span>
                {t("travel.create.addFile")}
                <input id="travel-create-upload-file-add-file"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
                  onChange={(e) => {
                    addPendingDoc(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {pendingDocs.length === 0 ? (
              <p className="text-xs text-neutral-400 text-center py-6 border border-dashed border-neutral-200 rounded-xl">
                {t("travel.create.noDocs")}
              </p>
            ) : (
              <div className="space-y-2">
                {pendingDocs.map((doc) => (
                  <div key={doc.key} className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
                    <span className="material-symbols-outlined text-[20px] text-indigo-400">description</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-900 truncate">{doc.file.name}</p>
                      <p className="text-[10px] text-neutral-400">{docLabel(doc.documentType)} · {(doc.file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50"
                      onClick={() => setPendingDocs((prev) => prev.filter((d) => d.key !== doc.key))}
                      title={t("travel.create.remove")}
                      aria-label={t("travel.create.remove")}
                    >
                      <span className="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 5: Review & Submit ─────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 shadow-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[14px]">fact_check</span>
              </span>
              {t("travel.create.step.review")}
            </h3>

            {/* Summary rows */}
            <div className="divide-y divide-neutral-50">
              {[
                { label: t("travel.create.review.purpose"), value: form.purpose },
                {
                  label: t("travel.create.review.traveller"),
                  value: form.prepared_on_behalf_of
                    ? (travellers.find((tr) => String(tr.id) === form.prepared_on_behalf_of)?.name ?? t("travel.create.review.selectedPrincipal"))
                    : (user?.name ?? t("travel.create.review.myself")),
                },
                {
                  label: t("travel.create.review.preparedBy"),
                  value: form.prepared_on_behalf_of ? (user?.name ?? t("travel.create.review.you")) : t("travel.create.review.self"),
                },
                {
                  label: t("travel.create.review.destination"),
                  value: `${form.destination_city ? form.destination_city + ", " : ""}${form.destination_country}`,
                },
                { label: t("travel.create.hostOrg"), value: form.host_organization || "—" },
                { label: t("travel.create.review.dates"), value: `${form.departure_date} → ${form.return_date}` },
                { label: t("travel.create.currency"), value: form.currency },
                {
                  label: t("travel.create.review.pif"),
                  value:
                    form.pif_type === "linked"
                      ? programmes.find((p) => String(p.id) === form.programme_id)?.title ??
                        t("travel.create.review.linkedPif")
                      : t("travel.create.review.justificationProvided"),
                },
                {
                  label: t("travel.create.review.legs"),
                  value: form.legs
                    .map((l, i) => {
                      const flight = [l.flight_name, l.flight_number].filter(Boolean).join(" ");
                      const vars = { n: i + 1, from: l.from_location || "—", to: l.to_location || "—", flight };
                      return flight ? t("travel.create.review.legFlight", vars) : t("travel.create.review.leg", vars);
                    })
                    .join("; "),
                },
                {
                  label: t("travel.create.step.documents"),
                  value: (() => {
                    const labels = [
                      ...existingDocTypes.map(docLabel),
                      ...pendingDocs.map((d) => docLabel(d.documentType)),
                    ];
                    return labels.length ? Array.from(new Set(labels)).join(", ") : t("travel.create.review.none");
                  })(),
                },
                {
                  label: t("travel.create.review.total"),
                  value:
                    grandTotal > 0 ? `${form.currency} ${grandTotal.toFixed(2)}` : t("travel.create.review.notSpecified"),
                },
                {
                  label: t("travel.create.review.vehicle"),
                  value:
                    form.vehicle_type === "sadcpf"
                      ? t("travel.create.vehicle.sadcpf")
                      : form.vehicle_type === "private"
                      ? t("travel.create.vehicle.private")
                      : t("travel.create.vehicle.notRequired"),
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2.5">
                  <span className="text-xs text-neutral-500">{label}</span>
                  <span className="text-xs font-medium text-neutral-900 text-right max-w-[60%]">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">info</span>
            <p className="text-xs text-amber-700">
              {t("travel.create.submitNote")}
            </p>
          </div>
        </div>
      )}

      {submitError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="material-symbols-outlined text-[16px] mt-0.5">error_outline</span>
          <span>{submitError}</span>
        </div>
      )}

      {stepHint && !submitError && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          <span className="material-symbols-outlined text-[16px] mt-0.5">info</span>
          <span>{stepHint}</span>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {step > 0 && (
            <button
              onClick={() => {
                setStepHint(null);
                setStep((s) => s - 1);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              {t("common.back")}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting || loadingDraft}
            className="rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            {t("travel.create.saveDraft")}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => {
                const reason = nextBlockedReason();
                if (reason) {
                  setStepHint(reason);
                  return;
                }
                setStepHint(null);
                setStep((s) => s + 1);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("common.next")}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting || missingRequiredDocs().length > 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting
                ? t("travel.create.submitting")
                : editId
                  ? t("travel.create.updateSubmit")
                  : t("travel.create.submitRequest")}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TravelCreatePage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">{t("travel.create.loadingForm")}</div>}>
      <TravelCreatePageInner />
    </Suspense>
  );
}
