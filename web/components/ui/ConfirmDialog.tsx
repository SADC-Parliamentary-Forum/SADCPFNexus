"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/LocaleProvider";

interface ConfirmOptions {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "primary";
}

interface ConfirmContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
    return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const [resolveFn, setResolveFn] = useState<(value: boolean) => void>(() => () => { });
    const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const descriptionId = useId();

    const confirm = useCallback((opts: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            setOptions(opts);
            setResolveFn(() => (value: boolean) => resolve(value));
            setIsOpen(true);
        });
    }, []);

    const close = useCallback((value: boolean) => {
        setIsOpen(false);
        resolveFn(value);
        window.setTimeout(() => previousFocusRef.current?.focus(), 0);
    }, [resolveFn]);

    const handleConfirm = useCallback(() => close(true), [close]);

    const handleCancel = useCallback(() => close(false), [close]);

    useEffect(() => {
        if (!isOpen) return;
        cancelButtonRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") handleCancel();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [handleCancel, isOpen]);

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {isOpen && options && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 transition-opacity animate-[fadeIn_0.2s_ease-out]"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) handleCancel();
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        aria-describedby={options.message ? descriptionId : undefined}
                        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-[slideUp_0.2s_ease-out] dark:border dark:border-neutral-700 dark:bg-neutral-800"
                    >
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-full ${options.variant === "danger" ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300" : "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300"}`}>
                                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {options.variant === "danger" ? "warning" : "help"}
                                    </span>
                                </div>
                                <h3 id={titleId} className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t(options.title)}</h3>
                            </div>
                            {options.message && (
                                <p id={descriptionId} className="text-sm text-neutral-500 mt-2 leading-relaxed ml-11 dark:text-neutral-300">
                                    {t(options.message)}
                                </p>
                            )}
                        </div>
                        <div className="bg-neutral-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-neutral-100 dark:border-neutral-700 dark:bg-neutral-900/50">
                            <button
                                type="button"
                                ref={cancelButtonRef}
                                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-neutral-300 dark:hover:text-white"
                                onClick={handleCancel}
                            >
                                {options.cancelText || t("common.cancel")}
                            </button>
                            <button
                                type="button"
                                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${options.variant === "danger"
                                        ? "bg-red-600 hover:bg-red-700 shadow-sm shadow-red-200"
                                        : "bg-primary hover:bg-primary-hover shadow-sm shadow-blue-200"
                                    }`}
                                onClick={handleConfirm}
                            >
                                {options.confirmText || t("common.confirm")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}
