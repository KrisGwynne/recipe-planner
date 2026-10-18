"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Icon } from "@/components/icon";
import { deleteAccountAction } from "./actions";

/**
 * "Delete my account…" beside Sign out (household design N), and design K's
 * plain confirmation without the household wording (O). On success the action
 * signs out and goes on to the sign-in page.
 */
export function DeleteAccount({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const close = () => {
    setOpen(false);
    setFailed(false);
  };

  // There's no toast outside the app shell, so a failure shows in the sheet.
  async function confirm() {
    setBusy(true);
    setFailed(!(await deleteAccountAction()));
    setBusy(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Delete my account…
      </button>
      {open && (
        <Sheet title="Delete your account?" onClose={close}>
          <p className="text-ink-muted">Your sign-in details are deleted. Signing in with Google again starts from scratch.</p>
          {failed && (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-danger">
              <Icon name="alert" className="size-4" />
              Couldn&apos;t delete your account. Try again.
            </p>
          )}
          <button type="button" disabled={busy} onClick={confirm} className={buttonClasses("danger", "mt-5 w-full")}>
            Delete my account
          </button>
          <button type="button" onClick={close} className="mt-2 w-full h-12 rounded-control font-semibold hover:bg-surface-2">
            Cancel
          </button>
        </Sheet>
      )}
    </>
  );
}
