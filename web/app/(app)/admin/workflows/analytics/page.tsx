"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { workflowEngineApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { ObjectSummary } from "@/components/ui/ObjectSummary";

export default function WorkflowAnalyticsPage() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    workflowEngineApi
      .analytics()
      .then((res) => setData(res.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ModulePageHeader
        title="Workflow Analytics"
        subtitle="Cycle time, bottlenecks, overdue work, return rates, delegation usage, and exceptions."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Workflows", href: "/admin/workflows" },
              { label: "Analytics" },
            ]}
          />
        }
        actions={
          <Link href="/admin/workflows" className="btn-secondary text-sm">
            Back to workflows
          </Link>
        }
      />

      <FormSection title="Analytics snapshot" icon="analytics">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : (
          <ObjectSummary value={data} />
        )}
      </FormSection>
    </div>
  );
}
