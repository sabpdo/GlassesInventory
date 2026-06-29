"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
  durationMs: number;
};

type ToastContextValue = {
  show: (message: string, opts?: { variant?: ToastVariant; durationMs?: number }) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastContextValue["show"]>(
    (message, opts) => {
      const id = nextId++;
      const toast: Toast = {
        id,
        message,
        variant: opts?.variant ?? "info",
        durationMs: opts?.durationMs ?? 4000,
      };
      setToasts((prev) => [...prev, toast]);
    },
    []
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (m, d) => show(m, { variant: "success", durationMs: d }),
      error: (m, d) => show(m, { variant: "error", durationMs: d ?? 6000 }),
      info: (m, d) => show(m, { variant: "info", durationMs: d }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast.durationMs]);

  const styles =
    toast.variant === "success"
      ? "bg-emerald-50 ring-emerald-200 text-emerald-900"
      : toast.variant === "error"
      ? "bg-red-50 ring-red-200 text-red-900"
      : "bg-slate-50 ring-slate-200 text-slate-900";

  const icon =
    toast.variant === "success"
      ? "✓"
      : toast.variant === "error"
      ? "!"
      : "i";

  const iconStyles =
    toast.variant === "success"
      ? "bg-emerald-100 text-emerald-700"
      : toast.variant === "error"
      ? "bg-red-100 text-red-700"
      : "bg-slate-100 text-slate-600";

  return (
    <div
      role="status"
      className={
        "pointer-events-auto flex items-start gap-3 rounded-lg p-3 pr-4 shadow-lg ring-1 " +
        styles
      }
      style={{
        animation: "toast-in 200ms ease-out",
      }}
    >
      <span
        aria-hidden
        className={
          "mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-sm font-bold " +
          iconStyles
        }
      >
        {icon}
      </span>
      <div className="flex-1 text-sm leading-snug">{toast.message}</div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="mt-0.5 text-slate-400 hover:text-slate-600"
      >
        ×
      </button>
    </div>
  );
}
