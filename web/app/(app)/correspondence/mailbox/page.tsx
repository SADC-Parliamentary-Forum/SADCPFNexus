"use client";

import Link from "next/link";

export default function CorrespondenceMailboxStubPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="page-title">Registry Mailbox</h1>
      <p className="page-subtitle">Phase 2 — designated registry mailbox integration (not auto-ingest of all employee email).</p>
      <div className="card p-6 text-sm text-neutral-600 space-y-2">
        <p>Official email registration suggestions and courier tracking land in Phase 2 per PRD §145.</p>
        <p>Phase 1 uses Registry capture for official incoming mail.</p>
        <Link href="/correspondence/incoming" className="text-primary hover:underline">Register incoming mail →</Link>
      </div>
    </div>
  );
}
