"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { notificationTemplatesApi, type NotifTemplate } from "@/lib/api";

const VARS = [
  "{{name}}", "{{reference}}", "{{requester}}", "{{destination}}", "{{date}}",
  "{{start_date}}", "{{end_date}}", "{{leave_type}}", "{{amount}}", "{{due_date}}",
  "{{comment}}", "{{module}}", "{{description}}", "{{task_title}}",
];

const MODULE_GROUPS: { label: string; color: string; keys: string[] }[] = [
  { label: "Travel",      color: "bg-primary/10 text-primary",       keys: ["travel.submitted", "travel.approved", "travel.rejected"] },
  { label: "Leave",       color: "bg-green-50 text-green-700",       keys: ["leave.submitted", "leave.approved", "leave.rejected"] },
  { label: "Imprest",     color: "bg-amber-50 text-amber-700",       keys: ["imprest.submitted", "imprest.approved", "imprest.rejected", "imprest.retirement_due"] },
  { label: "Procurement", color: "bg-purple-50 text-purple-700",     keys: ["procurement.submitted", "procurement.approved", "procurement.rejected"] },
  { label: "Finance",     color: "bg-emerald-50 text-emerald-700",   keys: ["finance.advance_due", "budget.warning", "budget.exceeded"] },
  { label: "HR",          color: "bg-blue-50 text-blue-700",         keys: ["assignment.issued", "hr.task_assigned", "request.rejected"] },
];

