"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { correspondenceApi, type CorrespondenceLetter } from "@/lib/api";

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:              { label: "Draft",           cls: "badge-muted"    },
  pending_review:     { label: "Pending Review",  cls: "badge-warning"  },
  pending_approval:   { label: "Pending Approval",cls: "badge-warning"  },
  approved:           { label: "Approved",        cls: "badge-success"  },
  sent:               { label: "Sent",            cls: "badge-success"  },
  archived:           { label: "Archived",        cls: "badge-muted"    },
};

const typeLabel: Record<string, string> = {
  internal_memo:   "Internal Memo",
  external:        "External",
  diplomatic_note: "Diplomatic Note",
  procurement:     "Procurement",
};

export default function CorrespondencePage() {
  const [letters, setLetters] = useState<CorrespondenceLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    correspondenceApi
      .list({ per_page: 10 })
      .then((res) => setLetters(res.data.data ?? []))
      .catch(() => setError("Failed to load correspondence."))
      .finally(() => setLoading(false));
  }, []);

  const drafts = letters.filter((l) => l.status === "draft").length;
  const pendingReview = letters.filter((l) => l.status === "pending_review").length;
  const pendingApproval = letters.filter((l) => l.status === "pending_approval").length;
  const sent = letters.filter((l) => l.status === "sent").length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Correspondence</h1>
        <p className="page-subtitle">Manage outgoing and incoming institutional correspondence.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Drafts",           value: drafts,          icon: "draft",         color: "text-neutral-500", bg: "bg-neutral-50"  },
          { label: "Pending Review",   value: pendingReview,   icon: "rate_review",   color: "text-amber-600",   bg: "bg-amber-50"    },
          { label: "Pending Approval", value: pendingApproval, icon: "approval",      color: "text-orange-600",  bg: "bg-orange-50"   },
          { label: "Sent",             value: sent,            icon: "send",          color: "text-green-600",   bg: "bg-green-50"    },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">{s.label}</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">
                  {loading ? <span className="inline-block h-7 w-8 animate-pulse rounded bg-neutral-100" /> : s.value}
                </p>
              </div>
              <div className={`h-11 w-11 rounded-xl ${s.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${s.color} text-[22px]`}>{s.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/correspondence/create" className="btn-primary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">edit_square</span>
          New Letter
        </Link>
        <Link href="/correspondence/registry" className="btn-secondary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">inventory_2</span>
          View Registry
        </Link>
        <Link href="/correspondence/contacts" className="btn-secondary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">contacts</span>
          Manage Contacts
        </Link>
      </div>

      {/* Recent letters */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">mark_email_read</span>
            <h3 className="text-sm font-semibold text-neutral-900">Recent Correspondence</h3>
          </div>
          <Link href="/correspondence/registry" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
            View all
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-neutral-400">Loading…</div>
        ) : letters.length > 0 ? (
          <div className="divide-y divide-neutral-50">
            {letters.map((letter) => {
              const s = statusConfig[letter.status] ?? { label: letter.status, cls: "badge-muted" };
              return (
                <Link
                  key={letter.id}
                  href={`/correspondence/${letter.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-sky-600 text-[20px]">description</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">
                        {letter.reference_number ?? letter.title}
                      </p>
                      <p className="text-xs text-neutral-400 truncate">
                        {letter.subject} · {typeLabel[letter.type] ?? letter.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                    <p className="text-xs text-neutral-400">
                      {new Date(letter.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-200">mark_email_read</span>
            <p className="mt-3 text-sm text-neutral-400">No correspondence yet.</p>
            <Link href="/correspondence/create" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
              <span className="material-symbols-outlined text-[14px]">add</span>
              Create your first letter
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
