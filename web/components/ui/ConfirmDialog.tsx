"use client";

import { createContext, useCallback, useContext, useState } from "react";

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
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const [resolveFn, setResolveFn] = useState<(value: boolean) => void>(() => () => { });

    const confirm = useCallback((opts: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setOptions(opts);
            setResolveFn(() => (value: boolean) => resolve(value));
            setIsOpen(true);
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setIsOpen(false);
        resolveFn(true);
    }, [resolveFn]);

    const handleCancel = useCallback(() => {
        setIsOpen(false);
        resolveFn(false);
    }, [resolveFn]);

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {isOpen && options && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 transition-opacity animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-[slideUp_0.2s_ease-out]">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-full ${options.variant === "danger" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {options.variant === "danger" ? "warning" : "help"}
                                    </span>
                                </div>
                                <h3 className="text-lg font-semibold text-neutral-900">{options.title}</h3>
                            </div>
                            {options.message && (
                                <p className="text-sm text-neutral-500 mt-2 leading-relaxed ml-11">
                                    {options.message}
                                </p>
                            )}
                        </div>
                        <div className="bg-neutral-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-neutral-100">
                            <button
                                type="button"
                                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                                onClick={handleCancel}
                            >
                                {options.cancelText || "Cancel"}
                            </button>
                            <button
                                type="button"
                                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${options.variant === "danger"
                                        ? "bg-red-600 hover:bg-red-700 shadow-sm shadow-red-200"
                                        : "bg-primary hover:bg-primary-hover shadow-sm shadow-blue-200"
                                    }`}
                                onClick={handleConfirm}
                            >
                                {options.confirmText || "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}
