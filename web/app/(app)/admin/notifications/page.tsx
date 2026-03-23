"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { notificationTemplatesApi, type NotifTemplate } from "@/lib/api";

const VARS = ["{{name}}", "{{date}}", "{{amount}}", "{{destination}}", "{{start_date}}", "{{end_date}}", "{{leave_type}}", "{{due_date}}", "{{module}}", "{{comment}}", "{{task_title}}"];

export default function NotificationsPage() {
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<NotifTemplate>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    notificationTemplatesApi.list()
      .then((res) => setTemplates(res.data))
      .catch(() => showToast("error", "Could not load templates."))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (t: NotifTemplate) => { setEditKey(t.trigger_key); setEditForm({ ...t }); };
  const cancelEdit = () => { setEditKey(null); setEditForm({}); };

  const saveEdit = async () => {
    if (!editForm.trigger_key || !editForm.subject || !editForm.body) return;
    setSaving(true);
    try {
      const res = await notificationTemplatesApi.update({
        trigger_key: editForm.trigger_key,
        subject: editForm.subject,
        body: editForm.body,
      });
      setTemplates((prev) => prev.map((t) => t.trigger_key === editForm.trigger_key ? { ...t, ...res.data } : t));
      setEditKey(null);
      showToast("success", "Template saved.");
    } catch {
      showToast("error", "Failed to save template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/admin" className="hover:text-primary transition-colors">Admin</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Notification Templates</span>
      </div>

      <div>
        <h1 className="page-title">Notification Templates</h1>
        <p className="page-subtitle">Manage email and system notification templates. Use <code className="text-xs bg-neutral-100 px-1 rounded">{"{{variable}}"}</code> placeholders for dynamic content.</p>
      </div>

      {/* Variable hints */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-neutral-600 mb-2">Available Variables</p>
        <div className="flex flex-wrap gap-1.5">
          {VARS.map((v) => (
            <code key={v} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{v}</code>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-neutral-100 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <div key={t.trigger_key} className="card p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-neutral-900">{t.name}</h3>
                    <code className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded">{t.trigger_key}</code>
                  </div>
                </div>
                {editKey !== t.trigger_key && (
                  <button type="button" onClick={() => startEdit(t)} className="text-xs font-semibold text-primary hover:underline flex-shrink-0">Edit</button>
                )}
              </div>

              {editKey === t.trigger_key ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Subject</label>
                    <input className="form-input" value={editForm.subject ?? t.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Body</label>
                    <textarea rows={6} className="form-input resize-none font-mono text-xs" value={editForm.body ?? t.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveEdit} disabled={saving} className="btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-60">
                      {saving && <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>}
                      Save Template
                    </button>
                    <button type="button" onClick={cancelEdit} className="btn-secondary px-4 py-1.5 text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-neutral-500 mb-1"><span className="font-semibold text-neutral-700">Subject:</span> {t.subject}</p>
                  <pre className="text-xs text-neutral-400 bg-neutral-50 rounded-lg p-3 whitespace-pre-wrap font-sans leading-relaxed mt-2 max-h-32 overflow-y-auto">{t.body}</pre>
                </div>
              )}
            </div>
          ))}
          {templates.length === 0 && (
            <div className="card p-10 text-center">
              <span className="material-symbols-outlined text-3xl text-neutral-200">notifications_off</span>
              <p className="text-sm text-neutral-400 mt-2">No templates found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
