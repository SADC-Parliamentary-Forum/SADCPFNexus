"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { travelApi, programmeApi, TRAVEL_DOCUMENT_TYPES } from "@/lib/api";
import type { Programme, TravelRequest } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import BudgetLinePicker from "@/components/budget/BudgetLinePicker";
import { getListData } from "@/lib/listPagination";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Stepper } from "@/components/ui/Stepper";

// ─── Country lists ────────────────────────────────────────────────────────────
const SADC_COUNTRIES = [
  "Angola", "Botswana", "Comoros", "Democratic Republic of Congo",
  "Eswatini", "Lesotho", "Madagascar", "Malawi", "Mauritius",
  "Mozambique", "Namibia", "Seychelles", "South Africa", "Tanzania",
  "Zambia", "Zimbabwe",
];
const OTHER_COUNTRIES = [
  "Belgium", "China", "Ethiopia", "France", "Germany", "India", "Italy",
  "Japan", "Kenya", "Nigeria", "Rwanda", "Spain", "Switzerland", "Uganda",
  "United Kingdom", "United States",
].sort();

// ─── Common SADC city locations for leg combobox ───────────────────────────
const COMMON_LOCATIONS = [
  "Windhoek, Namibia", "Gaborone, Botswana", "Harare, Zimbabwe",
  "Lusaka, Zambia", "Maputo, Mozambique", "Lilongwe, Malawi",
  "Dar es Salaam, Tanzania", "Johannesburg, South Africa",
  "Cape Town, South Africa", "Pretoria, South Africa",
  "Luanda, Angola", "Mbabane, Eswatini", "Maseru, Lesotho",
  "Antananarivo, Madagascar", "Port Louis, Mauritius",
  "Victoria, Seychelles", "Moroni, Comoros", "Kinshasa, DR Congo",
  "Nairobi, Kenya", "Addis Ababa, Ethiopia", "Kigali, Rwanda",
  "Abuja, Nigeria", "Brussels, Belgium", "Geneva, Switzerland",
  "New York, United States", "London, United Kingdom",
];

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

const STEPS = ["Trip Details", "Itinerary", "Funding Details", "Vehicle & Driver", "Documents", "Review & Submit"];

interface PendingDoc {
  key: string;
  file: File;
  documentType: string;
}

const REQUIRED_ON_SUBMIT = ["invitation", "agenda"] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Leg {
  from_location: string;
  to_location: string;
  travel_date: string;
  transport_mode: string;
  days_count: number;
}

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

