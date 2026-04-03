"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saamApi,
  type SignatureProfile,
  type SignatureEvent,
  type DelegatedAuthority,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isActiveDelegation(d: DelegatedAuthority): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return d.start_date <= today && d.end_date >= today;
}

function sigTypeLabel(type: "full" | "initials"): string {
  return type === "full" ? "Full Signature" : "Initials";
}

function sigTypeIcon(type: "full" | "initials"): string {
  return type === "full" ? "draw" : "text_fields";
}

function moduleLabel(signableType: string): string {
  const map: Record<string, string> = {
    "App\\Models\\TravelRequest": "Travel",
    "App\\Models\\LeaveRequest": "Leave",
    "App\\Models\\ImprestRequest": "Imprest",
    "App\\Models\\ProcurementRequest": "Procurement",
    "App\\Models\\FinanceRecord": "Finance",
    "App\\Models\\Correspondence": "Correspondence",
    "App\\Models\\HrPersonalFile": "HR",
  };
  return map[signableType] ?? signableType.split("\\").pop() ?? signableType;
}

function moduleColor(signableType: string): string {
  const map: Record<string, string> = {
    "App\\Models\\TravelRequest": "text-blue-600 bg-blue-50",
    "App\\Models\\LeaveRequest": "text-green-600 bg-green-50",
    "App\\Models\\ImprestRequest": "text-amber-600 bg-amber-50",
    "App\\Models\\ProcurementRequest": "text-purple-600 bg-purple-50",
    "App\\Models\\FinanceRecord": "text-teal-600 bg-teal-50",
    "App\\Models\\Correspondence": "text-indigo-600 bg-indigo-50",
    "App\\Models\\HrPersonalFile": "text-pink-600 bg-pink-50",
  };
  return map[signableType] ?? "text-neutral-600 bg-neutral-100";
}

function actionBadgeClass(action: string): string {
  if (action === "approved" || action === "signed") return "badge-success";
  if (action === "rejected" || action === "revoked") return "badge-danger";
  if (action === "reviewed") return "badge-primary";
  return "badge-muted";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card p-5 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-neutral-100 rounded-lg" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  loading,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="card px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <span
          className="material-symbols-outlined text-[20px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-500 font-medium">{label}</p>
        {loading ? (
          <div className="mt-1 h-5 w-8 bg-neutral-100 rounded animate-pulse" />
        ) : (
          <p className="text-xl font-bold text-neutral-900">{value}</p>
        )}
      </div>
    </div>
  );
}

// ─── Signature Profile Card ───────────────────────────────────────────────────

