"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { programmeApi, adminApi, financeApi, tenantUsersApi } from "@/lib/api";
import {
  PIF_STRATEGIC_ALIGNMENTS,
  PIF_STRATEGIC_PILLARS,
  PIF_PROGRAMME_STATUSES,
  PIF_ACTIVITY_STATUSES,
  DEPARTMENTS,
  SUPPORT_DEPARTMENTS,
  PROGRAMME_BENEFICIARIES,
  FUNDING_SOURCES,
  BUDGET_CATEGORIES,
  PROCUREMENT_METHODS,
  CURRENCIES,
} from "@/lib/constants";

const STRATEGIC_ALIGNMENTS = [...PIF_STRATEGIC_ALIGNMENTS] as string[];
const STRATEGIC_PILLARS = [...PIF_STRATEGIC_PILLARS] as string[];
const SUPPORT_DEPTS = [...SUPPORT_DEPARTMENTS] as string[];
const BENEFICIARIES = [...PROGRAMME_BENEFICIARIES] as string[];
const ACTIVITY_STATUSES = [...PIF_ACTIVITY_STATUSES] as string[];
const PROGRAMME_STATUSES = [...PIF_PROGRAMME_STATUSES] as string[];

// ─── Wizard steps ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Basic Info", icon: "info" },
  { id: 2, label: "Details", icon: "description" },
  { id: 3, label: "Activities", icon: "checklist" },
  { id: 4, label: "Budget", icon: "payments" },
  { id: 5, label: "Travel", icon: "flight_takeoff" },
  { id: 6, label: "Procurement", icon: "shopping_cart" },
  { id: 7, label: "Media & Comms", icon: "campaign" },
  { id: 8, label: "Documents", icon: "attach_file" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface SpecificObjective { id: number; text: string; }
interface ExpectedOutput { id: number; output: string; kpi: string; target: string; measurementTool: string; }
interface Activity { id: number; name: string; startDate: string; endDate: string; responsible: string; location: string; status: typeof ACTIVITY_STATUSES[number]; }
interface Milestone { id: number; name: string; targetDate: string; completion: number; }
interface BudgetLine { id: number; category: string; description: string; amount: string; fundingSource: string; accountCode: string; }
interface ProcurementItem { id: number; description: string; estimatedCost: string; method: typeof PROCUREMENT_METHODS[number]; vendor: string; deliveryDate: string; }

function genRef(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `PIF-${year}-PROG-${seq}`;
}

// ─── Reusable sub-components ─────────────────────────────────────────────────
function SectionHeader({ icon, title, description, color = "bg-primary/10", iconColor = "text-primary" }: {
  icon: string; title: string; description?: string; color?: string; iconColor?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 ${color}`}>
        <span className={`material-symbols-outlined ${iconColor} text-[20px]`}>{icon}</span>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {description && <p className="text-xs text-neutral-400 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function CheckGroup({ options, selected, onChange, columns = 2 }: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void; columns?: number;
}) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  return (
    <div className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : columns === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer group">
          <button type="button" onClick={() => toggle(opt)}
            className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected.includes(opt) ? "bg-primary border-primary" : "border-neutral-300 hover:border-primary/50"}`}>
            {selected.includes(opt) && <span className="material-symbols-outlined text-white text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>}
          </button>
          <span className="text-sm text-neutral-700">{opt}</span>
        </label>
      ))}
    </div>
  );
}

// Multi-select dropdown for Responsible Officers (tenant users)
function OfficerMultiSelect({
  value,
  onChange,
  users,
}: { value: number[]; onChange: (v: number[]) => void; users: { id: number; name: string; email: string }[] }) {
  const [open, setOpen] = useState(false);
  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const selectedUsers = users.filter((u) => value.includes(u.id));
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="form-input text-xs text-left flex items-center gap-1 flex-wrap min-h-[38px] w-full"
      >
        {selectedUsers.length > 0 ? (
          selectedUsers.map((u) => (
            <span key={u.id} className="inline-flex items-center gap-0.5 rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-medium">
              {String(u.name ?? "")}
              <span
                className="material-symbols-outlined text-[10px] cursor-pointer hover:text-primary/80"
                onClick={(e) => { e.stopPropagation(); toggle(u.id); }}
              >close</span>
            </span>
          ))
        ) : (
          <span className="text-neutral-400">Select responsible officer(s)…</span>
        )}
        <span className="material-symbols-outlined text-[14px] ml-auto text-neutral-400">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>
      {open && (
        <>
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg py-1.5 max-h-56 overflow-y-auto">
            {users.length === 0 && (
              <p className="text-xs text-neutral-400 px-3 py-2">No users available.</p>
            )}
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-50 cursor-pointer">
                <button
                  type="button"
                  onClick={() => toggle(u.id)}
                  className={`h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0 ${value.includes(u.id) ? "bg-primary border-primary" : "border-neutral-300"}`}
                >
                  {value.includes(u.id) && (
                    <span className="material-symbols-outlined text-white text-[8px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-neutral-800 font-medium">{String(u.name ?? "")}</span>
                  {u.email && <span className="text-[10px] text-neutral-400 ml-1.5">{String(u.email)}</span>}
                </div>
              </label>
            ))}
          </div>
          <div className="fixed inset-0 z-[9]" aria-hidden onClick={() => setOpen(false)} />
        </>
      )}
    </div>
  );
}

