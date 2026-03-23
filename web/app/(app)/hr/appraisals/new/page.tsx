"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appraisalApi, hrFilesApi, tenantUsersApi, type AppraisalCycle, type HrPersonalFile, type TenantUserOption, type AuthUser } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

interface DepartmentInfo {
  id: number;
  name: string;
  hod?: { id: number; name: string; email: string } | null;
}

function UserAutocomplete({
  label,
  value,
  onSelect,
  hint,
}: {
  label: string;
  value: TenantUserOption | null;
  onSelect: (u: TenantUserOption | null) => void;
  hint?: string;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [options, setOptions] = useState<TenantUserOption[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value]);

  useEffect(() => {
    if (!query.trim() || (value && query === value.name)) { setOptions([]); return; }
    const t = setTimeout(async () => {
      setFetching(true);
      try {
        const r = await tenantUsersApi.list({ search: query });
        const data = (r.data as { data?: TenantUserOption[] }).data ?? (Array.isArray(r.data) ? r.data as unknown as TenantUserOption[] : []);
        setOptions(data);
      } catch { setOptions([]); }
      finally { setFetching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {value ? (
        <div className="form-input bg-neutral-50 text-neutral-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-neutral-400">manage_accounts</span>
          <span className="flex-1">{value.name}</span>
          <span className="text-xs text-neutral-400">{value.email}</span>
          <span className="ml-auto text-xs text-green-600 font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Selected
          </span>
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => { onSelect(null); setQuery(""); }}>
            Clear
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none text-[18px]">search</span>
            <input
              type="text"
              className="form-input w-full pl-9"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              autoComplete="off"
            />
          </div>
          {hint && <p className="text-xs text-neutral-400">{hint}</p>}
        </div>
      )}
      {open && !value && query.trim().length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {fetching ? (
            <div className="px-3 py-3 text-xs text-neutral-400 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              Searching…
            </div>
          ) : options.length === 0 ? (
            <div className="px-3 py-3 text-xs text-neutral-400">No users found for &ldquo;{query}&rdquo;</div>
          ) : options.map((u) => (
            <button
              key={u.id}
              type="button"
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary/5 transition-colors flex items-center gap-3 border-b border-neutral-50 last:border-0"
              onMouseDown={(e) => { e.preventDefault(); onSelect(u); setOpen(false); }}
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-neutral-800 truncate">{u.name}</p>
                <p className="text-xs text-neutral-400 truncate">{u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewAppraisalPage() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [cycles, setCycles] = useState<AppraisalCycle[]>([]);
  const [myFile, setMyFile] = useState<HrPersonalFile | null>(null);
  const [department, setDepartment] = useState<DepartmentInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycleId, setCycleId] = useState<string>("");
  const [supervisor, setSupervisor] = useState<TenantUserOption | null>(null);
  const [hod, setHod] = useState<TenantUserOption | null>(null);
  const [kraRows, setKraRows] = useState<Array<{ title: string; description: string; weight: string }>>([
    { title: "", description: "", weight: "" },
  ]);

  useEffect(() => {
    // Load current user from localStorage
    const user = getStoredUser();
    setMe(user);

    // Load cycles
    appraisalApi.cycles()
      .then((r) => setCycles(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCycles([]));

    // Try to load the current user's HR file to auto-detect department / supervisor / HOD
    const userName = user?.name;
    if (userName) {
      hrFilesApi
        .list({ search: userName, per_page: 5 })
        .then((r) => {
          const data = (r.data as { data?: HrPersonalFile[] }).data ?? [];
          // Find the file that belongs to the current user (match by employee id)
          const file = Array.isArray(data)
            ? (data.find((f) => f.employee_id === user?.id) ?? data[0] ?? null)
            : null;
          setMyFile(file);

          if (file) {
            // Auto-populate department info
            if (file.department) {
              setDepartment({
                id: (file.department as { id: number; name: string }).id,
                name: (file.department as { id: number; name: string }).name,
              });
            }
            // Auto-populate supervisor
            if (file.supervisor_id) {
              const sv = file.supervisor as { id: number; name: string; email?: string } | undefined;
              if (sv?.name) setSupervisor({ id: sv.id, name: sv.name, email: sv.email ?? "" });
            }
            // Auto-populate HOD
            const hodFromFile = (file as unknown as Record<string, unknown>).hod as { id: number; name: string; email?: string } | undefined;
            const hodIdFromFile = (file as unknown as Record<string, unknown>).hod_id as number | undefined;
            if (hodIdFromFile && hodFromFile?.name) {
              setHod({ id: hodIdFromFile, name: hodFromFile.name, email: hodFromFile.email ?? "" });
            }
          }
        })
        .catch(() => {
          // HR file not found — user can still proceed without auto-detect
        })
        .finally(() => setLoadingContext(false));
    } else {
      setLoadingContext(false);
    }
  }, []);

  const addKra = () => setKraRows((prev) => [...prev, { title: "", description: "", weight: "" }]);
  const removeKra = (i: number) => setKraRows((prev) => prev.filter((_, idx) => idx !== i));
  const updateKra = (i: number, field: "title" | "description" | "weight", value: string) => {
    setKraRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!cycleId) {
      setError("Please select an appraisal cycle.");
      return;
    }
    if (!me?.id) {
      setError("Unable to determine your identity. Please log out and log in again.");
      return;
    }
    setLoading(true);
    try {
      const kras = kraRows
        .filter((r) => r.title.trim())
        .map((r, i) => ({
          title: r.title.trim(),
          description: r.description.trim() || undefined,
          weight: r.weight ? Number(r.weight) : undefined,
          sort_order: i,
        }));
      const res = await appraisalApi.create({
        cycle_id: Number(cycleId),
        employee_id: me.id,
        supervisor_id: supervisor?.id,
        hod_id: hod?.id,
        status: "draft",
        kras: kras.length ? kras : undefined,
      });
      router.push(`/hr/appraisals/${(res.data as { id: number }).id}`);
    } catch (err: unknown) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to create appraisal."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/hr" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-block">HR</Link>
        <Link href="/hr/appraisals" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 block">Appraisals</Link>
        <h1 className="page-title">Start my appraisal</h1>
        <p className="page-subtitle">
          Initiate your own performance appraisal for the selected cycle. Your supervisor and HOD will be automatically identified from your HR file.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-5 space-y-5">

        {/* Employee — locked to current user */}
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-1">Employee</label>
          <div className="form-input bg-neutral-50 text-neutral-700 flex items-center gap-2 cursor-not-allowed">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">person</span>
            <span className="font-medium">{me?.name ?? "Loading…"}</span>
            <span className="text-neutral-400 text-xs ml-1">{me?.email}</span>
            <span className="ml-auto text-xs text-neutral-400">You</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Appraisals can only be initiated for yourself.
          </p>
        </div>

        {/* Department — auto-detected */}
        {(department || loadingContext) && (
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Department</label>
            <div className="form-input bg-neutral-50 text-neutral-700 flex items-center gap-2 cursor-not-allowed">
              <span className="material-symbols-outlined text-[18px] text-neutral-400">apartment</span>
              {loadingContext ? (
                <span className="text-neutral-400 text-sm">Detecting…</span>
              ) : (
                <span>{department?.name ?? "—"}</span>
              )}
            </div>
          </div>
        )}

        {/* Cycle */}
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-1">Appraisal cycle *</label>
          <select
            className="form-input w-full"
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            required
          >
            <option value="">Select cycle</option>
            {cycles.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.title}
                {c.period_start && c.period_end && (
                  ` (${new Date(c.period_start).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(c.period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})`
                )}
              </option>
            ))}
          </select>
        </div>

        {/* Supervisor — auto-detected or searchable */}
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-1">Supervisor</label>
          {loadingContext ? (
            <div className="form-input bg-neutral-50 text-neutral-400 text-sm">Detecting from HR file…</div>
          ) : (
            <UserAutocomplete
              label="Supervisor"
              value={supervisor}
              onSelect={setSupervisor}
              hint="Auto-detected from your HR file. Search to change or leave blank if not required."
            />
          )}
        </div>

        {/* HOD — auto-detected or searchable */}
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-1">Head of Department (HOD)</label>
          {loadingContext ? (
            <div className="form-input bg-neutral-50 text-neutral-400 text-sm">Detecting from HR file…</div>
          ) : (
            <UserAutocomplete
              label="HOD"
              value={hod}
              onSelect={setHod}
              hint="Auto-detected from your department record. Search to change or leave blank if not required."
            />
          )}
        </div>

        {/* KRAs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="block text-sm font-semibold text-neutral-700">Key result areas</label>
              <p className="text-xs text-neutral-400">Optional — you can add or edit KRAs on the next screen.</p>
            </div>
            <button type="button" onClick={addKra} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">add</span>
              Add KRA
            </button>
          </div>
          {kraRows.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-start mb-2 p-3 rounded-lg border border-neutral-100 bg-neutral-50/50">
              <input
                type="text"
                className="form-input flex-1 min-w-[140px]"
                placeholder="Title *"
                value={row.title}
                onChange={(e) => updateKra(i, "title", e.target.value)}
              />
              <input
                type="text"
                className="form-input flex-1 min-w-[140px]"
                placeholder="Description"
                value={row.description}
                onChange={(e) => updateKra(i, "description", e.target.value)}
              />
              <input
                type="number"
                min={0}
                max={100}
                className="form-input w-20"
                placeholder="Weight %"
                value={row.weight}
                onChange={(e) => updateKra(i, "weight", e.target.value)}
              />
              <button type="button" onClick={() => removeKra(i)} className="text-neutral-400 hover:text-red-600 p-1 mt-1">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          ))}
        </div>

        {/* Context notice */}
        <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3 text-sm text-primary flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">info</span>
          <div>
            <p className="font-semibold mb-0.5">About this appraisal</p>
            <p className="text-xs text-primary/80">
              This creates a draft appraisal for <strong>{me?.name ?? "you"}</strong>. You will complete your self-assessment on the next screen. Your supervisor will receive it for review once you submit.
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading || !cycleId} className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">{loading ? "progress_activity" : "rate_review"}</span>
            {loading ? "Creating…" : "Create appraisal"}
          </button>
          <Link href="/hr/appraisals" className="btn-secondary px-4 py-2 text-sm">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