function SignatureProfileCard({ profiles, loading, onRevoke }: {
  profiles: SignatureProfile[];
  loading: boolean;
  onRevoke: (type: "full" | "initials") => void;
}) {
  const router = useRouter();
  const [revokeTarget, setRevokeTarget] = useState<"full" | "initials" | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const fullProfile = profiles.find((p) => p.type === "full");
  const initialsProfile = profiles.find((p) => p.type === "initials");

  function confirmRevoke(type: "full" | "initials") {
    setRevokeTarget(type);
  }

  function handleRevoke() {
    if (revokeTarget) {
      onRevoke(revokeTarget);
      setRevokeTarget(null);
    }
  }

  if (loading) return <SkeletonCard rows={5} />;

  const hasAny = profiles.length > 0;

  return (
    <>
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              draw
            </span>
            <h2 className="text-sm font-semibold text-neutral-900">My Signature Profile</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/saam/verify/draw")}
              className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">gesture</span>
              Draw
            </button>
            <button
              onClick={() => router.push("/saam/verify/upload")}
              className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">upload</span>
              Upload
            </button>
          </div>
        </div>

        {/* Body */}
        {!hasAny ? (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
              <span
                className="material-symbols-outlined text-neutral-400 text-[24px]"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                signature
              </span>
            </div>
            <p className="text-sm font-medium text-neutral-700">No signatures on file</p>
            <p className="text-xs text-neutral-400 mt-1">
              Draw or upload your signature to start signing documents.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => router.push("/saam/verify/draw")}
                className="btn-primary text-sm"
              >
                <span className="material-symbols-outlined text-[16px]">gesture</span>
                Draw Signature
              </button>
              <button
                onClick={() => router.push("/saam/verify/upload")}
                className="btn-secondary text-sm"
              >
                <span className="material-symbols-outlined text-[16px]">upload</span>
                Upload Signature
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {(["full", "initials"] as const).map((sigType) => {
              const profile = sigType === "full" ? fullProfile : initialsProfile;
              const isActive = profile?.status === "active";
              const version = profile?.active_version;
              const imageErrorKey = `${sigType}-${version?.id}`;

              return (
                <div key={sigType} className="px-5 py-4 flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      profile ? (isActive ? "bg-primary/10" : "bg-neutral-100") : "bg-neutral-50"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        profile ? (isActive ? "text-primary" : "text-neutral-400") : "text-neutral-300"
                      }`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {sigTypeIcon(sigType)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-neutral-900">
                        {sigTypeLabel(sigType)}
                      </span>
                      {profile ? (
                        isActive ? (
                          <span className="badge-success text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            Active
                          </span>
                        ) : (
                          <span className="badge-muted text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            Revoked
                          </span>
                        )
                      ) : (
                        <span className="badge-muted text-[10px] px-2 py-0.5 rounded-full font-semibold">
                          Not set
                        </span>
                      )}
                    </div>

                    {version && (
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Version {version.version_no} · Active since {formatDate(version.effective_from)}
                      </p>
                    )}

                    {/* Signature preview image */}
                    {version && !imageErrors[imageErrorKey] && (
                      <div className="mt-2 inline-block border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50">
                        <img
                          src={saamApi.signatureImageUrl(version.id)}
                          alt={`${sigTypeLabel(sigType)} preview`}
                          className="h-14 max-w-[200px] object-contain p-1"
                          onError={() =>
                            setImageErrors((prev) => ({ ...prev, [imageErrorKey]: true }))
                          }
                        />
                      </div>
                    )}
                    {version && imageErrors[imageErrorKey] && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-neutral-400 border border-dashed border-neutral-200 rounded-lg px-3 py-2">
                        <span className="material-symbols-outlined text-[14px]">broken_image</span>
                        Preview unavailable
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {!profile || !isActive ? (
                      <button
                        onClick={() =>
                          router.push(sigType === "full" ? "/saam/verify/draw" : "/saam/verify/upload")
                        }
                        className="btn-primary text-xs py-1.5 px-3 gap-1"
                      >
                        <span className="material-symbols-outlined text-[13px]">add</span>
                        Set up
                      </button>
                    ) : (
                      <button
                        onClick={() => confirmRevoke(sigType)}
                        className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revoke confirmation dialog */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setRevokeTarget(null)}
          />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <span
                  className="material-symbols-outlined text-red-600 text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  warning
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Revoke Signature</h3>
                <p className="text-xs text-neutral-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 mb-5">
              Are you sure you want to revoke your{" "}
              <span className="font-semibold">{sigTypeLabel(revokeTarget)}</span>? You will need to
              draw or upload a new one to continue signing documents.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRevokeTarget(null)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">delete</span>
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Recent Events ────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  approve:     { icon: "check_circle", color: "text-green-600",  bg: "bg-green-50",   label: "Approved"     },
  reject:      { icon: "cancel",       color: "text-red-600",    bg: "bg-red-50",     label: "Rejected"     },
  review:      { icon: "search",       color: "text-blue-600",   bg: "bg-blue-50",    label: "Reviewed"     },
  return:      { icon: "undo",         color: "text-amber-600",  bg: "bg-amber-50",   label: "Returned"     },
  acknowledge: { icon: "done_all",     color: "text-teal-600",   bg: "bg-teal-50",    label: "Acknowledged" },
};

const MORPH_SHORT: Record<string, string> = {
  "App\\Models\\TravelRequest":      "travel",
  "App\\Models\\LeaveRequest":       "leave",
  "App\\Models\\ImprestRequest":     "imprest",
  "App\\Models\\ProcurementRequest": "procurement",
  "App\\Models\\Correspondence":     "correspondence",
};

function RecentEventsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["saam", "my-events"],
    queryFn: () => saamApi.getMyEvents().then((r) => r.data.data),
    staleTime: 30_000,
  });

  const events: SignatureEvent[] = data ?? [];

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-primary text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            history
          </span>
          <h2 className="text-sm font-semibold text-neutral-900">Recent Signature Activity</h2>
        </div>
        <Link
          href="/saam/verify"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
        >
          Verify document
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="px-5 py-4 space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-100 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-neutral-100 rounded w-2/3" />
                <div className="h-3 bg-neutral-100 rounded w-1/3" />
              </div>
              <div className="h-5 w-16 bg-neutral-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <span
            className="material-symbols-outlined text-neutral-300 text-[36px] mb-2 block"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            history_toggle_off
          </span>
          <p className="text-sm text-neutral-400">No signature activity yet.</p>
          <p className="text-xs text-neutral-400 mt-1">
            Your signing history will appear here after you sign your first document.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-50">
          {events.map((evt) => {
            const cfg       = ACTION_CONFIG[evt.action] ?? ACTION_CONFIG.acknowledge;
            const shortType = MORPH_SHORT[evt.signable_type] ?? "document";
            const modLabel  = moduleLabel(evt.signable_type);
            return (
              <div key={evt.id} className="px-5 py-3 flex items-center gap-3 hover:bg-neutral-50/50 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                  <span
                    className={`material-symbols-outlined text-[16px] ${cfg.color}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {cfg.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-800 truncate">
                    {cfg.label} · <span className="text-neutral-500">{modLabel} #{evt.signable_id}</span>
                    {evt.is_delegated && (
                      <span className="ml-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                        Delegated
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {evt.step_key ? `Step: ${evt.step_key} · ` : ""}
                    {new Date(evt.signed_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <Link
                  href={`/saam/verify/${shortType}/${evt.signable_id}`}
                  className="flex-shrink-0 text-[11px] text-primary font-semibold hover:underline"
                >
                  Verify
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Delegation Summary ───────────────────────────────────────────────────────

function DelegationSummaryCard({
  outgoing,
  incoming,
  loading,
}: {
  outgoing: DelegatedAuthority[];
  incoming: DelegatedAuthority[];
  loading: boolean;
}) {
  const activeOut = outgoing.filter(isActiveDelegation);
  const activeIn = incoming.filter(isActiveDelegation);

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-primary text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            manage_accounts
          </span>
          <h2 className="text-sm font-semibold text-neutral-900">Delegation Summary</h2>
        </div>
        <Link
          href="/saam/delegations"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
        >
          Manage all
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>

      {loading ? (
        <div className="p-5 grid grid-cols-2 gap-4 animate-pulse">
          <div className="h-20 bg-neutral-100 rounded-xl" />
          <div className="h-20 bg-neutral-100 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="p-5 grid grid-cols-2 gap-4">
            {/* Outgoing */}
            <div
              className={`rounded-xl border px-4 py-3 ${
                activeOut.length > 0
                  ? "border-amber-200 bg-amber-50"
                  : "border-neutral-100 bg-neutral-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`material-symbols-outlined text-[16px] ${
                    activeOut.length > 0 ? "text-amber-600" : "text-neutral-400"
                  }`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  arrow_outward
                </span>
                <span className="text-xs font-semibold text-neutral-600">Delegated Out</span>
              </div>
              <p
                className={`text-2xl font-bold ${
                  activeOut.length > 0 ? "text-amber-700" : "text-neutral-400"
                }`}
              >
                {activeOut.length}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {outgoing.length} total · {activeOut.length} active
              </p>
            </div>

            {/* Incoming */}
            <div
              className={`rounded-xl border px-4 py-3 ${
                activeIn.length > 0
                  ? "border-green-200 bg-green-50"
                  : "border-neutral-100 bg-neutral-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`material-symbols-outlined text-[16px] ${
                    activeIn.length > 0 ? "text-green-600" : "text-neutral-400"
                  }`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  south_west
                </span>
                <span className="text-xs font-semibold text-neutral-600">Delegated to Me</span>
              </div>
              <p
                className={`text-2xl font-bold ${
                  activeIn.length > 0 ? "text-green-700" : "text-neutral-400"
                }`}
              >
                {activeIn.length}
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {incoming.length} total · {activeIn.length} active
              </p>
            </div>
          </div>

          {/* Active outgoing list */}
          {activeOut.length > 0 && (
            <div className="border-t border-neutral-100">
              <p className="px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Currently delegated to
              </p>
              <div className="divide-y divide-neutral-100">
                {activeOut.slice(0, 3).map((d) => (
                  <div key={d.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-amber-700">
                        {d.delegate?.name?.slice(0, 1)?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-800 truncate">
                        {d.delegate?.name ?? `User #${d.delegate_user_id}`}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        Until {formatDate(d.end_date)}
                        {d.role_scope && (
                          <> · <span className="font-mono text-[10px]">{d.role_scope}</span></>
                        )}
                      </p>
                    </div>
                    <span className="badge-warning text-[10px]">Active</span>
                  </div>
                ))}
                {activeOut.length > 3 && (
                  <div className="px-5 py-2">
                    <Link
                      href="/saam/delegations"
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      +{activeOut.length - 3} more
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active incoming list */}
          {activeIn.length > 0 && (
            <div className="border-t border-neutral-100">
              <p className="px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Authority granted from
              </p>
              <div className="divide-y divide-neutral-100">
                {activeIn.slice(0, 3).map((d) => (
                  <div key={d.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-green-700">
                        {d.principal?.name?.slice(0, 1)?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-800 truncate">
                        {d.principal?.name ?? `User #${d.principal_user_id}`}
                      </p>
                      <p className="text-[11px] text-neutral-400">Until {formatDate(d.end_date)}</p>
                    </div>
                    <span className="badge-success text-[10px]">Active</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeOut.length === 0 && activeIn.length === 0 && (
            <p className="px-5 pb-5 text-xs text-neutral-400 text-center">
              No active delegations.{" "}
              <Link href="/saam/delegations" className="text-primary font-semibold hover:underline">
                Create one
              </Link>{" "}
              if you will be unavailable.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SaamPage() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Data fetching ──
  const {
    data: profileData,
    isLoading: profileLoading,
    isError: profileError,
  } = useQuery({
    queryKey: ["saam", "profile"],
    queryFn: () => saamApi.getProfile().then((r) => r.data.data),
    staleTime: 30_000,
  });

  const {
    data: delegationData,
    isLoading: delegationLoading,
  } = useQuery({
    queryKey: ["saam", "delegations"],
    queryFn: () => saamApi.listDelegations().then((r) => r.data.data),
    staleTime: 30_000,
  });

  const profiles = profileData ?? [];
  const outgoing = delegationData?.outgoing ?? [];
  const incoming = delegationData?.incoming ?? [];

  const activeProfiles = profiles.filter((p) => p.status === "active");
  const activeDelegations = [...outgoing, ...incoming].filter(isActiveDelegation);

  // ── Revoke mutation ──
  const revokeMutation = useMutation({
    mutationFn: (type: "full" | "initials") => saamApi.revoke(type),
    onSuccess: (_, type) => {
      showToast(`${sigTypeLabel(type)} revoked successfully.`);
      queryClient.invalidateQueries({ queryKey: ["saam", "profile"] });
    },
    onError: () => showToast("Failed to revoke signature. Please try again.", "error"),
  });

  return (
    <div className="max-w-5xl space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg transition-all ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.message}
        </div>
      )}

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-2">
            <span>Home</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span className="text-neutral-600 font-medium">SAAM</span>
          </div>
          <h1 className="page-title">Signatures &amp; Authority</h1>
          <p className="page-subtitle">
            Manage your digital signatures and delegate signing authority to colleagues.
          </p>
        </div>
        <Link href="/saam/delegations" className="btn-secondary text-sm flex-shrink-0">
          <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
          Delegations
        </Link>
      </div>

      {/* Error banner */}
      {profileError && (
        <div className="card px-5 py-4 flex items-center gap-3 border-red-200 bg-red-50">
          <span
            className="material-symbols-outlined text-red-500 text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            error
          </span>
          <p className="text-sm text-red-700">
            Unable to load signature profile. Check your connection and try refreshing.
          </p>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon="verified"
          label="Active Signatures"
          value={activeProfiles.length}
          color="bg-primary/10 text-primary"
          loading={profileLoading}
        />
        <StatCard
          icon="supervisor_account"
          label="Active Delegations"
          value={activeDelegations.length}
          color="bg-amber-100 text-amber-600"
          loading={delegationLoading}
        />
        <StatCard
          icon="pending_actions"
          label="Pending Documents"
          value={0}
          color="bg-neutral-100 text-neutral-500"
          loading={false}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Signature Profile (wider) */}
        <div className="lg:col-span-2 space-y-6">
          <SignatureProfileCard
            profiles={profiles}
            loading={profileLoading}
            onRevoke={(type) => revokeMutation.mutate(type)}
          />
          <RecentEventsCard />
        </div>

        {/* Right: Delegation Summary */}
        <div className="lg:col-span-1">
          <DelegationSummaryCard
            outgoing={outgoing}
            incoming={incoming}
            loading={delegationLoading}
          />
        </div>
      </div>

      {/* Quick Actions footer strip */}
      <div className="card px-5 py-4">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              icon: "gesture",
              label: "Draw Signature",
              href: "/saam/verify/draw",
              color: "text-primary bg-primary/10",
            },
            {
              icon: "upload",
              label: "Upload Signature",
              href: "/saam/verify/upload",
              color: "text-indigo-600 bg-indigo-50",
            },
            {
              icon: "add_circle",
              label: "New Delegation",
              href: "/saam/delegations",
              color: "text-amber-600 bg-amber-50",
            },
            {
              icon: "history",
              label: "View Delegations",
              href: "/saam/delegations",
              color: "text-neutral-600 bg-neutral-100",
            },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 rounded-xl border border-neutral-100 px-4 py-3 hover:border-primary/30 hover:bg-neutral-50 transition-colors group"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${action.color}`}
              >
                <span
                  className="material-symbols-outlined text-[17px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {action.icon}
                </span>
              </div>
              <span className="text-xs font-medium text-neutral-700 group-hover:text-neutral-900 transition-colors">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