// Multi-select for activity responsible: people + organisations, with "create if not present"
function ResponsibleMultiSelect({
  value,
  onChange,
  options,
  onAddCustom,
}: { value: string; onChange: (v: string) => void; options: string[]; onAddCustom: (name: string) => void }) {
  const selected = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
    onChange(next.join(", "));
  };
  const addNew = () => {
    const name = newName.trim();
    if (!name) return;
    onAddCustom(name);
    onChange(selected.length ? `${selected.join(", ")}, ${name}` : name);
    setNewName("");
    setOpen(false);
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="form-input text-xs text-left flex items-center gap-1 flex-wrap min-h-[36px] w-full">
        {selected.length > 0 ? (
          selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-0.5 rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-medium">
              {s}
              <span className="material-symbols-outlined text-[10px] cursor-pointer hover:text-primary/80" onClick={(e) => { e.stopPropagation(); toggle(s); }}>close</span>
            </span>
          ))
        ) : (
          <span className="text-neutral-400">Select or add responsible…</span>
        )}
        <span className="material-symbols-outlined text-[14px] ml-auto text-neutral-400">{open ? "expand_less" : "expand_more"}</span>
      </button>
      {open && (
        <>
          <div className="absolute z-10 mt-1 w-full max-w-[280px] rounded-lg border border-neutral-200 bg-white shadow-lg py-2 max-h-56 overflow-y-auto">
            {options.map((opt) => (
              <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-50 cursor-pointer">
                <button type="button" onClick={() => toggle(opt)} className={`h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0 ${selected.includes(opt) ? "bg-primary border-primary" : "border-neutral-300"}`}>
                  {selected.includes(opt) && <span className="material-symbols-outlined text-white text-[8px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>}
                </button>
                <span className="text-xs text-neutral-700">{opt}</span>
              </label>
            ))}
            <div className="border-t border-neutral-100 mt-2 pt-2 px-3 flex gap-2">
              <input type="text" className="form-input text-xs flex-1" placeholder="Add person or organisation…" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNew())} />
              <button type="button" onClick={addNew} className="btn-primary text-xs py-1.5 px-2">Add</button>
            </div>
          </div>
          <div className="fixed inset-0 z-[9]" aria-hidden onClick={() => setOpen(false)} />
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PifCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Section 1: Basic Info ──────────────────────────────────────────────────
  const [ref, setRef] = useState("");
  const [title, setTitle] = useState("");
  const [alignments, setAlignments] = useState<string[]>([]);
  const [alignmentOther, setAlignmentOther] = useState("");
  const [pillars, setPillars] = useState<string[]>([]);
  const [pillarOther, setPillarOther] = useState("");
  const [depts, setDepts] = useState<string[]>([]);
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [supportDepts, setSupportDepts] = useState<string[]>([]);
  const [meetingFormat, setMeetingFormat] = useState<"Physical" | "Virtual" | "Hybrid" | "">("");
  const [budgetsList, setBudgetsList] = useState<any[]>([]);
  const [responsibleOfficerIds, setResponsibleOfficerIds] = useState<number[]>([]);
  const [tenantUsers, setTenantUsers] = useState<{ id: number; name: string; email: string }[]>([]);

  useEffect(() => {
    setRef(genRef());

    tenantUsersApi.list()
      .then((res) => setTenantUsers(res.data.data ?? []))
      .catch(() => {});

    adminApi.listDepartments()
      .then((res) => {
        const names = ((res.data as any).data ?? []).map((d: any) => String(d.name)).filter(Boolean) as string[];
        setDepartmentsList([...new Set(names)]);
      })
      .catch(() => { });

    financeApi.listBudgets()
      .then(res => setBudgetsList((res.data as any).data ?? []))
      .catch(() => { });
  }, []);

  // ── Section 2: Details ────────────────────────────────────────────────────
  const [background, setBackground] = useState("");
  const [overallObjective, setOverallObjective] = useState("");
  const [specificObjectives, setSpecificObjectives] = useState<SpecificObjective[]>([{ id: 1, text: "" }]);
  const [expectedOutputs, setExpectedOutputs] = useState<ExpectedOutput[]>([{ id: 1, output: "", kpi: "", target: "", measurementTool: "" }]);
  const [outcomes, setOutcomes] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<string[]>([]);
  const [genderConsiderations, setGenderConsiderations] = useState("");

  // ── Section 3: Activities & Milestones ───────────────────────────────────
  const [activities, setActivities] = useState<Activity[]>([{ id: 1, name: "", startDate: "", endDate: "", responsible: "", location: "", status: "Draft" }]);
  const [customResponsibles, setCustomResponsibles] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([{ id: 1, name: "", targetDate: "", completion: 0 }]);

  // ── Section 4: Budget ─────────────────────────────────────────────────────
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>("NAD");
  const [fundingSources, setFundingSources] = useState<{ id: string; name: string; budget_amount: string; pays_for: string }[]>([
    { id: "fs-1", name: "Core Budget", budget_amount: "", pays_for: "" },
  ]);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([{ id: 1, category: "Travel", description: "", amount: "", fundingSource: "Core Budget", accountCode: "" }]);
  const [exchangeRate, setExchangeRate] = useState("");
  const [baseCurrency, setBaseCurrency] = useState<typeof CURRENCIES[number]>("USD");
  const [contingencyPct, setContingencyPct] = useState("10");

  // ── Section 5: Travel ─────────────────────────────────────────────────────
  const [hasTravelReqs, setHasTravelReqs] = useState(false);
  const [numDelegates, setNumDelegates] = useState("");
  const [memberStates, setMemberStates] = useState("");
  const [flightRequired, setFlightRequired] = useState(false);
  const [accommodationRequired, setAccommodationRequired] = useState(false);
  const [visaRequired, setVisaRequired] = useState(false);
  const [insuranceRequired, setInsuranceRequired] = useState(false);

  // ── Section 6: Procurement ────────────────────────────────────────────────
  const [hasProcurement, setHasProcurement] = useState(false);
  const [procurementItems, setProcurementItems] = useState<ProcurementItem[]>([{ id: 1, description: "", estimatedCost: "", method: "Direct Purchase", vendor: "", deliveryDate: "" }]);

  // ── Section 7: Media & Comms ──────────────────────────────────────────────
  const [pressRelease, setPressRelease] = useState(false);
  const [socialMedia, setSocialMedia] = useState(false);
  const [liveStreaming, setLiveStreaming] = useState(false);
  const [photography, setPhotography] = useState(false);
  const [brandingMaterials, setBrandingMaterials] = useState(false);

  // ── Section 8: Documents ──────────────────────────────────────────────────
  const [uploadedDocs, setUploadedDocs] = useState<{ name: string; type: string; mandatory: boolean }[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // ── Budget computations ───────────────────────────────────────────────────
  const budgetTotal = budgetLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const contingencyAmount = budgetLines.filter((l) => l.category === "Contingency").reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const contingencyActualPct = budgetTotal > 0 ? ((contingencyAmount / budgetTotal) * 100).toFixed(1) : "0";
  const contingencyExceeded = parseFloat(contingencyActualPct) > parseFloat(contingencyPct);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const addSpecificObj = () => setSpecificObjectives((p) => [...p, { id: Date.now(), text: "" }]);
  const removeSpecificObj = (id: number) => setSpecificObjectives((p) => p.filter((x) => x.id !== id));
  const updateSpecificObj = (id: number, text: string) => setSpecificObjectives((p) => p.map((x) => x.id === id ? { ...x, text } : x));

  const addOutput = () => setExpectedOutputs((p) => [...p, { id: Date.now(), output: "", kpi: "", target: "", measurementTool: "" }]);
  const removeOutput = (id: number) => setExpectedOutputs((p) => p.filter((x) => x.id !== id));
  const updateOutput = (id: number, field: keyof ExpectedOutput, val: string) => setExpectedOutputs((p) => p.map((x) => x.id === id ? { ...x, [field]: val } : x));

  const addActivity = () => setActivities((p) => [...p, { id: Date.now(), name: "", startDate: "", endDate: "", responsible: "", location: "", status: "Draft" }]);
  const removeActivity = (id: number) => setActivities((p) => p.filter((x) => x.id !== id));
  const updateActivity = (id: number, field: keyof Activity, val: string) => setActivities((p) => p.map((x) => x.id === id ? { ...x, [field]: val as never } : x));

  const addMilestone = () => setMilestones((p) => [...p, { id: Date.now(), name: "", targetDate: "", completion: 0 }]);
  const removeMilestone = (id: number) => setMilestones((p) => p.filter((x) => x.id !== id));
  const updateMilestone = (id: number, field: keyof Milestone, val: string | number) => setMilestones((p) => p.map((x) => x.id === id ? { ...x, [field]: val } : x));

  const addBudgetLine = () => setBudgetLines((p) => [...p, { id: Date.now(), category: "Travel", description: "", amount: "", fundingSource: fundingSources[0]?.name ?? "Core Budget", accountCode: "" }]);
  const removeBudgetLine = (id: number) => setBudgetLines((p) => p.filter((x) => x.id !== id));
  const updateBudget = (id: number, field: keyof BudgetLine, val: string) => setBudgetLines((p) => p.map((x) => x.id === id ? { ...x, [field]: val } : x));

  const addFundingSource = () => setFundingSources((p) => [...p, { id: `fs-${Date.now()}`, name: "", budget_amount: "", pays_for: "" }]);
  const removeFundingSource = (id: string) => setFundingSources((p) => p.filter((f) => f.id !== id));
  const updateFundingSource = (id: string, field: "name" | "budget_amount" | "pays_for", val: string) =>
    setFundingSources((p) => p.map((f) => (f.id === id ? { ...f, [field]: val } : f)));

  const addProcItem = () => setProcurementItems((p) => [...p, { id: Date.now(), description: "", estimatedCost: "", method: "Direct Purchase", vendor: "", deliveryDate: "" }]);
  const removeProcItem = (id: number) => setProcurementItems((p) => p.filter((x) => x.id !== id));
  const updateProcItem = (id: number, field: keyof ProcurementItem, val: string) => setProcurementItems((p) => p.map((x) => x.id === id ? { ...x, [field]: val as never } : x));

  const handleFileUpload = (mandatory: boolean, type: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploadedDocs((prev) => [
      ...prev,
      ...Array.from(files).map((f) => ({ name: f.name, type, mandatory })),
    ]);
    e.target.value = "";
  };

  const MANDATORY_DOCS = ["Concept Note", "Draft Agenda", "Budget Breakdown"];
  const mandatoryDocsComplete = MANDATORY_DOCS.every((docType) =>
    uploadedDocs.some((d) => d.type === docType && d.mandatory)
  );

  const canProceed = (): boolean => {
    if (step === 1) {
      const pillarsValid = pillars.length > 0 && (!pillars.includes("Other") || !!pillarOther.trim());
      return !!title.trim() && alignments.length > 0 && pillarsValid && depts.length > 0 && !!meetingFormat;
    }
    if (step === 2) return !!background.trim() && background.length >= 100 && !!overallObjective.trim() && !!genderConsiderations.trim();
    if (step === 8) return mandatoryDocsComplete;
    return true;
  };

  const handleSubmit = async (asDraft = false) => {
    if (!asDraft && !mandatoryDocsComplete) {
      showToast("Please upload all mandatory documents before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const travelServices: string[] = [];
      if (flightRequired) travelServices.push("flights");
      if (accommodationRequired) travelServices.push("accommodation");
      if (visaRequired) travelServices.push("visas");
      if (insuranceRequired) travelServices.push("insurance");

      const mediaOptions: string[] = [];
      if (pressRelease) mediaOptions.push("press_release");
      if (socialMedia) mediaOptions.push("social_media");
      if (liveStreaming) mediaOptions.push("live_streaming");
      if (photography) mediaOptions.push("photography");
      if (brandingMaterials) mediaOptions.push("branding_materials");

      const pillarValues = pillars.map((p) => (p === "Other" ? pillarOther.trim() : p)).filter(Boolean);
      const payload = {
        title,
        strategic_alignment: alignments,
        strategic_pillars: pillarValues,
        implementing_departments: depts,
        supporting_departments: supportDepts,
        background,
        overall_objective: overallObjective,
        specific_objectives: specificObjectives.map((o) => o.text).filter(Boolean),
        expected_outputs: expectedOutputs.map((o) => o.output).filter(Boolean),
        gender_considerations: genderConsiderations,
        target_beneficiaries: beneficiaries,
        primary_currency: currency,
        base_currency: baseCurrency,
        exchange_rate: exchangeRate ? parseFloat(exchangeRate) : 1,
        contingency_pct: parseFloat(contingencyPct) || 10,
        funding_source: budgetLines[0]?.fundingSource ?? "",
        funding_sources: fundingSources.filter((f) => f.name.trim()).map((f) => ({
          name: f.name.trim(),
          budget_amount: f.budget_amount ? parseFloat(f.budget_amount) : undefined,
          pays_for: f.pays_for.trim() || undefined,
        })),
        responsible_officer_ids: responsibleOfficerIds.length > 0 ? responsibleOfficerIds : undefined,
        meeting_format: meetingFormat || undefined,
        travel_required: hasTravelReqs,
        delegates_count: numDelegates ? parseInt(numDelegates) : null,
        member_states: memberStates ? [memberStates] : [],
        travel_services: travelServices,
        procurement_required: hasProcurement,
        media_options: mediaOptions,
        activities: activities
          .filter((a) => a.name.trim())
          .map((a) => ({
            name: a.name,
            start_date: a.startDate,
            end_date: a.endDate,
            responsible: a.responsible,
            location: a.location,
            status: a.status.toLowerCase(),
          })),
        milestones: milestones
          .filter((m) => m.name.trim())
          .map((m) => ({
            name: m.name,
            target_date: m.targetDate,
            completion_pct: m.completion,
          })),
        budget_lines: budgetLines
          .filter((b) => b.description.trim() || b.amount)
          .map((b) => ({
            category: b.category.toLowerCase().replace(/ /g, "_"),
            description: b.description,
            amount: parseFloat(b.amount) || 0,
            funding_source: b.fundingSource.toLowerCase().replace(/ & /g, "_").replace(/ /g, "_"),
            account_code: b.accountCode,
          })),
        procurement_items: hasProcurement
          ? procurementItems
            .filter((p) => p.description.trim())
            .map((p) => ({
              description: p.description,
              estimated_cost: parseFloat(p.estimatedCost) || 0,
              method: p.method.toLowerCase().replace(/ /g, "_"),
              vendor: p.vendor,
              delivery_date: p.deliveryDate,
            }))
          : [],
      };

      const res = await programmeApi.create(payload as any);
      const newId = (res.data as any).data?.id || (res.data as any).id;

      if (asDraft) {
        setToast("Draft saved successfully.");
        setTimeout(() => router.push(`/pif/${newId}`), 1000);
      } else {
        showToast("Programme submitted for approval.");
        setTimeout(() => router.push(`/pif/${newId}`), 1200);
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg = ax.response?.data?.message ?? (ax.response?.data?.errors && Object.values(ax.response.data.errors).flat()[0]) ?? "Failed to save programme. Please try again.";
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/pif" className="hover:text-primary transition-colors">Programmes</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">New Programme Implementation Form</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Programme Implementation Form (PIF)</h1>
          <p className="page-subtitle">Complete all sections to register a new institutional programme.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-neutral-400">Ref:</span>
          <code className="text-xs font-mono font-semibold text-primary bg-primary/5 rounded-lg px-2.5 py-1.5 border border-primary/20">{ref}</code>
          <button type="button" onClick={() => setRef(genRef())} title="Regenerate reference" className="text-neutral-300 hover:text-primary">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="card p-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
                <button type="button" onClick={() => done ? setStep(s.id) : undefined}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${active ? "bg-primary text-white shadow-sm" : done ? "bg-green-50 text-green-700 cursor-pointer hover:bg-green-100" : "bg-neutral-100 text-neutral-400 cursor-default"}`}>
                  {done
                    ? <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    : <span className="material-symbols-outlined text-[15px]">{s.icon}</span>
                  }
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.id}</span>
                </button>
                {i < STEPS.length - 1 && <span className="text-neutral-200 material-symbols-outlined text-[16px]">chevron_right</span>}
              </div>
            );
          })}
        </div>
        <div className="mt-3 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
        </div>
        <p className="text-xs text-neutral-400 mt-1">Step {step} of {STEPS.length} — {STEPS[step - 1].label}</p>
      </div>

      {/* ── Step 1: Basic Information ──────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="card p-6 space-y-4">
            <SectionHeader icon="badge" title="Programme Identification" />
            <div>
              <FormLabel required>Programme Title</FormLabel>
              <input className="form-input" placeholder="Short, descriptive title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <FormLabel>Programme Status</FormLabel>
              <div className="flex items-center h-[42px] px-3 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-500">
                <span className="badge inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-neutral-200 text-neutral-700">Draft</span>
                <span className="ml-2 text-xs italic opacity-75">(Auto-updated on submission)</span>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <SectionHeader icon="flag" title="Strategic Alignment" description="Select all that apply" color="bg-amber-50" iconColor="text-amber-600" />
            <CheckGroup options={STRATEGIC_ALIGNMENTS} selected={alignments} onChange={setAlignments} columns={2} />
            {alignments.length > 0 && (
              <div>
                <FormLabel>Strategic context (if applicable)</FormLabel>
                <input className="form-input" placeholder="e.g. Resolution 12/2025, Donor Agreement ref. EU-2026-012" value={alignmentOther} onChange={(e) => setAlignmentOther(e.target.value)} />
              </div>
            )}
          </div>

          <div className="card p-6 space-y-4">
            <SectionHeader icon="account_tree" title="Strategic Pillar & Ownership" color="bg-purple-50" iconColor="text-purple-600" />
            <div>
              <FormLabel required>Strategic Pillar</FormLabel>
              <p className="text-xs text-neutral-400 mb-2">Select all that apply</p>
              <CheckGroup options={STRATEGIC_PILLARS as unknown as string[]} selected={pillars} onChange={setPillars} columns={2} />
              {pillars.includes("Other") && (
                <div className="mt-3">
                  <FormLabel required>Specify pillar</FormLabel>
                  <input className="form-input" placeholder="Other pillar name…" value={pillarOther} onChange={(e) => setPillarOther(e.target.value)} />
                </div>
              )}
            </div>
            <div>
              <FormLabel required>Implementing Department</FormLabel>
              <p className="text-xs text-neutral-400 mb-2">Select all that apply</p>
              {departmentsList.length > 0 ? (
                <CheckGroup options={departmentsList} selected={depts} onChange={setDepts} columns={2} />
              ) : (
                <input className="form-input" placeholder="Type department names (comma-separated)" value={depts.join(", ")} onChange={(e) => setDepts(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
              )}
            </div>
            <div>
              <FormLabel>Supporting Departments</FormLabel>
              <p className="text-xs text-neutral-400 mb-2">Select all departments that will provide support</p>
              <CheckGroup options={SUPPORT_DEPTS} selected={supportDepts} onChange={setSupportDepts} columns={4} />
            </div>
            <div>
              <FormLabel>Responsible Officer</FormLabel>
              <p className="text-xs text-neutral-400 mb-2">Select one or more responsible officers</p>
              <OfficerMultiSelect
                value={responsibleOfficerIds}
                onChange={setResponsibleOfficerIds}
                users={tenantUsers}
              />
            </div>
            <div>
              <FormLabel required>Meeting Format</FormLabel>
              <p className="text-xs text-neutral-400 mb-2">Select the format for meetings under this programme</p>
              <div className="grid grid-cols-3 gap-3">
                {(["Physical", "Virtual", "Hybrid"] as const).map((fmt) => {
                  const icons: Record<string, string> = { Physical: "location_on", Virtual: "videocam", Hybrid: "devices" };
                  const descriptions: Record<string, string> = {
                    Physical: "In-person only",
                    Virtual: "Online only",
                    Hybrid: "Both in-person & online",
                  };
                  return (
                    <label
                      key={fmt}
                      onClick={() => setMeetingFormat(fmt)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3.5 cursor-pointer transition-colors text-center ${meetingFormat === fmt ? "border-primary bg-primary/5" : "border-neutral-200 hover:border-neutral-300"}`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${meetingFormat === fmt ? "bg-primary/15" : "bg-neutral-100"}`}>
                        <span className={`material-symbols-outlined text-[18px] ${meetingFormat === fmt ? "text-primary" : "text-neutral-400"}`}>{icons[fmt]}</span>
                      </div>
                      <span className={`text-sm font-semibold ${meetingFormat === fmt ? "text-primary" : "text-neutral-800"}`}>{fmt}</span>
                      <span className="text-[11px] text-neutral-400">{descriptions[fmt]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Programme Details ──────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="card p-6 space-y-4">
            <SectionHeader icon="description" title="Background & Justification"
              description="Include policy basis, committee recommendation, and regional relevance (100–3000 characters)" />
            <textarea rows={7} className="form-input resize-none font-sans"
              placeholder="Provide the background and justification for this programme, including the policy basis, relevant committee or plenary decisions, and regional significance…"
              value={background} onChange={(e) => setBackground(e.target.value)} />
            <div className="flex items-center justify-between">
              <span className={`text-xs ${background.length < 100 ? "text-red-400" : background.length > 3000 ? "text-red-500" : "text-green-600"}`}>
                {background.length} / 3000 chars {background.length < 100 ? `(minimum 100)` : ""}
              </span>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <SectionHeader icon="target" title="Objectives" color="bg-teal-50" iconColor="text-teal-600" />
            <div>
              <FormLabel required>Overall Objective</FormLabel>
              <textarea rows={3} className="form-input resize-none"
                placeholder="The overarching goal of this programme…"
                value={overallObjective} onChange={(e) => setOverallObjective(e.target.value)} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <FormLabel>Specific Objectives <span className="text-neutral-400 font-normal text-[11px]">(max 5)</span></FormLabel>
                {specificObjectives.length < 5 && (
                  <button type="button" onClick={addSpecificObj} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">add</span>Add objective
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {specificObjectives.map((obj, i) => (
                  <div key={obj.id} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-400 w-5 flex-shrink-0">{i + 1}.</span>
                    <input className="form-input flex-1" placeholder={`Specific objective ${i + 1}…`} value={obj.text} onChange={(e) => updateSpecificObj(obj.id, e.target.value)} />
                    {specificObjectives.length > 1 && (
                      <button type="button" onClick={() => removeSpecificObj(obj.id)} className="text-neutral-300 hover:text-red-400 flex-shrink-0">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <SectionHeader icon="output" title="Expected Outputs" description="Define measurable outputs with KPIs"
              color="bg-green-50" iconColor="text-green-600" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600">Output</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600">KPI</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600">Target</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600">Measurement Tool</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {expectedOutputs.map((o) => (
                    <tr key={o.id}>
                      <td className="px-2 py-1.5"><input className="form-input text-xs" placeholder="Output description…" value={o.output} onChange={(e) => updateOutput(o.id, "output", e.target.value)} /></td>
                      <td className="px-2 py-1.5"><input className="form-input text-xs" placeholder="e.g. No. of participants" value={o.kpi} onChange={(e) => updateOutput(o.id, "kpi", e.target.value)} /></td>
                      <td className="px-2 py-1.5"><input className="form-input text-xs" placeholder="e.g. 50" value={o.target} onChange={(e) => updateOutput(o.id, "target", e.target.value)} /></td>
                      <td className="px-2 py-1.5"><input className="form-input text-xs" placeholder="e.g. Attendance register" value={o.measurementTool} onChange={(e) => updateOutput(o.id, "measurementTool", e.target.value)} /></td>
                      <td className="px-2 py-1.5">
                        {expectedOutputs.length > 1 && (
                          <button type="button" onClick={() => removeOutput(o.id)} className="text-neutral-300 hover:text-red-400">
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addOutput} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">add</span>Add output row
            </button>
          </div>

          <div className="card p-6 space-y-4">
            <SectionHeader icon="groups" title="Target Beneficiaries & Inclusion" color="bg-indigo-50" iconColor="text-indigo-600" />
            <div>
              <FormLabel>Target Beneficiaries</FormLabel>
              <CheckGroup options={BENEFICIARIES} selected={beneficiaries} onChange={setBeneficiaries} columns={4} />
            </div>
            <div>
              <FormLabel required>Gender & Inclusion Considerations</FormLabel>
              <textarea rows={3} className="form-input resize-none"
                placeholder="Describe how this programme promotes gender equality and inclusion of marginalised groups…"
                value={genderConsiderations} onChange={(e) => setGenderConsiderations(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Activities & Milestones ────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="card overflow-hidden">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">checklist</span>
                <h3 className="text-sm font-semibold text-neutral-900">Activity Plan</h3>
              </div>
              <button type="button" onClick={addActivity} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">add</span>Add Activity
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600">Activity</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 w-32">Start Date</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 w-32">End Date</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600">Responsible</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600">Location</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 w-28">Status</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {activities.map((a) => (
                    <tr key={a.id} className="hover:bg-neutral-50/50">
                      <td className="px-2 py-2"><input className="form-input text-xs" placeholder="Activity name…" value={a.name} onChange={(e) => updateActivity(a.id, "name", e.target.value)} /></td>
                      <td className="px-2 py-2"><input type="date" className="form-input text-xs" value={a.startDate} onChange={(e) => updateActivity(a.id, "startDate", e.target.value)} /></td>
                      <td className="px-2 py-2"><input type="date" className="form-input text-xs" value={a.endDate} onChange={(e) => updateActivity(a.id, "endDate", e.target.value)} /></td>
                      <td className="px-2 py-2 min-w-[180px]">
                        <ResponsibleMultiSelect
                          value={a.responsible}
                          onChange={(v) => updateActivity(a.id, "responsible", v)}
                          options={[...new Set([...tenantUsers.map((u) => String(u.name ?? "")), ...departmentsList, ...customResponsibles].filter(Boolean))]}
                          onAddCustom={(name) => setCustomResponsibles((prev) => (prev.includes(name) ? prev : [...prev, name]))}
                        />
                      </td>
                      <td className="px-2 py-2"><input className="form-input text-xs" placeholder="City, Country" value={a.location} onChange={(e) => updateActivity(a.id, "location", e.target.value)} /></td>
                      <td className="px-2 py-2">
                        <select className="form-input text-xs" value={a.status} onChange={(e) => updateActivity(a.id, "status", e.target.value)}>
                          {ACTIVITY_STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        {activities.length > 1 && (
                          <button type="button" onClick={() => removeActivity(a.id)} className="text-neutral-300 hover:text-red-400">
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[18px]">flag</span>
                <h3 className="text-sm font-semibold text-neutral-900">Milestones</h3>
              </div>
              <button type="button" onClick={addMilestone} className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">add</span>Add Milestone
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600">Milestone</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 w-36">Target Date</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 w-40">Completion %</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {milestones.map((m) => (
                    <tr key={m.id} className="hover:bg-neutral-50/50">
                      <td className="px-2 py-2"><input className="form-input text-xs" placeholder="Milestone name…" value={m.name} onChange={(e) => updateMilestone(m.id, "name", e.target.value)} /></td>
                      <td className="px-2 py-2"><input type="date" className="form-input text-xs" value={m.targetDate} onChange={(e) => updateMilestone(m.id, "targetDate", e.target.value)} /></td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <input type="range" min="0" max="100" step="5" className="flex-1" value={m.completion} onChange={(e) => updateMilestone(m.id, "completion", parseInt(e.target.value))} />
                          <span className="text-xs font-bold text-primary w-10 text-right">{m.completion}%</span>
                        </div>
                        <div className="h-1 bg-neutral-100 rounded-full mt-1">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${m.completion}%` }} />
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        {milestones.length > 1 && (
                          <button type="button" onClick={() => removeMilestone(m.id)} className="text-neutral-300 hover:text-red-400">
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Budget ─────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="card p-6 space-y-4">
            <SectionHeader icon="payments" title="Currency Settings" color="bg-green-50" iconColor="text-green-600" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <FormLabel>Primary Currency</FormLabel>
                <select className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <FormLabel>Base Currency</FormLabel>
                <select className="form-input" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value as typeof baseCurrency)}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <FormLabel>Exchange Rate</FormLabel>
                <input type="number" min="0" step="0.0001" className="form-input" placeholder="e.g. 18.45" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} />
              </div>
              <div>
                <FormLabel>Max Contingency %</FormLabel>
                <input type="number" min="0" max="20" className="form-input" value={contingencyPct} onChange={(e) => setContingencyPct(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <SectionHeader icon="account_balance" title="Funding Sources" description="Add one or more funding sources; each can have a budget and what they pay for" color="bg-teal-50" iconColor="text-teal-600" />
            <div className="space-y-3">
              {fundingSources.map((fs) => (
                <div key={fs.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-neutral-200 p-3">
                  <div className="flex-1 min-w-[140px]">
                    <FormLabel>Name</FormLabel>
                    <input className="form-input text-sm" placeholder="e.g. Core Budget, Donor X" value={fs.name} onChange={(e) => updateFundingSource(fs.id, "name", e.target.value)} />
                  </div>
                  <div className="w-32">
                    <FormLabel>Budget ({currency})</FormLabel>
                    <input type="number" min="0" step="0.01" className="form-input text-sm" placeholder="0" value={fs.budget_amount} onChange={(e) => updateFundingSource(fs.id, "budget_amount", e.target.value)} />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <FormLabel>What they pay for</FormLabel>
                    <input className="form-input text-sm" placeholder="e.g. Travel, catering" value={fs.pays_for} onChange={(e) => updateFundingSource(fs.id, "pays_for", e.target.value)} />
                  </div>
                  {fundingSources.length > 1 && (
                    <button type="button" onClick={() => removeFundingSource(fs.id)} className="text-neutral-300 hover:text-red-400 mt-6" title="Remove">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addFundingSource} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">add</span>Add funding source
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">table_chart</span>
                <h3 className="text-sm font-semibold text-neutral-900">Budget Lines</h3>
              </div>
              <button type="button" onClick={addBudgetLine} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">add</span>Add Line
              </button>
            </div>

            {contingencyExceeded && (
              <div className="mx-5 mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500 text-[16px]">warning</span>
                <span className="text-xs text-red-700 font-medium">Contingency ({contingencyActualPct}%) exceeds the maximum allowed ({contingencyPct}%)</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 w-36">Category</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600">Description</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 w-32">Amount ({currency})</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 w-32">Funding Source</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 w-28">Account Code</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {budgetLines.map((l) => (
                    <tr key={l.id} className={`hover:bg-neutral-50/50 ${l.category === "Contingency" && contingencyExceeded ? "bg-red-50/30" : ""}`}>
                      <td className="px-2 py-2">
                        <select className="form-input text-xs" value={l.category} onChange={(e) => updateBudget(l.id, "category", e.target.value)}>
                          {BUDGET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2"><input className="form-input text-xs" placeholder="Description…" value={l.description} onChange={(e) => updateBudget(l.id, "description", e.target.value)} /></td>
                      <td className="px-2 py-2"><input type="number" min="0" step="0.01" className="form-input text-xs" placeholder="0.00" value={l.amount} onChange={(e) => updateBudget(l.id, "amount", e.target.value)} /></td>
                      <td className="px-2 py-2">
                        <select className="form-input text-xs" value={l.fundingSource} onChange={(e) => updateBudget(l.id, "fundingSource", e.target.value)}>
                          {fundingSources.filter((f) => f.name.trim()).map((f) => (
                            <option key={f.id} value={f.name}>{f.name}</option>
                          ))}
                          {fundingSources.every((f) => !f.name.trim()) && <option value="Core Budget">Core Budget</option>}
                          {budgetsList.length > 0 && <optgroup label="Project budgets">
                            {budgetsList.filter((b: { type?: string }) => b.type === "project").map((b: { id: number; name: string }) => (
                              <option key={b.id} value={b.name}>{b.name}</option>
                            ))}
                          </optgroup>}
                        </select>
                      </td>
                      <td className="px-2 py-2"><input className="form-input text-xs" placeholder="e.g. 4200-01" value={l.accountCode} onChange={(e) => updateBudget(l.id, "accountCode", e.target.value)} /></td>
                      <td className="px-2 py-2">
                        {budgetLines.length > 1 && (
                          <button type="button" onClick={() => removeBudgetLine(l.id)} className="text-neutral-300 hover:text-red-400">
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-neutral-50 border-t-2 border-neutral-200">
                  <tr>
                    <td colSpan={2} className="px-3 py-3 text-xs font-bold text-neutral-700">TOTAL</td>
                    <td className="px-3 py-3 text-sm font-bold text-primary">{currency} {budgetTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Travel ─────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-5">
          <div className="card p-6 space-y-4">
            <SectionHeader icon="flight_takeoff" title="Travel Requirements" color="bg-teal-50" iconColor="text-teal-600" />
            <div className="flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-100 p-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Travel required for this programme?</p>
                <p className="text-xs text-neutral-400 mt-0.5">Enabling will auto-generate travel requisition forms</p>
              </div>
              <button type="button" onClick={() => setHasTravelReqs(!hasTravelReqs)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hasTravelReqs ? "bg-primary" : "bg-neutral-200"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${hasTravelReqs ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            {hasTravelReqs && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FormLabel>Number of Delegates</FormLabel>
                    <input type="number" min="0" className="form-input" value={numDelegates} onChange={(e) => setNumDelegates(e.target.value)} />
                  </div>
                  <div>
                    <FormLabel>Member States Involved</FormLabel>
                    <input className="form-input" placeholder="e.g. Namibia, Botswana, Zimbabwe" value={memberStates} onChange={(e) => setMemberStates(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Flights Required", val: flightRequired, set: setFlightRequired },
                    { label: "Accommodation Required", val: accommodationRequired, set: setAccommodationRequired },
                    { label: "Visa Required", val: visaRequired, set: setVisaRequired },
                    { label: "Insurance Required", val: insuranceRequired, set: setInsuranceRequired },
                  ].map((item) => (
                    <label key={item.label} className={`flex items-center gap-2 rounded-xl border p-3 cursor-pointer transition-colors ${item.val ? "border-primary bg-primary/5" : "border-neutral-200 hover:border-neutral-300"}`}>
                      <button type="button" onClick={() => item.set(!item.val)}
                        className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${item.val ? "bg-primary border-primary" : "border-neutral-300"}`}>
                        {item.val && <span className="material-symbols-outlined text-white text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>}
                      </button>
                      <span className="text-xs font-medium text-neutral-700">{item.label}</span>
                    </label>
                  ))}
                </div>
                <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 flex items-start gap-2">
                  <span className="material-symbols-outlined text-teal-600 text-[16px] mt-0.5">info</span>
                  <p className="text-xs text-teal-700">Upon approval, the system will auto-generate individual Travel Requisition Forms, participant lists, and flight request documents based on these settings.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 6: Procurement ────────────────────────────────────────────── */}
      {step === 6 && (
        <div className="space-y-5">
          <div className="card p-6 space-y-4">
            <SectionHeader icon="shopping_cart" title="Procurement Requirements" color="bg-indigo-50" iconColor="text-indigo-600" />
            <div className="flex flex-col gap-2">
              {[
                { label: "No procurement required", val: !hasProcurement },
                { label: "Procurement required", val: hasProcurement },
              ].map((opt) => (
                <label key={opt.label} className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${opt.val ? "border-primary bg-primary/5" : "border-neutral-200"}`}
                  onClick={() => setHasProcurement(!hasProcurement)}>
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${opt.val ? "border-primary" : "border-neutral-300"}`}>
                    {opt.val && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm font-medium text-neutral-900">{opt.label}</span>
                </label>
              ))}
            </div>

            {hasProcurement && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-neutral-700">Procurement Items</p>
                  <button type="button" onClick={addProcItem} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">add</span>Add item
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 border-b border-neutral-100">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 min-w-[180px]">Description</th>
                        <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 w-28">Est. Cost (NAD)</th>
                        <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 w-32">Method</th>
                        <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 min-w-[120px]">Vendor</th>
                        <th className="text-left px-3 py-2 text-xs font-bold text-neutral-600 w-32">Delivery Date</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {procurementItems.map((p) => (
                        <tr key={p.id}>
                          <td className="px-2 py-2"><input className="form-input text-xs" placeholder="Item…" value={p.description} onChange={(e) => updateProcItem(p.id, "description", e.target.value)} /></td>
                          <td className="px-2 py-2"><input type="number" min="0" className="form-input text-xs" placeholder="0.00" value={p.estimatedCost} onChange={(e) => updateProcItem(p.id, "estimatedCost", e.target.value)} /></td>
                          <td className="px-2 py-2">
                            <select className="form-input text-xs" value={p.method} onChange={(e) => updateProcItem(p.id, "method", e.target.value)}>
                              {PROCUREMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2"><input className="form-input text-xs" placeholder="Vendor name…" value={p.vendor} onChange={(e) => updateProcItem(p.id, "vendor", e.target.value)} /></td>
                          <td className="px-2 py-2"><input type="date" className="form-input text-xs" value={p.deliveryDate} onChange={(e) => updateProcItem(p.id, "deliveryDate", e.target.value)} /></td>
                          <td className="px-2 py-2">
                            {procurementItems.length > 1 && (
                              <button type="button" onClick={() => removeProcItem(p.id)} className="text-neutral-300 hover:text-red-400">
                                <span className="material-symbols-outlined text-[15px]">delete</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 7: Media & Comms ───────────────────────────────────────────── */}
      {step === 7 && (
        <div className="space-y-5">
          <div className="card p-6 space-y-4">
            <SectionHeader icon="campaign" title="Communication & Media Plan" color="bg-purple-50" iconColor="text-purple-600" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Press Release", val: pressRelease, set: setPressRelease },
                { label: "Social Media Campaign", val: socialMedia, set: setSocialMedia },
                { label: "Live Streaming", val: liveStreaming, set: setLiveStreaming },
                { label: "Photography / Video", val: photography, set: setPhotography },
                { label: "Branding Materials", val: brandingMaterials, set: setBrandingMaterials },
              ].map((item) => (
                <label key={item.label}
                  className={`flex items-center gap-2.5 rounded-xl border p-3.5 cursor-pointer transition-colors ${item.val ? "border-primary bg-primary/5" : "border-neutral-200 hover:border-neutral-300"}`}
                  onClick={() => item.set(!item.val)}>
                  <button type="button"
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${item.val ? "bg-primary border-primary" : "border-neutral-300"}`}>
                    {item.val && <span className="material-symbols-outlined text-white text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>}
                  </button>
                  <span className="text-sm font-medium text-neutral-800">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 8: Documents ──────────────────────────────────────────────── */}
      {step === 8 && (
        <div className="space-y-5">
          <div className="card p-6 space-y-5">
            <SectionHeader icon="attach_file" title="Document Uploads" description="Mandatory documents must be uploaded before submission" />

            {/* Mandatory */}
            <div>
              <p className="text-xs font-bold text-neutral-700 mb-3 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />Mandatory Documents
              </p>
              <div className="space-y-2">
                {["Concept Note", "Draft Agenda", "Budget Breakdown"].map((docType) => {
                  const uploaded = uploadedDocs.find((d) => d.type === docType && d.mandatory);
                  return (
                    <div key={docType} className={`flex items-center justify-between rounded-xl border p-3.5 ${uploaded ? "border-green-200 bg-green-50" : "border-neutral-200"}`}>
                      <div className="flex items-center gap-2.5">
                        <span className={`material-symbols-outlined text-[20px] ${uploaded ? "text-green-600" : "text-neutral-300"}`}
                          style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                          {uploaded ? "check_circle" : "upload_file"}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{docType}</p>
                          {uploaded && <p className="text-xs text-green-600 mt-0.5">{uploaded.name}</p>}
                          {!uploaded && <p className="text-xs text-red-400">Required — not yet uploaded</p>}
                        </div>
                      </div>
                      <label className={`cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${uploaded ? "border-green-200 text-green-700 hover:bg-green-100" : "border-primary text-primary hover:bg-primary/5"}`}>
                        {uploaded ? "Replace" : "Upload"}
                        <input type="file" accept=".pdf,.docx,.xlsx" className="hidden" onChange={handleFileUpload(true, docType)} />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Optional */}
            <div>
              <p className="text-xs font-bold text-neutral-700 mb-3 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 inline-block" />Optional Documents
              </p>
              <div className="space-y-2">
                {["Donor Agreement", "Committee Resolution", "TORs", "Contracts"].map((docType) => {
                  const uploaded = uploadedDocs.find((d) => d.type === docType);
                  return (
                    <div key={docType} className={`flex items-center justify-between rounded-xl border p-3.5 ${uploaded ? "border-green-200 bg-green-50" : "border-neutral-100 bg-neutral-50"}`}>
                      <div className="flex items-center gap-2.5">
                        <span className={`material-symbols-outlined text-[20px] ${uploaded ? "text-green-600" : "text-neutral-300"}`}
                          style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                          {uploaded ? "check_circle" : "upload_file"}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-neutral-700">{docType}</p>
                          {uploaded && <p className="text-xs text-green-600 mt-0.5">{uploaded.name}</p>}
                        </div>
                      </div>
                      <label className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 transition-colors">
                        {uploaded ? "Replace" : "Upload"}
                        <input type="file" accept=".pdf,.docx,.xlsx" className="hidden" onChange={handleFileUpload(false, docType)} />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {!mandatoryDocsComplete && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5">
                <span className="material-symbols-outlined text-red-500 text-[16px]">error</span>
                <span className="text-xs text-red-700 font-medium">
                  All mandatory documents must be uploaded before you can submit this programme.
                </span>
              </div>
            )}
            <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-3 text-xs text-neutral-500">
              Accepted formats: <strong>PDF, DOCX, XLSX</strong> · All uploads are versioned and included in the audit trail.
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="card p-4 flex items-center justify-between">
        <div className="flex gap-2">
          {step > 1 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-secondary px-4 py-2.5 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>Previous
            </button>
          )}
          <Link href="/pif" className="btn-secondary px-4 py-2.5 text-sm">Cancel</Link>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={() => handleSubmit(true)} disabled={submitting}
            className="btn-secondary px-4 py-2.5 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">save</span>Save Draft
          </button>
          {step < STEPS.length ? (
            <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}
              className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40">
              Next<span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button type="button" onClick={() => handleSubmit(false)} disabled={submitting}
              className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit for Approval"}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
