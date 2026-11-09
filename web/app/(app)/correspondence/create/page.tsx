"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { correspondenceApi, adminApi, type Department } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const ACCEPTED = ".pdf,.doc,.docx";
const MAX_MB = 25;

export default function CreateCorrespondencePage() {
  const router = useRouter();
  const toast = useToast();
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
    direction: "outgoing",
    file_code: "",
    signatory_code: "SG",
    department_id: "",
    body: "",
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

  async function handleSubmit(status: "draft" | "submit") {
    if (!form.title.trim() || !form.subject.trim()) {
      setError(t("correspondence.titleSubjectRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (file) fd.append("file", file);

      const res = await correspondenceApi.create(fd);
      const id = res.data.data.id;

      if (status === "submit") {
        await correspondenceApi.submit(id);
      }

      toast.success(status === "submit" ? t("correspondence.create.submitted") : t("correspondence.create.savedDraft"));
      router.push(`/correspondence/${id}`);
    } catch (err) {
      setError(t("correspondence.create.saveFailed"));
      toast.error(
        status === "submit" ? t("correspondence.create.notSubmitted") : t("correspondence.create.notSaved"),
        apiErrorMessage(err, t("correspondence.create.saveFailed")),
      );
      setSaving(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/correspondence" className="hover:text-neutral-700">{t("workflows.simulate.module.correspondence")}</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">{t("correspondence.create.title")}</span>
      </div>

      <ModulePageHeader
        title={t("correspondence.create.title")}
        subtitle={t("correspondence.create.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("correspondence.create.title") }]} />}
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* File Upload */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900">{t("correspondence.create.upload")}</h3>
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
              <span className="material-symbols-outlined text-4xl text-primary">description</span>
              <p className="text-sm font-semibold text-neutral-900">{file.name}</p>
              <p className="text-xs text-neutral-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                {t("correspondence.remove")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-4xl text-neutral-300">upload_file</span>
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
        <h3 className="text-sm font-semibold text-neutral-900">{t("correspondence.create.details")}</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="corr-create-title" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.create.titleRequired")}</label>
            <input id="corr-create-title" name="title" value={form.title} onChange={handleField} className="form-input w-full" placeholder={t("correspondence.create.titlePlaceholder")} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="corr-create-subject" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.subjectRequired")}</label>
            <input id="corr-create-subject" name="subject" value={form.subject} onChange={handleField} className="form-input w-full" placeholder={t("correspondence.create.subjectPlaceholder")} />
          </div>

          <div>
            <label htmlFor="corr-create-type" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.col.type")}</label>
            <select id="corr-create-type" name="type" value={form.type} onChange={handleField} className="form-input w-full">
              <option value="external">{t("correspondence.type.external")}</option>
              <option value="internal_memo">{t("correspondence.type.internalMemo")}</option>
              <option value="diplomatic_note">{t("correspondence.type.diplomaticNote")}</option>
              <option value="procurement">{t("nav.procurement")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="corr-create-direction" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.col.direction")}</label>
            <select id="corr-create-direction" name="direction" value={form.direction} onChange={handleField} className="form-input w-full">
              <option value="outgoing">{t("correspondence.direction.outgoing")}</option>
              <option value="incoming">{t("correspondence.direction.incoming")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="corr-create-priority" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.priority")}</label>
            <select id="corr-create-priority" name="priority" value={form.priority} onChange={handleField} className="form-input w-full">
              <option value="low">{t("correspondence.priority.low")}</option>
              <option value="normal">{t("correspondence.priority.normal")}</option>
              <option value="high">{t("correspondence.priority.high")}</option>
              <option value="urgent">{t("correspondence.priority.urgent")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="corr-create-language" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.language")}</label>
            <select id="corr-create-language" name="language" value={form.language} onChange={handleField} className="form-input w-full">
              <option value="en">{t("correspondence.lang.en")}</option>
              <option value="fr">{t("correspondence.lang.fr")}</option>
              <option value="pt">{t("correspondence.lang.pt")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="corr-create-file-code" className="block text-xs font-medium text-neutral-600 mb-1">
              {t("correspondence.field.fileCode")}
              <span className="ml-1 text-neutral-400 font-normal">{t("correspondence.create.fileCodeHint")}</span>
            </label>
            <input id="corr-create-file-code" name="file_code" value={form.file_code} onChange={handleField} className="form-input w-full" placeholder={t("correspondence.fileCodePlaceholder")} />
          </div>

          <div>
            <label htmlFor="corr-create-signatory-code" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.signatory")}</label>
            <select id="corr-create-signatory-code" name="signatory_code" value={form.signatory_code} onChange={handleField} className="form-input w-full">
              <option value="SG">{t("correspondence.signatory.sg")}</option>
              <option value="DIR">{t("correspondence.signatory.dir")}</option>
              <option value="HOD">{t("correspondence.signatory.hod")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="corr-create-department-id" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.field.department")}</label>
            <select id="corr-create-department-id" name="department_id" value={form.department_id} onChange={handleField} className="form-input w-full">
              <option value="">{t("correspondence.create.selectDepartment")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="corr-create-body" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.create.body")} <span className="text-neutral-400 font-normal">{t("correspondence.optional")}</span></label>
          <textarea
            id="corr-create-body"
            name="body"
            value={form.body}
            onChange={handleField}
            rows={4}
            className="form-input w-full resize-y"
            placeholder={t("correspondence.create.bodyPlaceholder")}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pb-4">
        <Link href="/correspondence" className="btn-secondary">{t("common.cancel")}</Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSubmit("draft")}
            className="btn-secondary"
          >
            {saving ? t("correspondence.saving") : t("correspondence.create.saveDraft")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSubmit("submit")}
            className="btn-primary"
          >
            {saving ? t("correspondence.saving") : t("correspondence.create.submitReview")}
          </button>
        </div>
      </div>
    </div>
  );
}
