"use client";

import React from "react";
import Link from "next/link";

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">People &amp; Authority</p>
        <h1 className="text-2xl font-semibold text-neutral-900">People Settings</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Phase 2/3 integrations are env-gated. Operator credential status lives under Admin → System Settings.
        </p>
      </div>
      <ul className="space-y-2 text-sm">
        <li><Link className="underline" href="/people/m365">M365 / directory sync</Link></li>
        <li><Link className="underline" href="/people/esign">External e-sign</Link></li>
        <li><Link className="underline" href="/people/recertification">Role recertification</Link></li>
        <li><Link className="underline" href="/people/sod">SoD analysis</Link></li>
        <li><Link className="underline" href="/people/scenarios">Org scenarios</Link></li>
        <li><Link className="underline" href="/people/succession">Succession</Link></li>
        <li><Link className="underline" href="/people/skills">Skills directory</Link></li>
        <li><Link className="underline" href="/people/analytics">Analytics</Link></li>
        <li><Link className="underline" href="/people/ai">AI assist (never auto-grant)</Link></li>
        <li><Link className="underline" href="/admin/settings">Operator credentials</Link></li>
        <li><Link className="underline" href="/verify-signature">Public signature verification</Link></li>
      </ul>
    </div>
  );
}
