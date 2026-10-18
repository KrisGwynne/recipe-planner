"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

/** Back to wherever you came from in the app, or the landing page. */
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (document.referrer.startsWith(window.location.origin)) router.back();
        else router.push("/");
      }}
      aria-label="Back"
      className="size-11 shrink-0 rounded-full grid place-items-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Icon name="arrow-left" className="size-6" />
    </button>
  );
}
