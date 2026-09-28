"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const LIFECYCLE_BADGES: Record<string, string> = {
  DRAFT: "badge-muted",
  IN_REVIEW: "badge-warning",
  CHANGES_REQUESTED: "badge-warning",
  APPROVAL_PENDING: "badge-warning",
  APPROVED_FOR_SIGNATURE: "badge-primary",
  SENT_FOR_SIGNATURE: "badge-primary",
  PARTIALLY_SIGNED: "badge-primary",
  FULLY_EXECUTED: "badge-success",
  ACTIVE: "badge-success",
  COMPLETED: "badge-primary",
  CLOSING: "badge-muted",
  CLOSED: "badge-muted",
  REJECTED: "badge-danger",
  TERMINATED: "badge-danger",
  EXPIRED: "badge-danger",
  SUSPENDED: "badge-warning",
};

const SUBNAV = [
  { href: "/contracts", key: "contracts.dashboard", exact: true },
  { href: "/contracts/register", key: "contracts.register" },
  { href: "/contracts/analytics", key: "contracts.analytics" },
  { href: "/contracts/risk", key: "contracts.risk" },
  { href: "/contracts/reports", key: "contracts.reports" },
  { href: "/contracts/settings", key: "contracts.settings" },
] as const;

export function contractStatusKey(raw: string | null | undefined): string {
  return (raw ?? "DRAFT").replace(/\s+/g, "_").toUpperCase();
}

export function formatContractMoney(currency: string | null | undefined, value: number | string | null | undefined): string {
  const amount = Number(value || 0);
  const code = (currency || "NAD").trim() || "NAD";
  return `${code} ${amount.toLocaleString()}`;
}

export function ContractStatusBadge({ status }: { status: string | null | undefined }) {
  const { t } = useI18n();
  const key = contractStatusKey(status);
  const cls = LIFECYCLE_BADGES[key] ?? "badge-muted";
  const dotted = `contracts.status.${key}`;
  const lower = `contracts.status.${(status ?? "").toLowerCase()}`;
  const label = t(dotted) !== dotted
    ? t(dotted)
    : t(lower) !== lower
      ? t(lower)
      : key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function ContractSubNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="flex gap-1 overflow-x-auto pb-0.5" aria-label={t("contracts.title")}>
      {SUBNAV.map((item) => {
        const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`filter-tab whitespace-nowrap ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function ContractTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="overflow-x-auto border-b border-neutral-200" role="tablist">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => onChange(tab.id)}
            className={`whitespace-nowrap px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ContractMoreMenu({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-secondary text-sm"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {t("contracts.actions.more")}
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{open ? "expand_less" : "expand_more"}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 min-w-[13rem] rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
          <div className="flex flex-col" onClick={() => setOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export function contractMenuItemClass(danger = false): string {
  return `w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-neutral-50 ${danger ? "text-red-600" : "text-neutral-700"}`;
}

export function SettingsSectionNav({
  sections,
}: {
  sections: { id: string; label: string }[];
}) {
  const { t } = useI18n();
  return (
    <nav className="flex flex-wrap gap-2" aria-label={t("contracts.settings.sectionNav")}>
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="filter-tab">
          {s.label}
        </a>
      ))}
    </nav>
  );
}

export function ContractField({
  label,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-neutral-600">{label}</label>
      {children}
    </div>
  );
}

export function ContractTableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}
