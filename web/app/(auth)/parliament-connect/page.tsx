"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { formatDateShort } from "@/lib/utils";

type Resolution = {
  id: number;
  reference_number?: string;
  title: string;
  description?: string | null;
  status: string;
  adopted_at?: string | null;
  committee?: string | null;
};

type Notice = {
  reference_number: string;
  title: string;
  notice?: string | null;
  status: string;
  submission_deadline?: string | null;
};

type Feed = {
  title?: string;
  resolutions?: Resolution[];
  notices?: Notice[];
};

export default function ParliamentConnectPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public", "parliament-connect"],
    queryFn: async () => {
      const res = await axios.get<{ data: Feed }>("/api/v1/parliament-connect/feed");
      return res.data.data;
    },
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">SADC Parliamentary Forum</p>
          <h1 className="text-2xl font-semibold text-neutral-900">{data?.title ?? "Parliament Connect"}</h1>
          <p className="text-sm text-neutral-600">
            Public read-only feed of adopted resolutions and published tender notices. Admin remains the publishing control plane.
          </p>
          <div className="flex gap-4 text-sm">
            <Link href="/tender-notices" className="text-neutral-500 underline">Tender notices</Link>
            <Link href="/login" className="text-neutral-500 underline">Staff sign in</Link>
          </div>
        </header>

        {isError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Unable to load Parliament Connect right now.
          </div>
        )}
        {isLoading && <div className="rounded-xl border border-neutral-200 bg-white px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Resolutions</h2>
          {(data?.resolutions ?? []).map((r) => (
            <article key={r.id} className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">{r.title}</h3>
                  <p className="text-xs font-mono text-neutral-500">{r.reference_number}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">{r.status}</span>
              </div>
              {r.description && <p className="text-sm text-neutral-700 whitespace-pre-wrap">{r.description}</p>}
              <p className="text-xs text-neutral-500">
                Adopted: {r.adopted_at ? formatDateShort(r.adopted_at) : "—"}
                {r.committee ? ` · ${r.committee}` : ""}
              </p>
            </article>
          ))}
          {!isLoading && (data?.resolutions?.length ?? 0) === 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white px-5 py-8 text-center text-sm text-neutral-400">
              No published resolutions at this time.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Notices</h2>
          {(data?.notices ?? []).map((n) => (
            <article key={n.reference_number} className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
              <h3 className="text-base font-semibold text-neutral-900">{n.title}</h3>
              <p className="text-xs font-mono text-neutral-500">{n.reference_number}</p>
              {n.notice && <p className="text-sm text-neutral-700 whitespace-pre-wrap">{n.notice}</p>}
              <p className="text-xs text-neutral-500">
                Submission deadline: {n.submission_deadline ? formatDateShort(n.submission_deadline) : "—"}
              </p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
