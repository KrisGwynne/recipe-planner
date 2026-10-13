"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";

type Toast = { id: number; message: string; undo?: () => void };

const ToastContext = createContext<(message: string, options?: { undo?: () => void }) => void>(() => {});

/** How long a toast stays, in milliseconds. */
export const TOAST_MS = 6000;

/**
 * Toasts (foundations; meal plans design I): one at a time, in ink above the
 * tab bar or action bar, with an optional Undo. The provider sits in the app
 * layout, so a toast shown just before navigating stays on the next page.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const next = useRef(0);

  const show = useCallback((message: string, options: { undo?: () => void } = {}) => {
    next.current += 1;
    setToast({ id: next.current, message, undo: options.undo });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext value={show}>
      {children}
      <div
        role="status"
        className="fixed z-[60] inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-8 md:left-auto md:right-8 md:w-96 pointer-events-none"
      >
        {toast && (
          <div className="pointer-events-auto mx-auto max-w-md flex items-center gap-3 rounded-full bg-ink text-bg pl-5 pr-2 min-h-12 shadow-lg">
            <Icon name="check" className="size-5 shrink-0" strokeWidth={2.5} />
            <span className="font-medium py-2">{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
                className="ml-auto h-11 px-3 font-semibold underline underline-offset-2 rounded-full focus-visible:outline-2 focus-visible:outline-primary"
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext>
  );
}

/** Shows a toast: `toast("Added to Thu dinner", { undo })`. */
export function useToast() {
  return useContext(ToastContext);
}
