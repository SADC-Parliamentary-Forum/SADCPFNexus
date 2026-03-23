"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocumentSource = "travel" | "leave" | "imprest" | "appraisal" | "other";

interface AggregatedDocument {
  id: number;
  filename: string;
  source: DocumentSource;
  source_label: string;
  reference?: string;
  uploaded_at: string;
  size_bytes: number | null;
  mime_type: string | null;
  download_url: string | null;
}

type FilterTab = "all" | DocumentSource;

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "travel",    label: "Travel" },
  { key: "leave",     label: "Leave" },
  { key: "imprest",   label: "Imprest" },
  { key: "appraisal", label: "Appraisals" },
  { key: "other",     label: "Other" },
];

const SOURCE_ICON: Record<DocumentSource, string> = {
  travel:    "flight",
  leave:     "beach_access",
  imprest:   "payments",
  appraisal: "assessment",
  other:     "attach_file",
};

const SOURCE_COLOR: Record<DocumentSource, string> = {
  travel:    "bg-blue-50 text-blue-600",
  leave:     "bg-green-50 text-green-600",
  imprest:   "bg-amber-50 text-amber-600",
  appraisal: "bg-purple-50 text-purple-600",
  other:     "bg-neutral-100 text-neutral-500",
};

interface ModuleSection {
  source: DocumentSource;
  title: string;
  description: string;
  href: string;
  icon: string;
  iconColor: string;
}

