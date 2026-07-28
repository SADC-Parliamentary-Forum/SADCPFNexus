"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { correspondenceApi, type CorrespondenceLetter } from "@/lib/api";

export default function MasterRegisterPage() {
  const [items, setItems] = useState<CorrespondenceLetter[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    correspondenceApi
      .masterRegister({ per_page: 50, ...(search ? { search } : {}) })
      .then((res) => setItems(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="page-title">Master Register</h1>
        <p className="page-subtitle">Chronological institutional register — one authoritative document per entry, linked to subject files.</p>
      </div>

      <input
        className="form-input max-w-md"
        placeholder="Search reference, subject, sender…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">Loading…</td></tr>}
            {!loading && items.map((item) => (
              <tr key={item.id} className="border-t border-neutral-100">
                <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                  {(item.received_at || item.approved_at || item.created_at || "").slice(0, 10)}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/correspondence/${item.id}`} className="text-primary hover:underline">
                    {item.registry_reference || item.reference_number || `#${item.id}`}
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize">{item.direction}</td>
                <td className="px-4 py-3">{item.subject}</td>
                <td className="px-4 py-3">{item.primary_owner?.name || "—"}</td>
                <td className="px-4 py-3"><span className="badge-muted">{item.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
