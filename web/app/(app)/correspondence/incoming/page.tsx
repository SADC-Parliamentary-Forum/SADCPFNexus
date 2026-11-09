"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { correspondenceApi, adminApi, type Department } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const ACCEPTED = ".pdf,.doc,.docx";
const MAX_MB = 25;

export default function IncomingMailPage() {
  const router = useRouter();
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    subject: "",
    type: "external",
    priority: "normal",
    language: "en",
    file_code: "",
    department_id: "",
    body: "",
    sender_name: "",
    sender_organisation: "",
    sender_country: "",
    sender_reference: "",
    channel: "post",
    confidentiality: "general_official",
    summary: "",
    response_required: "0",
  });

  useEffect(() => {
    adminApi.listDepartments().then((res) => setDepartments(res.data.data ?? [])).catch(() => {});
  }, []);

  function handleField(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) validateAndSetFile(picked);
  }

  function validateAndSetFile(f: File) {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "doc", "docx"].includes(ext ?? "")) {
      setError(t("correspondence.fileTypes"));
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(t("correspondence.fileTooLarge", { max: MAX_MB }));
      return;
    }
    setFile(f);
    setError(null);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.subject.trim()) {
      setError(t("correspondence.titleSubjectRequired"));
      return;
    }
    if (!file) {
      setError(t("correspondence.incoming.uploadRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      fd.append("direction", "incoming");
      fd.append("file", file);

      const res = await correspondenceApi.registerIncoming(fd);
      router.push(`/correspondence/${res.data.data.id}`);
    } catch {
      setError(t("correspondence.saveFailed"));
      setSaving(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/correspondence" className="hover:text-neutral-700">{t("workflows.simulate.module.correspondence")}</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">{t("correspondence.incoming.crumb")}</span>
      </div>

      <ModulePageHeader
        title={t("correspondence.incoming.title")}
        subtitle={t("correspondence.incoming.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("correspondence.incoming.title") }]} />}
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* File Upload */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900">{t("correspondence.incoming.upload")}</h3>
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-neutral-200 hover:border-neutral-300"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleFileChange} />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-4xl text-emerald-500">description</span>
              <p className="text-sm font-semibold text-neutral-900">{file.name}</p>
              <p className="text-xs text-neutral-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs text-red-500 hover:text-red-700">
                {t("correspondence.remove")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-4xl text-neutral-300">move_to_inbox</span>
              <p className="text-sm text-neutral-600">
                {t("correspondence.dropzone")}
              </p>
              <p className="text-xs text-neutral-400">{t("correspondence.fileHint", { max: MAX_MB })}</p>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">{t("correspondence.classification")}</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="corr-incoming-title" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.incoming.titleFrom")}</label>
            <input id="corr-incoming-title" name="title" value={form.title} onChange={handleField} className="form-input w-full" placeholder={t("correspondence.incoming.titlePlaceholder")} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="corr-incoming-subject" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.subjectRequired")}</label>
            <input id="corr-incoming-subject" name="subject" value={form.subject} onChange={handleField} className="form-input w-full" placeholder={t("correspondence.incoming.subjectPlaceholder")} />
          </div>

          <div>
            <label htmlFor="corr-incoming-type" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.col.type")}</label>
            <select id="corr-incoming-type" name="type" value={form.type} onChange={handleField} className="form-input w-full">
              <option value="external">{t("correspondence.type.external")}</option>
              <option value="internal_memo">{t("correspondence.type.internalMemo")}</option>
              <option value="diplomatic_note">{t("correspondence.type.diplomaticNote")}</option>
              <option value="procurement">{t("nav.procurement")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="corr-incoming-priority" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.priority")}</label>
            <select id="corr-incoming-priority" name="priority" value={form.priority} onChange={handleField} className="form-input w-full">
              <option value="low">{t("correspondence.priority.low")}</option>
              <option value="normal">{t("correspondence.priority.normal")}</option>
              <option value="high">{t("correspondence.priority.high")}</option>
              <option value="urgent">{t("correspondence.priority.urgent")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="corr-incoming-language" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.language")}</label>
            <select id="corr-incoming-language" name="language" value={form.language} onChange={handleField} className="form-input w-full">
              <option value="en">{t("correspondence.lang.en")}</option>
              <option value="fr">{t("correspondence.lang.fr")}</option>
              <option value="pt">{t("correspondence.lang.pt")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="corr-incoming-file-code" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.fileCode")}</label>
            <input id="corr-incoming-file-code" name="file_code" value={form.file_code} onChange={handleField} className="form-input w-full" placeholder={t("correspondence.fileCodePlaceholder")} />
          </div>

          <div>
            <label htmlFor="corr-incoming-sender-name" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.senderName")}</label>
            <input id="corr-incoming-sender-name" name="sender_name" value={form.sender_name} onChange={handleField} className="form-input w-full" placeholder={t("correspondence.incoming.senderPlaceholder")} />
          </div>
          <div>
            <label htmlFor="corr-incoming-sender-organisation" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.senderOrganisation")}</label>
            <input id="corr-incoming-sender-organisation" name="sender_organisation" value={form.sender_organisation} onChange={handleField} className="form-input w-full" />
          </div>
          <div>
            <label htmlFor="corr-incoming-channel" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.channel")}</label>
            <select id="corr-incoming-channel" name="channel" value={form.channel} onChange={handleField} className="form-input w-full">
              <option value="post">{t("correspondence.channel.post")}</option>
              <option value="email">{t("correspondence.channel.email")}</option>
              <option value="hand">{t("correspondence.channel.hand")}</option>
              <option value="courier">{t("correspondence.channel.courier")}</option>
              <option value="fax">{t("correspondence.channel.fax")}</option>
              <option value="other">{t("correspondence.channel.other")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="corr-incoming-confidentiality" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.confidentiality")}</label>
            <select id="corr-incoming-confidentiality" name="confidentiality" value={form.confidentiality} onChange={handleField} className="form-input w-full">
              <option value="general_official">{t("correspondence.conf.generalOfficial")}</option>
              <option value="internal">{t("correspondence.conf.internal")}</option>
              <option value="restricted">{t("correspondence.conf.restricted")}</option>
              <option value="confidential">{t("correspondence.conf.confidential")}</option>
              <option value="highly_confidential">{t("correspondence.conf.highlyConfidential")}</option>
              <option value="privileged_legal">{t("correspondence.conf.privilegedLegal")}</option>
              <option value="hr_confidential">{t("correspondence.conf.hrConfidential")}</option>
              <option value="finance_confidential">{t("correspondence.conf.financeConfidential")}</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="corr-incoming-summary" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.summary")}</label>
            <textarea id="corr-incoming-summary" name="summary" value={form.summary} onChange={handleField} className="form-input w-full" rows={2} />
          </div>

          <div>
            <label htmlFor="corr-incoming-department-id" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.incoming.routeDepartment")}</label>
            <select id="corr-incoming-department-id" name="department_id" value={form.department_id} onChange={handleField} className="form-input w-full">
              <option value="">{t("correspondence.incoming.noRouting")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="corr-incoming-body" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.notes")} <span className="text-neutral-400 font-normal">{t("correspondence.optional")}</span></label>
          <textarea id="corr-incoming-body" name="body" value={form.body} onChange={handleField} rows={3} className="form-input w-full resize-y" placeholder={t("correspondence.incoming.notesPlaceholder")} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pb-4">
        <Link href="/correspondence" className="btn-secondary">{t("common.cancel")}</Link>
        <button type="button" disabled={saving} onClick={handleSave} className="btn-primary">
          {saving ? t("correspondence.saving") : t("correspondence.incoming.submit")}
        </button>
      </div>
    </div>
  );
}
