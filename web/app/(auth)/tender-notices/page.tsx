"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { formatDateShort } from "@/lib/utils";

type Notice = {
  reference_number: string;
  title: string;
  notice?: string | null;
  status: string;
  published_at?: string | null;
  submission_deadline?: string | null;
  sealed_mode?: boolean;
};

export default function PublicTenderNoticesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public", "tender-notices"],
    queryFn: async () => {
      const res = await axios.get<{ data: Notice[] }>("/api/procurement/notices");
      return res.data.data;
    },
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">SADC Parliamentary Forum</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Public Tender Notices</h1>
          <p className="text-sm text-neutral-600">
            Open advertisements for published tenders and RFQs. Bid amounts and competitor submissions are not published on this board.
          </p>
          <Link href="/login" className="text-sm text-neutral-500 underline">Staff sign in</Link>
        </header>

        {isError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Unable to load notices right now.
          </div>
        )}
        {isLoading && <div className="rounded-xl border border-neutral-200 bg-white px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>}

        <div className="space-y-3">
          {(data ?? []).map((n) => (
            <article key={n.reference_number} className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">{n.title}</h2>
                  <p className="text-xs font-mono text-neutral-500">{n.reference_number}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">{n.status}</span>
              </div>
              {n.notice && <p className="text-sm text-neutral-700 whitespace-pre-wrap">{n.notice}</p>}
              <p className="text-xs text-neutral-500">
                Submission deadline: {n.submission_deadline ? formatDateShort(n.submission_deadline) : "—"}
                {n.sealed_mode ? " · Sealed bids" : ""}
              </p>
            </article>
          ))}
          {!isLoading && (data?.length ?? 0) === 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white px-5 py-10 text-center text-sm text-neutral-400">
              No published notices at this time.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
