"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tendersApi } from "@/lib/api";

export default function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tenderId = Number(id);
  const qc = useQueryClient();

  const { data: tender, isLoading } = useQuery({
    queryKey: ["procurement", "tender", tenderId],
    queryFn: () => tendersApi.get(tenderId).then((r) => r.data.data),
    enabled: !!tenderId,
  });

  const act = useMutation({
    mutationFn: (action: "publish" | "close" | "openBids" | "startEvaluation") => {
      if (action === "publish") return tendersApi.publish(tenderId);
      if (action === "close") return tendersApi.close(tenderId);
      if (action === "openBids") return tendersApi.openBids(tenderId);
      return tendersApi.startEvaluation(tenderId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement", "tender", tenderId] }),
  });

  if (isLoading || !tender) {
    return <div className="card p-8 text-center text-sm text-neutral-400">Loading…</div>;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href="/procurement/tenders" className="text-sm text-neutral-500 hover:text-neutral-800">← Tenders</Link>
      <div className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{tender.reference_number}</h1>
            <p className="text-sm text-neutral-600">{tender.title}</p>
          </div>
          <span className="text-xs uppercase text-neutral-600">{tender.status}</span>
        </div>
        {tender.notice && <p className="text-sm text-neutral-700 whitespace-pre-wrap">{tender.notice}</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          {tender.status === "draft" && (
            <button type="button" className="btn-primary text-sm" onClick={() => act.mutate("publish")}>Publish</button>
          )}
          {tender.status === "published" && (
            <button type="button" className="btn-secondary text-sm" onClick={() => act.mutate("close")}>Close submissions</button>
          )}
          {tender.status === "closed" && (
            <button type="button" className="btn-primary text-sm" onClick={() => act.mutate("openBids")}>Open bids</button>
          )}
          {tender.status === "opened" && (
            <button type="button" className="btn-primary text-sm" onClick={() => act.mutate("startEvaluation")}>Start evaluation</button>
          )}
        </div>
      </div>
    </div>
  );
}
