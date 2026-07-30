"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";

type NavItem = { label: string; href: string | null; children?: Array<{ label: string; href: string | null }> };

export default function MyWorkPage() {
  const [items, setItems] = useState<NavItem[]>([]);

  useEffect(() => {
    api.get<{ data: { items: NavItem[] } }>("/access/navigation").then((r) => r.data).then((res) => {
      const myWork = (res.data.items ?? []).find((i) => i.label === "My Work");
      setItems(myWork?.children ?? []);
    });
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">My Work</h1>
      <p className="text-sm text-[var(--muted-foreground)]">Feature-only tasks and assigned work generated from effective permissions.</p>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.label}>
            {c.href ? <Link className="underline" href={c.href}>{c.label}</Link> : c.label}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-[var(--muted-foreground)]">No assigned My Work features.</li>}
      </ul>
    </div>
  );
}
