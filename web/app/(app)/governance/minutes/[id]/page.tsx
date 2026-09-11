"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { minutesApi, type MeetingMinutesRecord } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";

function names(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export default function MinutesDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const [itemDesc, setItemDesc] = useState("");
  const [itemDeadline, setItemDeadline] = useState("");
  const [itemResponsible, setItemResponsible] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["governance", "minutes", id],
    queryFn: async () => {
      const res = await minutesApi.get(id);
      return res.data as MeetingMinutesRecord;
    },
    enabled: Number.isFinite(id),
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["governance", "minutes", id] });
    qc.invalidateQueries({ queryKey: ["governance", "minutes"] });
  }

  const finalise = useMutation({
    mutationFn: () => minutesApi.update(id, { status: "final" }),
    onSuccess: () => {
      setMsg("Minutes marked final.");
      setErr(null);
      refresh();
    },
    onError: (e: unknown) => setErr(apiErrorMessage(e, "Could not finalise minutes.")),
  });

  async function addActionItem(e: FormEvent) {
    e.preventDefault();
    if (!itemDesc.trim()) return;
    setErr(null);
    setMsg(null);
    try {
      await minutesApi.addActionItem(id, {
        description: itemDesc.trim(),
        responsible_name: itemResponsible.trim() || undefined,
        deadline: itemDeadline || undefined,
      });
      setItemDesc("");
      setItemDeadline("");
      setItemResponsible("");
      setMsg("Action item added.");
      refresh();
    } catch (e) {
      setErr(apiErrorMessage(e, "Could not add action item."));
    }
  }

  async function downloadAttachment(att: { id: number; original_filename: string }) {
    try {
      const res = await api.get(`/governance/minutes/${id}/documents/${att.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.original_filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(apiErrorMessage(e, "Could not download document."));
    }
  }

  if (isLoading) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <div className="h-10 w-72 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="w-full min-w-0 space-y-5">
        <ModulePageHeader
          title="Meeting minutes"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "Meetings & Minutes", href: "/governance" }, { label: "Not found" }]} />}
        />
        <div className="card overflow-hidden">
          <EmptyState icon="error" title="Minutes not found" description="The record may have been removed or you may not have access." />
        </div>
      </div>
    );
  }

  const attendees = names(data.attendees);
  const apologies = names(data.apologies);
  const actionItems = data.action_items ?? [];
  const attachments = data.attachments ?? [];

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={data.title}
        subtitle={`${data.meeting_type || "Meeting"} · ${data.status === "final" ? "Final" : "Draft"}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Meetings & Minutes", href: "/governance" },
              { label: data.title },
            ]}
          />
        }
        meta={
          <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <span>Date: {data.meeting_date ? formatDateShort(data.meeting_date) : "—"}</span>
            <span>Venue: {data.location || "—"}</span>
            <span>Chair: {data.chairperson || "—"}</span>
          </div>
        }
        actions={
          <>
            {data.status === "draft" ? (
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={finalise.isPending}
                onClick={() => finalise.mutate()}
              >
                {finalise.isPending ? "Finalising…" : "Mark final"}
              </button>
            ) : null}
            <Link href={`/decisions/create?minutes=${data.id}`} className="btn-primary text-sm">
              New decision
            </Link>
          </>
        }
      />

      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <FormSection title="Attendance" icon="groups">
        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Attendees</p>
            {attendees.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-800 dark:text-neutral-200">
                {attendees.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-neutral-500">None recorded.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Apologies</p>
            {apologies.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-800 dark:text-neutral-200">
                {apologies.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-neutral-500">None recorded.</p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title="Notes" icon="description">
        {data.notes ? (
          <p className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">{data.notes}</p>
        ) : (
          <p className="text-sm text-neutral-500">No notes recorded yet.</p>
        )}
      </FormSection>

      <FormSection title="Action items" icon="task_alt">
        <ul className="space-y-2">
          {actionItems.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
              <div>
                <div className="font-medium">{item.description}</div>
                <div className="text-xs text-neutral-500">
                  {item.status}
                  {item.responsible?.name || item.responsible_name ? ` · ${item.responsible?.name ?? item.responsible_name}` : ""}
                  {item.deadline ? ` · due ${formatDateShort(item.deadline)}` : ""}
                  {item.assignment ? ` · ${item.assignment.reference_number}` : ""}
                </div>
              </div>
            </li>
          ))}
          {actionItems.length === 0 ? <li className="text-sm text-neutral-500">No action items yet.</li> : null}
        </ul>
        <form onSubmit={addActionItem} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Description" htmlFor="minutes-action-desc" className="sm:col-span-2">
            <input
              id="minutes-action-desc"
              className="form-input"
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
              placeholder="Follow-up task"
            />
          </FormField>
          <FormField label="Responsible" htmlFor="minutes-action-who">
            <input
              id="minutes-action-who"
              className="form-input"
              value={itemResponsible}
              onChange={(e) => setItemResponsible(e.target.value)}
              placeholder="Name"
            />
          </FormField>
          <FormField label="Deadline" htmlFor="minutes-action-due">
            <input
              id="minutes-action-due"
              type="date"
              className="form-input"
              value={itemDeadline}
              onChange={(e) => setItemDeadline(e.target.value)}
            />
          </FormField>
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" className="btn-secondary" disabled={!itemDesc.trim()}>
              Add action item
            </button>
          </div>
        </form>
      </FormSection>

      <FormSection title="Documents" icon="attach_file">
        {attachments.length ? (
          <ul className="space-y-2">
            {attachments.map((att) => (
              <li key={att.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{att.original_filename}</span>
                <button type="button" className="text-primary hover:underline" onClick={() => void downloadAttachment(att)}>
                  Download
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No documents attached.</p>
        )}
      </FormSection>
    </div>
  );
}
