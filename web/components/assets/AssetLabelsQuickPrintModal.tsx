"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { assetLabelsApi, type AssetLabelTemplate } from "@/lib/api";
import { openPdfBlob } from "@/lib/openPdfBlob";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export function AssetLabelsQuickPrintModal({
  open,
  assetIds,
  onClose,
}: {
  open: boolean;
  assetIds: number[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<AssetLabelTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | "">("");
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    assetLabelsApi
      .templates()
      .then((res) => {
        const rows = res.data.data ?? [];
        setTemplates(rows);
        setTemplateId(rows[0]?.id ?? "");
      })
      .catch(() => {
        setTemplates([]);
        setError(t("assets.labels.loadTemplatesFailed"));
      });
  }, [open, t]);

  async function handlePrint() {
    if (!templateId) {
      setError(t("assets.register.needTemplate"));
      return;
    }
    if (assetIds.length === 0) {
      setError(t("assets.register.exportEmpty"));
      return;
    }
    setPrinting(true);
    setError(null);
    try {
      const res = await assetLabelsApi.print({
        asset_ids: assetIds,
        template_id: templateId,
        reprint: false,
        reprint_reason: null,
      });
      await openPdfBlob(res.data as Blob, `asset-labels-${Date.now()}.pdf`);
      onClose();
    } catch (err: unknown) {
      let message = t("common.error");
      if (err instanceof Error && err.message) message = err.message;
      if (isAxiosError(err) && err.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text()) as { message?: string };
          if (parsed.message) message = parsed.message;
        } catch {
          /* keep */
        }
      }
      setError(message);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("assets.register.labelsTitle")}
      description={t("assets.register.labelsHint")}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={printing}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={() => void handlePrint()} disabled={printing || !templateId}>
            {printing ? t("assets.labels.printing") : t("assets.labels.printSelected")}
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <p className="mb-3 text-sm text-neutral-600">{assetIds.length} selected</p>
      <label htmlFor="assets-AssetLabelsQuickPrintModal-settemplateid-e-target-value-number-e-target-val" className="block text-sm">
        {t("assets.labels.template")}
        <select id="assets-AssetLabelsQuickPrintModal-settemplateid-e-target-value-number-e-target-val"
          className="input mt-1 w-full"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}
        >
          {templates.length === 0 && <option value="">{t("assets.labels.noTemplates")}</option>}
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
      </label>
    </Modal>
  );
}