export default function NotificationsPage() {
  const [templates, setTemplates]   = useState<NotifTemplate[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editKey, setEditKey]       = useState<string | null>(null);
  const [editForm, setEditForm]     = useState<Partial<NotifTemplate>>({});
  const [saving, setSaving]         = useState(false);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [preview, setPreview]       = useState<NotifTemplate | null>(null);
  const [toast, setToast]           = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    notificationTemplatesApi.list()
      .then(res => setTemplates(res.data))
      .catch(() => showToast("error", "Could not load templates."))
      .finally(() => setLoading(false));
  }, []);

  const templateMap = useMemo(() => Object.fromEntries(templates.map(t => [t.trigger_key, t])), [templates]);

  const startEdit = (t: NotifTemplate) => { setEditKey(t.trigger_key); setEditForm({ ...t }); setPreview(null); };
  const cancelEdit = () => { setEditKey(null); setEditForm({}); };

  const saveEdit = async () => {
    if (!editForm.trigger_key || !editForm.subject || !editForm.body) return;
    setSaving(true);
    try {
      await notificationTemplatesApi.update({
        trigger_key: editForm.trigger_key,
        subject: editForm.subject,
        body: editForm.body,
      });
      setTemplates(prev => prev.map(t =>
        t.trigger_key === editForm.trigger_key ? { ...t, subject: editForm.subject!, body: editForm.body!, customised: true } : t
      ));
      setEditKey(null);
      showToast("success", "Template saved.");
    } catch {
      showToast("error", "Failed to save template.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async (trigger_key: string) => {
    setTestingKey(trigger_key);
    try {
      const res = await notificationTemplatesApi.testSend({ trigger_key });
      showToast("success", res.data.message);
    } catch {
      showToast("error", "Failed to queue test email.");
    } finally {
      setTestingKey(null);
    }
  };

  const insertVar = (v: string) => {
    const ta = document.getElementById("template-body") as HTMLTextAreaElement | null;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const cur = editForm.body ?? "";
    const updated = cur.slice(0, s) + v + cur.slice(e);
    setEditForm(f => ({ ...f, body: updated }));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + v.length, s + v.length); }, 0);
  };

  // Live preview: replace placeholders with sample values
  const previewBody = useMemo(() => {
    if (!preview) return "";
    const samples: Record<string, string> = {
      name: "Jane Doe", reference: "TRV-DEMO001", requester: "John Smith",
      destination: "Windhoek, Namibia", date: "15 Apr 2026", start_date: "14 Apr 2026",
      end_date: "18 Apr 2026", leave_type: "Annual Leave", amount: "NAD 5,000.00",
      due_date: "30 Apr 2026", comment: "Additional justification required.", module: "Travel",
      description: "Review Q1 programme reports.", task_title: "Quarterly Report Review",
    };
    let body = preview.body;
    Object.entries(samples).forEach(([k, v]) => { body = body.replaceAll(`{{${k}}}`, v); });
    return body;
  }, [preview]);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb + header */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/admin" className="hover:text-primary transition-colors">Admin</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Notification Templates</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Notification Templates</h1>
          <p className="page-subtitle">Customise email and in-app notification content for each workflow event. Use <code className="text-xs bg-neutral-100 px-1 rounded">{"{{variable}}"}</code> placeholders for dynamic content.</p>
        </div>
        <Link href="/notifications" className="btn-secondary text-sm flex items-center gap-2 flex-shrink-0">
          <span className="material-symbols-outlined text-[18px]">inbox</span>
          My Notifications
        </Link>
      </div>

      {/* Variable reference */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-neutral-700 mb-2">Available Placeholder Variables</p>
        <div className="flex flex-wrap gap-1.5">
          {VARS.map(v => (
            <code key={v} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => editKey && insertVar(v)}>
              {v}
            </code>
          ))}
        </div>
        {editKey && <p className="text-[11px] text-neutral-400 mt-2">Click a variable to insert it at the cursor position in the body.</p>}
      </div>

      {/* Email preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">preview</span>
                <h3 className="text-sm font-semibold text-neutral-900">Email Preview — {preview.name}</h3>
              </div>
              <button onClick={() => setPreview(null)} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Simulated email */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden text-sm">
                <div className="bg-primary px-4 py-2.5 flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-white/20 flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold italic">SP</span>
                  </div>
                  <span className="text-white text-xs font-semibold">SADC-PF Nexus</span>
                </div>
                <div className="p-4 space-y-3 bg-white">
                  <div className="text-[11px] text-neutral-400 font-mono">
                    <span className="font-semibold text-neutral-600">Subject: </span>{preview.subject}
                  </div>
                  <div className="border-t border-neutral-100 pt-3">
                    <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wider">Notification</p>
                    <p className="text-sm font-bold text-neutral-900 mb-3">{preview.subject}</p>
                    <pre className="text-xs text-neutral-600 whitespace-pre-wrap leading-relaxed font-sans">{previewBody}</pre>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-neutral-400 text-center">Placeholders replaced with sample values for preview.</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-neutral-100 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {MODULE_GROUPS.map(group => {
            const groupTemplates = group.keys.map(k => templateMap[k]).filter(Boolean);
            if (groupTemplates.length === 0) return null;

            return (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${group.color}`}>{group.label}</span>
                  <span className="text-xs text-neutral-400">{groupTemplates.length} template{groupTemplates.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-3">
                  {groupTemplates.map(t => (
                    <div key={t.trigger_key} className="card p-5">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-neutral-900">{t.name}</h3>
                          <code className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded">{t.trigger_key}</code>
                          {t.customised && (
                            <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">Customised</span>
                          )}
                        </div>
                        {editKey !== t.trigger_key && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreview(t)}
                              className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 flex items-center gap-1"
                              title="Preview email"
                            >
                              <span className="material-symbols-outlined text-[14px]">preview</span>
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTestSend(t.trigger_key)}
                              disabled={testingKey === t.trigger_key}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 disabled:opacity-50"
                              title="Send test email to your address"
                            >
                              {testingKey === t.trigger_key
                                ? <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                : <span className="material-symbols-outlined text-[14px]">send</span>}
                              Test
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(t)}
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Edit form */}
                      {editKey === t.trigger_key ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-neutral-700 mb-1">Subject Line</label>
                            <input
                              className="form-input"
                              value={editForm.subject ?? t.subject}
                              onChange={e => setEditForm({ ...editForm, subject: e.target.value })}
                              placeholder="Email subject…"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-neutral-700 mb-1">Body</label>
                            <textarea
                              id="template-body"
                              rows={8}
                              className="form-input resize-none font-mono text-xs"
                              value={editForm.body ?? t.body}
                              onChange={e => setEditForm({ ...editForm, body: e.target.value })}
                              placeholder="Email body…"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={saving}
                              className="btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-60"
                            >
                              {saving && <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>}
                              Save Template
                            </button>
                            <button
                              type="button"
                              onClick={() => { setPreview({ ...t, subject: editForm.subject ?? t.subject, body: editForm.body ?? t.body }); }}
                              className="btn-secondary px-4 py-1.5 text-xs flex items-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[13px]">preview</span>
                              Preview
                            </button>
                            <button type="button" onClick={cancelEdit} className="btn-secondary px-4 py-1.5 text-xs">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs text-neutral-500 mb-2">
                            <span className="font-semibold text-neutral-700">Subject: </span>
                            {t.subject}
                          </p>
                          <pre className="text-xs text-neutral-400 bg-neutral-50 rounded-lg p-3 whitespace-pre-wrap font-sans leading-relaxed max-h-28 overflow-y-auto">
                            {t.body}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
