"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { travelApi, programmeApi } from "@/lib/api";
import type { Programme } from "@/lib/api";

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

const STEPS = ["Trip Details", "Itinerary", "Funding Details", "Vehicle & Driver", "Review & Submit"];

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
  legs: Leg[];
  funding_rows: FundingRow[];
  vehicle_type: "sadcpf" | "private" | "";
  driver_required: boolean;
  driver_name: string;
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
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg">
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
        className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
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
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg max-h-48 overflow-y-auto">
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TravelCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [programmes, setProgrammes] = useState<Programme[]>([]);

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
    legs: [{ from_location: "", to_location: "", travel_date: "", transport_mode: "flight", days_count: 1 }],
    funding_rows: FUNDING_ITEMS.map(({ item, icon }) => ({
      item,
      icon,
      forum_amount: "",
      host_amount: "",
      funding_agency: "",
      project: "",
      budget_line: "",
      expanded: false,
    })),
    vehicle_type: "",
    driver_required: false,
    driver_name: "",
  });

  // Load approved programmes for PIF dropdown
  useEffect(() => {
    programmeApi
      .list({ status: "approved", per_page: 100 })
      .then((res) => {
        setProgrammes(res.data.data ?? []);
      })
      .catch(() => {});
  }, []);

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
      if (form.pif_type === "linked") return !!form.programme_id;
      if (form.pif_type === "justification") return !!form.justification.trim();
      return false;
    }
    if (step === 1)
      return form.legs.every((l) => l.from_location && l.to_location && l.travel_date);
    return true;
  };

  const handleSubmit = async (asDraft: boolean) => {
    setSubmitting(true);
    try {
      const payload = {
        purpose: form.purpose,
        destination_country: form.destination_country,
        destination_city: form.destination_city || undefined,
        departure_date: form.departure_date,
        return_date: form.return_date,
        currency: form.currency,
        justification: form.justification || undefined,
        host_organization: form.host_organization || undefined,
        programme_id: form.programme_id ? parseInt(form.programme_id) : undefined,
        vehicle_type: form.vehicle_type || undefined,
        driver_required: form.driver_required || undefined,
        driver_name: form.driver_name || undefined,
        funding_details: form.funding_rows.filter((r) => r.forum_amount || r.host_amount),
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
      };
      const { data } = await travelApi.create(payload);
      const createdId = data.data?.id ?? (data as { id?: number }).id;
      if (!asDraft && createdId) {
        await travelApi.submit(createdId);
      }
      router.push("/travel");
    } catch {
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  };

  const totalForum = form.funding_rows.reduce((s, r) => s + (parseFloat(r.forum_amount) || 0), 0);
  const totalHost = form.funding_rows.reduce((s, r) => s + (parseFloat(r.host_amount) || 0), 0);
  const grandTotal = totalForum + totalHost;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1 text-sm text-neutral-500 mb-1">
          <a href="/travel" className="hover:text-primary transition-colors">Travel</a>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700 font-medium">New Request</span>
        </div>
        <h2 className="text-xl font-bold text-neutral-900">New Travel Request</h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Submit a travel requisition for approval. DSA will be calculated by Finance Officers.
        </p>
      </div>

      {/* Stepper */}
      <div className="rounded-xl bg-white border border-neutral-200 shadow-card p-4">
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    i < step
                      ? "bg-primary text-white"
                      : i === step
                      ? "bg-primary text-white"
                      : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {i < step ? (
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs font-medium truncate hidden lg:block ${
                    i === step ? "text-primary" : i < step ? "text-neutral-700" : "text-neutral-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${i < step ? "bg-primary" : "bg-neutral-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Step 0: Trip Details ────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="rounded-xl bg-white border border-neutral-200 shadow-card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[14px]">flight_takeoff</span>
            </span>
            Traveller&apos;s Details
          </h3>

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
          <div className="rounded-xl bg-white border border-neutral-200 shadow-card p-6">
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
                        className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        value={leg.travel_date}
                        onChange={(e) => updateLeg(i, "travel_date", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-600">Transport Mode</label>
                      <select
                        className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
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
                        className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
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
        <div className="rounded-xl bg-white border border-neutral-200 shadow-card p-6 space-y-5">
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
                        className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-right outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
                        className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-right outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        placeholder="0.00"
                        value={row.host_amount}
                        onChange={(e) => updateFundingRow(i, "host_amount", e.target.value)}
                      />
                    </div>
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
                          className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          placeholder="e.g. SADCPF Core Budget"
                          value={row.funding_agency}
                          onChange={(e) => updateFundingRow(i, "funding_agency", e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-neutral-500 mb-1">Project</label>
                          <input
                            className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder="Project name"
                            value={row.project}
                            onChange={(e) => updateFundingRow(i, "project", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-neutral-500 mb-1">Budget Line</label>
                          <input
                            className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder="e.g. 4200-01"
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
        <div className="rounded-xl bg-white border border-neutral-200 shadow-card p-6 space-y-5">
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

      {/* ── Step 4: Review & Submit ─────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-neutral-200 shadow-card p-6 space-y-4">
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

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Request"}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