// ─── Country searchable dropdown ─────────────────────────────────────────────
function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const sadcFiltered = SADC_COUNTRIES.filter((c) =>
    c.toLowerCase().includes(query.toLowerCase())
  );
  const otherFiltered = OTHER_COUNTRIES.filter((c) =>
    c.toLowerCase().includes(query.toLowerCase())
  );
  const showSections = query === "";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-left focus:border-primary focus:ring-1 focus:ring-primary outline-none"
      >
        <span className={value ? "text-neutral-900" : "text-neutral-400"}>
          {value || "Select country..."}
        </span>
        <span className="material-symbols-outlined text-[16px] text-neutral-400">expand_more</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 shadow-lg">
          <div className="p-2 border-b border-neutral-100">
            <input
              autoFocus
              className="w-full rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              placeholder="Search countries..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {showSections && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                SADC Member States
              </div>
            )}
            {sadcFiltered.map((c) => (
              <button
                key={c}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/5 flex items-center justify-between ${
                  value === c ? "text-primary font-medium" : "text-neutral-700"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(c);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {c}
                {value === c && <span className="material-symbols-outlined text-[14px]">check</span>}
              </button>
            ))}
            {showSections && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-t border-neutral-50 mt-1">
                Other Countries
              </div>
            )}
            {otherFiltered.map((c) => (
              <button
                key={c}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/5 flex items-center justify-between ${
                  value === c ? "text-primary font-medium" : "text-neutral-700"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(c);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {c}
                {value === c && <span className="material-symbols-outlined text-[14px]">check</span>}
              </button>
            ))}
            {sadcFiltered.length === 0 && otherFiltered.length === 0 && (
              <div className="px-3 py-4 text-xs text-neutral-400 text-center">No results for "{query}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Location combobox for legs (type or pick from list) ─────────────────────
function LocationCombobox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = COMMON_LOCATIONS.filter((l) =>
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
        className="w-full rounded-md border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        placeholder={placeholder ?? "Type or select..."}
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
    legs: legs.length
      ? legs
      : [{ from_location: "", to_location: "", travel_date: "", transport_mode: "flight", days_count: 1 }],
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
    legs: [{ from_location: "", to_location: "", travel_date: "", transport_mode: "flight", days_count: 1 }],
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

  const requiredDocTypes = (): string[] => {
    const required: string[] = [...REQUIRED_ON_SUBMIT];
    if (form.programme_id) required.push("approved_pif");
    return required;
  };

  const missingRequiredDocs = (): string[] => {
    const attached = new Set([...existingDocTypes, ...pendingDocs.map((d) => d.documentType)]);
    return requiredDocTypes().filter((t) => !attached.has(t));
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
          setSubmitError("Could not load travel request for editing.");
          return;
        }
        if (data.status !== "draft" && data.status !== "returned_for_correction") {
          setSubmitError("Only draft or returned requests can be edited in the wizard.");
          return;
        }
        setForm(hydrateFormFromRequest(data));
        const docs = getListData<{ document_type?: string | null }>(attRes.data);
        setExistingDocTypes(docs.map((d) => d.document_type).filter((t): t is string => Boolean(t)));
      })
      .catch(() => {
        if (active) setSubmitError("Failed to load travel request for editing.");
      })
      .finally(() => {
        if (active) setLoadingDraft(false);
      });
    return () => {
      active = false;
    };
  }, [editId]);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateLeg = (index: number, field: keyof Leg, value: string | number) =>
    setForm((prev) => {
      const legs = [...prev.legs];
      legs[index] = { ...legs[index], [field]: value };
      return { ...prev, legs };
    });

  const addLeg = () =>
    setForm((prev) => ({
      ...prev,
      legs: [
        ...prev.legs,
        { from_location: "", to_location: "", travel_date: "", transport_mode: "flight", days_count: 1 },
      ],
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
    TRAVEL_DOCUMENT_TYPES.find((t) => t.value === type)?.label ?? type.replace(/_/g, " ");

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
      if (!form.purpose) return "Enter the purpose of travel.";
      if (!form.destination_country) return "Select a destination country.";
      if (!form.departure_date || !form.return_date) return "Enter departure and return dates.";
      if (form.return_date < form.departure_date) return "Return date must be on or after departure.";
      if (!form.pif_type) return "Choose a linked PIF or provide a justification.";
      if (form.pif_type === "linked" && !form.programme_id) return "Select an approved PIF.";
      if (form.pif_type === "justification" && !form.justification.trim()) {
        return "Provide a justification when no PIF is linked.";
      }
    }
    if (step === 1) return "Complete from, to, and date for each itinerary leg.";
    if (step === 4) {
      return `Attach required documents: ${missingRequiredDocs().map(docLabel).join(", ")}.`;
    }
    return "Complete the required fields before continuing.";
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
      })),
  });

  const handleSubmit = async (asDraft: boolean) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!asDraft && missingRequiredDocs().length > 0) {
        setSubmitError(
          `Attach required documents before submit: ${missingRequiredDocs().map(docLabel).join(", ")}.`,
        );
        setStep(4);
        return;
      }

      const payload = buildPayload();
      let createdId = editId;

      if (editId) {
        const { data } = await travelApi.update(editId, payload);
        createdId = data.data?.id ?? editId;
      } else {
        const { data } = await travelApi.create(payload);
        createdId = data.data?.id ?? (data as { id?: number }).id ?? null;
      }

      if (!createdId) {
        setSubmitError("Travel request was saved but no id was returned.");
        return;
      }

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
          "Document upload failed.";
        setStep(4);
        setSubmitError(
          `${first} Request #${createdId} was saved as a draft — re-attach files on Documents, then submit.`,
        );
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
            const note = window.prompt(
              `Conflicts detected:\n${conflicts.join("\n")}\n\nEnter resolution note to acknowledge, or Cancel to leave as draft.`,
              "Reviewed with supervisor",
            );
            if (note) {
              await travelApi.submit(createdId, {
                acknowledge_conflicts: true,
                conflict_resolution_note: note,
              });
            } else {
              setSubmitError("Saved as draft due to unresolved conflicts. Open the request to attach docs or resubmit.");
              router.push(`/travel/${createdId}`);
              return;
            }
          } else {
            const attachMsg = errors?.attachments;
            const msg = Array.isArray(attachMsg)
              ? attachMsg.join(" ")
              : typeof attachMsg === "string"
                ? attachMsg
                : axiosErr?.response?.data?.message || "Submit failed after upload. Open the draft to finish.";
            setSubmitError(msg);
            router.push(`/travel/${createdId}`);
            return;
          }
        }
      }
      router.push(asDraft ? `/travel/${createdId}` : "/travel");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const first = axiosErr?.response?.data?.errors
        ? Object.values(axiosErr.response.data.errors).flat()[0]
        : undefined;
      setSubmitError(first || axiosErr?.response?.data?.message || "Could not save travel request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const totalForum = form.funding_rows.reduce((s, r) => s + (parseFloat(r.forum_amount) || 0), 0);
  const totalHost = form.funding_rows.reduce((s, r) => s + (parseFloat(r.host_amount) || 0), 0);
  const grandTotal = totalForum + totalHost;

  if (loadingDraft) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-50" />
        <p className="text-sm text-neutral-400">Loading travel request…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ModulePageHeader
        title={editId ? "Edit Travel Request" : "New Travel Request"}
        subtitle={
          editId
            ? "Update destinations, dates, funding, documents, then save or submit."
            : "Submit a travel requisition for approval. DSA will be calculated by Finance Officers."
        }
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Travel", href: "/travel" },
              { label: editId ? "Edit Request" : "New Request" },
            ]}
          />
        }
      />

      <div className="card p-4">
        <Stepper
          steps={STEPS.map((label) => ({ label }))}
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
            Traveller&apos;s Details
          </h3>

          {canPrepareForOthers && (
            <div className="space-y-1.5 rounded-lg border border-blue-100 bg-blue-50/60 p-3" data-testid="travel-on-behalf-picker">
              <label className="block text-xs font-medium text-neutral-700">
                Traveller (prepare on behalf)
              </label>
              <select
                className="form-input"
                value={form.prepared_on_behalf_of}
                onChange={(e) => updateField("prepared_on_behalf_of", e.target.value)}
              >
                <option value="">Myself — I am the traveller</option>
                {travellers
                  .filter((t) => t.id !== user?.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.email ? ` (${t.email})` : ""}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-neutral-500">
                Prepared by you. Traveller attribution will show on the request.
              </p>
            </div>
          )}

          {/* Purpose */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-neutral-700">
              Purpose of Travel <span className="text-red-500">*</span>
            </label>
            <input
              className="form-input"
              placeholder="e.g. Annual Budget Review Meeting"
              value={form.purpose}
              onChange={(e) => updateField("purpose", e.target.value)}
            />
          </div>

          {/* Destination */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700">
                Destination Country <span className="text-red-500">*</span>
              </label>
              <CountrySelect
                value={form.destination_country}
                onChange={(v) => updateField("destination_country", v)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700">City</label>
              <input
                className="form-input"
                placeholder="e.g. Harare"
                value={form.destination_city}
                onChange={(e) => updateField("destination_city", e.target.value)}
              />
            </div>
          </div>

          {/* Host Organization */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-neutral-700">Host Organization</label>
            <input
              className="form-input"
              placeholder="e.g. African Union Commission"
              value={form.host_organization}
              onChange={(e) => updateField("host_organization", e.target.value)}
            />
          </div>

          {/* Dates + Currency */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700">
                Departure Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="form-input"
                min={todayIso}
                value={form.departure_date}
                onChange={(e) => updateField("departure_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700">
                Return Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="form-input"
                min={form.departure_date || todayIso}
                value={form.return_date}
                onChange={(e) => updateField("return_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700">Currency</label>
              <select
                className="form-input"
                value={form.currency}
                onChange={(e) => updateField("currency", e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="ZAR">ZAR</option>
                <option value="NAD">NAD</option>
                <option value="BWP">BWP</option>
                <option value="ZMW">ZMW</option>
                <option value="MWK">MWK</option>
                <option value="TZS">TZS</option>
                <option value="MZN">MZN</option>
              </select>
            </div>
          </div>

          {/* PIF / Mission link */}
          <div className="space-y-3 pt-3 border-t border-neutral-100">
            <label className="block text-xs font-semibold text-neutral-700">
              Mission / PIF Connection <span className="text-red-500">*</span>
            </label>
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
                Link to Approved PIF
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
                Provide Justification
              </button>
            </div>

            {form.pif_type === "linked" && (
              <div className="space-y-1.5">
                <select
                  className="form-input"
                  value={form.programme_id}
                  onChange={(e) => updateField("programme_id", e.target.value)}
                >
                  <option value="">— Select approved PIF / Programme —</option>
                  {programmes.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.reference_number} — {p.title}
                    </option>
                  ))}
                </select>
                {programmes.length === 0 && (
                  <p className="text-xs text-neutral-400">
                    No approved programmes found. Use &ldquo;Provide Justification&rdquo; instead.
                  </p>
                )}
              </div>
            )}

            {form.pif_type === "justification" && (
              <textarea
                rows={3}
                className="form-input resize-none"
                placeholder="Provide written justification for this travel (e.g. urgent mission, no linked PIF)..."
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
                Flight Itinerary
              </h3>
              <button
                onClick={addLeg}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                Add Leg
              </button>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2 mb-4">
              <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">calculate</span>
              <p className="text-xs text-amber-700">
                DSA rates are calculated by Finance Officers after submission. Enter travel legs and number of nights only.
              </p>
            </div>

            <div className="space-y-4">
              {form.legs.map((leg, i) => (
                <div key={i} className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      Leg {i + 1}
                    </span>
                    {form.legs.length > 1 && (
                      <button
                        onClick={() => removeLeg(i)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-600">
                        From <span className="text-red-500">*</span>
                      </label>
                      <LocationCombobox
                        value={leg.from_location}
                        onChange={(v) => updateLeg(i, "from_location", v)}
                        placeholder="Origin city, country"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-600">
                        To <span className="text-red-500">*</span>
                      </label>
                      <LocationCombobox
                        value={leg.to_location}
                        onChange={(v) => updateLeg(i, "to_location", v)}
                        placeholder="Destination city, country"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-600">
                        Travel Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        className="w-full rounded-md border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        value={leg.travel_date}
                        onChange={(e) => updateLeg(i, "travel_date", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-600">Transport Mode</label>
                      <select
                        className="w-full rounded-md border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        value={leg.transport_mode}
                        onChange={(e) => updateLeg(i, "transport_mode", e.target.value)}
                      >
                        <option value="flight">Flight</option>
                        <option value="road">Road</option>
                        <option value="rail">Rail</option>
                        <option value="sea">Sea</option>
                      </select>
                    </div>
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-medium text-neutral-600">
                        Nights at Destination
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full rounded-md border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        value={leg.days_count}
                        onChange={(e) => updateLeg(i, "days_count", parseInt(e.target.value) || 0)}
                      />
                    </div>
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
              Funding Details
            </h3>
            <p className="text-xs text-neutral-500 mt-1 ml-8">
              Enter the estimated cost for each applicable category. Use &ldquo;Add details&rdquo; to specify
              funding agency, project, and budget line.
            </p>
          </div>

          <BudgetLinePicker
            value={form.budget_line_id}
            amount={grandTotal > 0 ? grandTotal : null}
            label="Institutional budget line"
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
                      <span className="text-xs font-semibold text-neutral-700">{row.item}</span>
                    </div>
                    {hasAmount && (
                      <span className="text-xs font-bold text-primary">
                        {form.currency} {rowTotal.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Amount inputs */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 mb-1">
                        Forum ({form.currency})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm text-right outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        placeholder="0.00"
                        value={row.forum_amount}
                        onChange={(e) => updateFundingRow(i, "forum_amount", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 mb-1">
                        Host ({form.currency})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-sm text-right outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        placeholder="0.00"
                        value={row.host_amount}
                        onChange={(e) => updateFundingRow(i, "host_amount", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[10px] text-neutral-600" data-testid="funding-payor-matrix">
                    {([
                      ["payor_sadc_pf", "SADC PF"],
                      ["payor_host", "Host"],
                      ["payor_donor", "Donor"],
                      ["payor_self", "Self"],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={Boolean(row[key])}
                          onChange={(e) => updateFundingRow(i, key, e.target.checked)}
                        />
                        {label}
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
                    {row.expanded ? "Hide details" : "Add funding details"}
                  </button>

                  {/* Expanded details */}
                  {row.expanded && (
                    <div className="space-y-2 pt-1 border-t border-neutral-100">
                      <div>
                        <label className="block text-[10px] font-medium text-neutral-500 mb-1">Funding Agency</label>
                        <input
                          className="w-full rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          placeholder="e.g. SADCPF Core Budget"
                          value={row.funding_agency}
                          onChange={(e) => updateFundingRow(i, "funding_agency", e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-neutral-500 mb-1">Project</label>
                          <input
                            className="w-full rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder="Project name"
                            value={row.project}
                            onChange={(e) => updateFundingRow(i, "project", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-neutral-500 mb-1">Budget Line (text note)</label>
                          <input
                            className="w-full rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-2.5 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder="Optional note if no institutional line"
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
                <p className="text-xs font-medium text-neutral-600">Total Estimated Cost</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Forum: {form.currency} {totalForum.toFixed(2)} &nbsp;·&nbsp;
                  Host: {form.currency} {totalHost.toFixed(2)}
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
            Vehicle &amp; Driver Details
          </h3>

          {/* Vehicle type */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-700">Vehicle Required</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "sadcpf" as const, label: "SADCPF Vehicle", icon: "directions_car" },
                { value: "private" as const, label: "Private Vehicle", icon: "car_rental" },
                { value: "" as const, label: "Not Required", icon: "do_not_disturb" },
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
                <label className="text-xs font-medium text-neutral-700 shrink-0">Driver Required?</label>
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
                      {val ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Driver name (SADCPF vehicle + driver required) */}
              {form.driver_required && form.vehicle_type === "sadcpf" && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-neutral-700">Driver Name</label>
                  <input
                    className="form-input"
                    placeholder="Enter driver's name (if known)"
                    value={form.driver_name}
                    onChange={(e) => updateField("driver_name", e.target.value)}
                  />
                </div>
              )}

              {form.vehicle_type === "private" && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3" data-testid="private-mileage-fields">
                  <p className="text-xs text-amber-800">Private vehicle — mileage vs equivalent airfare comparison.</p>
                  <label className="block text-xs font-medium text-neutral-700">Reason PF vehicle not used
                    <textarea className="form-input mt-1" rows={2} value={form.private_vehicle_reason} onChange={(e) => updateField("private_vehicle_reason", e.target.value)} />
                  </label>
                  <label className="block text-xs font-medium text-neutral-700">Route
                    <input className="form-input mt-1" value={form.private_vehicle_route} onChange={(e) => updateField("private_vehicle_route", e.target.value)} />
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs font-medium text-neutral-700">Km
                      <input type="number" className="form-input mt-1" value={form.estimated_kilometres} onChange={(e) => updateField("estimated_kilometres", e.target.value)} />
                    </label>
                    <label className="text-xs font-medium text-neutral-700">Rate/km
                      <input type="number" className="form-input mt-1" value={form.mileage_rate_per_km} onChange={(e) => updateField("mileage_rate_per_km", e.target.value)} />
                    </label>
                    <label className="text-xs font-medium text-neutral-700">Equiv. airfare
                      <input type="number" className="form-input mt-1" value={form.equivalent_airfare} onChange={(e) => updateField("equivalent_airfare", e.target.value)} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">
              <strong className="text-neutral-700">Note:</strong> Vehicle and driver arrangements are
              subject to availability and administrative approval. Transport costs should be included
              in the Funding Details section.
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
              Supporting Documents
            </h3>
            <p className="text-xs text-neutral-500">
              Invitation letter and agenda are required before submit. Files upload when you save or submit.
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
                    {docLabel(type)}
                    {ok ? (existingDocTypes.includes(type) && !pendingDocs.some((d) => d.documentType === type) ? " on file" : "") : " required"}
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
                {TRAVEL_DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <label className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer">
                <span className="material-symbols-outlined text-[15px]">upload_file</span>
                Add file
                <input
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
                No documents selected yet.
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
                      title="Remove"
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
              Review &amp; Submit

            </h3>

            {/* Summary rows */}
            <div className="divide-y divide-neutral-50">
              {[
                { label: "Purpose", value: form.purpose },
                {
                  label: "Traveller",
                  value: form.prepared_on_behalf_of
                    ? (travellers.find((t) => String(t.id) === form.prepared_on_behalf_of)?.name ?? "Selected principal")
                    : (user?.name ?? "Myself"),
                },
                {
                  label: "Prepared by",
                  value: form.prepared_on_behalf_of ? (user?.name ?? "You") : "— (self)",
                },
                {
                  label: "Destination",
                  value: `${form.destination_city ? form.destination_city + ", " : ""}${form.destination_country}`,
                },
                { label: "Host Organization", value: form.host_organization || "—" },
                { label: "Travel Dates", value: `${form.departure_date} → ${form.return_date}` },
                { label: "Currency", value: form.currency },
                {
                  label: "PIF / Mission",
                  value:
                    form.pif_type === "linked"
                      ? programmes.find((p) => String(p.id) === form.programme_id)?.title ??
                        "Linked PIF"
                      : "Justification provided",
                },
                {
                  label: "Itinerary Legs",
                  value: `${form.legs.length} leg${form.legs.length !== 1 ? "s" : ""}`,
                },
                {
                  label: "Documents",
                  value: (() => {
                    const labels = [
                      ...existingDocTypes.map(docLabel),
                      ...pendingDocs.map((d) => docLabel(d.documentType)),
                    ];
                    return labels.length ? Array.from(new Set(labels)).join(", ") : "None";
                  })(),
                },
                {
                  label: "Estimated Total",
                  value:
                    grandTotal > 0 ? `${form.currency} ${grandTotal.toFixed(2)}` : "Not specified",
                },
                {
                  label: "Vehicle",
                  value:
                    form.vehicle_type === "sadcpf"
                      ? "SADCPF Vehicle"
                      : form.vehicle_type === "private"
                      ? "Private Vehicle"
                      : "Not required",
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
              By submitting, this request will be sent for supervisor approval. Finance Officers will
              complete the DSA calculation (Table 6) and the Finance Director will confirm funding
              availability. You will be notified at each stage.
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
              Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting || loadingDraft}
            className="rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Save Draft
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
              Next
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting || missingRequiredDocs().length > 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting…" : editId ? "Update & Submit" : "Submit Request"}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TravelCreatePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">Loading travel form…</div>}>
      <TravelCreatePageInner />
    </Suspense>
  );
}
