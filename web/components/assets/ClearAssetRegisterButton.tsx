"use client";

import { useState } from "react";
import { assetsApi } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { CLEAR_ASSET_REGISTER_CONFIRMATION } from "@/lib/asset-register-clear";
import { canClearAssetRegister, getStoredUser } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export function ClearAssetRegisterButton({
  onCleared,
}: {
  onCleared?: (deletedCount: number) => void;
}) {
  const { t } = useI18n();
  const { prompt } = useConfirm();
  const { success, error: showErrorToast } = useToast();
  const [busy, setBusy] = useState(false);
  const allowed = canClearAssetRegister(getStoredUser());

  if (!allowed) return null;

  async function handleClear() {
    const typed = await prompt({
      title: "assets.register.clearConfirmTitle",
      message: "assets.register.clearConfirmMessage",
      label: "assets.register.clearConfirmLabel",
      placeholder: CLEAR_ASSET_REGISTER_CONFIRMATION,
      confirmText: t("assets.register.clear"),
      variant: "danger",
      required: true,
    });
    if (typed == null) return;
    if (typed.trim().toUpperCase() !== CLEAR_ASSET_REGISTER_CONFIRMATION) {
      showErrorToast(t("assets.register.clearWrongPhrase"));
      return;
    }

    setBusy(true);
    try {
      const res = await assetsApi.clearRegister({ confirmation: CLEAR_ASSET_REGISTER_CONFIRMATION });
      const deleted = res.data.data?.deleted_count ?? 0;
      success(t("assets.register.clearSuccess", { count: deleted }));
      onCleared?.(deleted);
    } catch (err: unknown) {
      showErrorToast(apiErrorMessage(err, t("assets.register.clearFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="danger"
      onClick={() => void handleClear()}
      disabled={busy}
      data-testid="asset-register-clear"
    >
      {busy ? t("common.loading") : t("assets.register.clear")}
    </Button>
  );
}
