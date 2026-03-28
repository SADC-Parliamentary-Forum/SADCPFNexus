"use client";

import { createContext, useCallback, useContext, useState, useEffect } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const success = useCallback((title: string, message?: string) => toast("success", title, message), [toast]);
  const error   = useCallback((title: string, message?: string) => toast("error", title, message), [toast]);
  const warning = useCallback((title: string, message?: string) => toast("warning", title, message), [toast]);
  const info    = useCallback((title: string, message?: string) => toast("info", title, message), [toast]);

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICONS: Record<ToastType, string> = {
  success: "check_circle",
  error:   "error",
  warning: "warning",
  info:    "info",
};

const STYLES: Record<ToastType, { container: string; icon: string; progress: string }> = {
  success: { container: "border-green-200 bg-white", icon: "text-green-500", progress: "bg-green-500" },
  error:   { container: "border-red-200 bg-white",   icon: "text-red-500",   progress: "bg-red-500"   },
  warning: { container: "border-amber-200 bg-white", icon: "text-amber-500", progress: "bg-amber-500" },
  info:    { container: "border-blue-200 bg-white",  icon: "text-blue-500",  progress: "bg-blue-500"  },
};

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const style = STYLES[toast.type];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`relative flex items-start gap-3 rounded-xl border shadow-lg px-4 py-3 min-w-[280px] max-w-sm overflow-hidden transition-all duration-300 ${style.container} ${visible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}
    >
      <span className={`material-symbols-outlined text-[20px] mt-0.5 flex-shrink-0 ${style.icon}`} style={{ fontVariationSettings: "'FILL' 1" }}>
        {ICONS[toast.type]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900">{toast.title}</p>
        {toast.message && <p className="text-xs text-neutral-500 mt-0.5">{toast.message}</p>}
      </div>
      <button onClick={() => dismiss(toast.id)} className="text-neutral-300 hover:text-neutral-500 transition-colors flex-shrink-0 mt-0.5">
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-100">
        <div className={`h-full ${style.progress} animate-[shrink_4s_linear_forwards]`} style={{ width: "100%" }} />
      </div>
    </div>
  );
}

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} dismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
