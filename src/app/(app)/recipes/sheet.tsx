"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "@/components/icon";

/**
 * A bottom sheet (library design D, E and G): a dialog over the page that
 * closes with the cross, Escape or a tap outside. `full` makes it full height.
 */
export function Sheet({
  title,
  onClose,
  full = false,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  full?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={
          "relative mx-auto w-full max-w-xl rounded-t-[1.5rem] bg-bg shadow-xl flex flex-col " +
          (full ? "h-[calc(100dvh-1rem)]" : "max-h-[85dvh]")
        }
      >
        <div className="px-5 pt-2 pb-2 shrink-0">
          <div className="mx-auto h-1 w-10 rounded-full bg-line" aria-hidden="true" />
          <div className="mt-2 flex items-center justify-between">
            <p id={titleId} className="font-display text-xl font-semibold">
              {title}
            </p>
            <button
              ref={close}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="size-11 -mr-2 rounded-full grid place-items-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Icon name="x" className="size-6" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