const MODULE_SECTIONS: ModuleSection[] = [
  {
    source:      "travel",
    title:       "Travel Attachments",
    description: "Tickets, itineraries, hotel bookings and mission receipts attached to your travel requests.",
    href:        "/travel",
    icon:        "flight",
    iconColor:   "bg-blue-50 text-blue-600",
  },
  {
    source:      "leave",
    title:       "Leave Documents",
    description: "Medical certificates and supporting documents submitted with your leave applications.",
    href:        "/leave",
    icon:        "beach_access",
    iconColor:   "bg-green-50 text-green-600",
  },
  {
    source:      "imprest",
    title:       "Imprest Receipts",
    description: "Receipts, invoices and liquidation documents attached to your imprest requests.",
    href:        "/imprest",
    icon:        "payments",
    iconColor:   "bg-amber-50 text-amber-600",
  },
  {
    source:      "other",
    title:       "HR Personal File",
    description: "Contracts, appointment letters, qualifications and other HR-managed documents.",
    href:        "/hr/files",
    icon:        "folder_shared",
    iconColor:   "bg-rose-50 text-rose-600",
  },
  {
    source:      "appraisal",
    title:       "Appraisal Records",
    description: "Evidence files, KRA documents and supporting materials from your performance appraisals.",
    href:        "/hr/appraisals",
    icon:        "assessment",
    iconColor:   "bg-purple-50 text-purple-600",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeIcon(mime: string | null): string {
  if (!mime) return "insert_drive_file";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "picture_as_pdf";
  if (mime.includes("word") || mime.includes("document")) return "description";
  if (mime.includes("excel") || mime.includes("spreadsheet")) return "table_chart";
  if (mime.includes("zip") || mime.includes("compressed")) return "folder_zip";
  return "insert_drive_file";
}

// ─── Fallback UI ─────────────────────────────────────────────────────────────

function ModuleFallback() {
  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="card p-5 flex items-start gap-4 border-blue-100 bg-blue-50/40">
        <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-[20px] text-blue-600">info</span>
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-800">Documents are stored per module</p>
          <p className="text-sm text-neutral-500 mt-0.5">
            There is no single aggregated document endpoint yet. Your files are accessible directly
            from each module. Use the shortcuts below to navigate there.
          </p>
        </div>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULE_SECTIONS.map((section) => (
          <div key={section.source} className="card p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0", section.iconColor)}>
                <span className="material-symbols-outlined text-[22px]">{section.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-neutral-800 text-sm leading-snug">{section.title}</h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{section.description}</p>
              </div>
            </div>
            <div className="mt-auto pt-2 border-t border-neutral-100">
              <Link
                href={section.href}
                className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 w-full justify-center"
              >
                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                View {section.title}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HrDocumentsPage() {
  const [documents, setDocuments] = useState<AggregatedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api
      .get<{ data: AggregatedDocument[] }>("/hr/documents")
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        setDocuments(rows);
        setApiAvailable(true);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        // 404 = endpoint doesn't exist yet → show fallback gracefully
        // other errors → also show fallback but we could differentiate if needed
        setApiAvailable(status !== 404 ? false : null);
        setDocuments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let rows = documents;

    if (activeTab !== "all") {
      rows = rows.filter((d) => d.source === activeTab);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (d) =>
          d.filename.toLowerCase().includes(q) ||
          d.source_label.toLowerCase().includes(q) ||
          (d.reference ?? "").toLowerCase().includes(q)
      );
    }

    return rows;
  }, [documents, activeTab, search]);

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<FilterTab, number>> = { all: documents.length };
    for (const doc of documents) {
      counts[doc.source] = (counts[doc.source] ?? 0) + 1;
    }
    return counts;
  }, [documents]);

  // ── Skeleton loading ──
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <SkeletonPage />
      </div>
    );
  }

  // ── API returned a real server error (not 404) ──
  const showError = apiAvailable === false;

  // ── Show fallback when endpoint is absent (404 / null) or truly no documents ──
  const showFallback = apiAvailable === null || (apiAvailable && documents.length === 0);

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-neutral-400">
        <Link href="/hr" className="hover:text-neutral-600">HR</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-700 font-medium">Documents</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">My Documents</h1>
          <p className="page-subtitle">All files and attachments across your requests and records</p>
        </div>
        {apiAvailable && documents.length > 0 && (
          <span className="badge badge-muted self-start mt-1">
            {documents.length} file{documents.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Error state */}
      {showError && (
        <div className="card p-10 text-center text-neutral-500">
          <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-[28px] text-red-500">error_outline</span>
          </div>
          <p className="font-medium text-neutral-700">Failed to load documents</p>
          <p className="text-sm mt-1">There was a problem reaching the documents API. Please try again later.</p>
          <button
            className="btn-secondary mt-4 inline-flex items-center gap-2"
            onClick={() => window.location.reload()}
          >
            <span className="material-symbols-outlined text-[17px]">refresh</span>
            Retry
          </button>
        </div>
      )}

      {/* Fallback UI (no endpoint or no documents) */}
      {!showError && showFallback && <ModuleFallback />}

      {/* Functional table UI */}
      {!showError && !showFallback && (
        <>
          {/* Controls row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                className="form-input pl-9"
                placeholder="Search by filename…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  onClick={() => setSearch("")}
                >
                  <span className="material-symbols-outlined text-[17px]">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                className={cn("filter-tab", activeTab === tab.key && "active")}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {(tabCounts[tab.key] ?? 0) > 0 && (
                  <span
                    className={cn(
                      "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                      activeTab === tab.key
                        ? "bg-white/20 text-white"
                        : "bg-neutral-100 text-neutral-500"
                    )}
                  >
                    {tabCounts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-neutral-400">
                <span className="material-symbols-outlined text-5xl block mb-2">search_off</span>
                <p className="font-medium">No documents found</p>
                <p className="text-sm mt-1">
                  {search ? "Try a different search term or clear the filter." : "No documents in this category."}
                </p>
                {search && (
                  <button className="btn-secondary mt-4" onClick={() => setSearch("")}>
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Source</th>
                      <th>Reference</th>
                      <th>Uploaded</th>
                      <th>Size</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((doc) => (
                      <tr key={`${doc.source}-${doc.id}`}>
                        {/* Filename */}
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-[17px] text-neutral-500">
                                {getMimeIcon(doc.mime_type)}
                              </span>
                            </div>
                            <span
                              className="font-medium text-neutral-800 text-sm max-w-[240px] truncate block"
                              title={doc.filename}
                            >
                              {doc.filename}
                            </span>
                          </div>
                        </td>

                        {/* Source badge */}
                        <td>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                              SOURCE_COLOR[doc.source]
                            )}
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {SOURCE_ICON[doc.source]}
                            </span>
                            {doc.source_label}
                          </span>
                        </td>

                        {/* Reference */}
                        <td>
                          <span className="text-xs text-neutral-500 font-mono">
                            {doc.reference ?? "—"}
                          </span>
                        </td>

                        {/* Uploaded date */}
                        <td>
                          <span className="text-sm text-neutral-600">
                            {formatDateShort(doc.uploaded_at)}
                          </span>
                        </td>

                        {/* Size */}
                        <td>
                          <span className="text-sm text-neutral-500">
                            {formatFileSize(doc.size_bytes)}
                          </span>
                        </td>

                        {/* Download */}
                        <td className="text-right">
                          {doc.download_url ? (
                            <button
                              className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1.5"
                              onClick={() => window.open(doc.download_url!, "_blank")}
                              title={`Download ${doc.filename}`}
                            >
                              <span className="material-symbols-outlined text-[15px]">download</span>
                              Download
                            </button>
                          ) : (
                            <span className="text-xs text-neutral-300">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Result count footer */}
          {filtered.length > 0 && (
            <p className="text-xs text-neutral-400 text-right">
              Showing {filtered.length} of {documents.length} document{documents.length !== 1 ? "s" : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonPage() {
  return (
    <>
      {/* Breadcrumb */}
      <div className="h-4 w-32 bg-neutral-100 rounded animate-pulse" />

      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-neutral-100 rounded animate-pulse" />
        <div className="h-4 w-80 bg-neutral-100 rounded animate-pulse" />
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <div className="h-9 w-56 bg-neutral-100 rounded-lg animate-pulse" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-16 bg-neutral-100 rounded-full animate-pulse" />
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="divide-y divide-neutral-50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-8 w-8 bg-neutral-100 rounded-lg animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-neutral-100 rounded animate-pulse w-3/5" />
                <div className="h-3 bg-neutral-100 rounded animate-pulse w-2/5" />
              </div>
              <div className="h-6 w-20 bg-neutral-100 rounded-full animate-pulse" />
              <div className="h-3.5 w-24 bg-neutral-100 rounded animate-pulse" />
              <div className="h-3.5 w-16 bg-neutral-100 rounded animate-pulse" />
              <div className="h-7 w-24 bg-neutral-100 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
