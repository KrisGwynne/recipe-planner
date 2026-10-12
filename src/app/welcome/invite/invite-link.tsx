"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/lib/cx";

const noSubscribe = () => () => {};

/**
 * The invite link box on screen C, with Copy and Share. The link is only made
 * on the first tap (so skipping leaves no unused links); later taps reuse it.
 * Share appears only where the browser has a share sheet.
 */
export function InviteLink({
  createLink,
  householdName,
}: {
  createLink: () => Promise<string>;
  householdName: string;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const copied = message === "Link copied";
  const pending = useRef<Promise<string> | null>(null);
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  function getLink(): Promise<string> {
    pending.current ??= createLink().then(
      (path) => {
        const url = new URL(path, window.location.origin).href;
        setLink(url);
        return url;
      },
      (error: unknown) => {
        pending.current = null;
        throw error;
      },
    );
    return pending.current;
  }

  function fail() {
    setFailed(true);
    setMessage("Couldn't make a link. Try again.");
  }

  async function copy() {
    setFailed(false);
    const url = getLink();
    try {
      // A ClipboardItem built from a promise keeps the tap's permission to
      // write while the link is made (Safari needs this).
      if (typeof ClipboardItem === "function" && navigator.clipboard?.write) {
        const blob = url.then((text) => new Blob([text], { type: "text/plain" }));
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      } else {
        await navigator.clipboard.writeText(await url);
      }
      setMessage("Link copied");
    } catch {
      // The link may exist even if copying failed: it's shown to copy by hand.
      await url.then(() => setMessage("Couldn't copy. Press and hold the link to copy it."), fail);
    }
  }

  async function share() {
    setFailed(false);
    let url: string;
    try {
      url = await getLink();
    } catch {
      return fail();
    }
    try {
      await navigator.share({ title: `Join ${householdName}`, text: `Join ${householdName} in Recipe planner`, url });
      setMessage(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Making the link can take long enough for the browser to stop
      // treating this as a tap; the link is ready now, so a second tap works.
      setMessage("Link ready. Tap Share again.");
    }
  }

  return (
    <>
      <p id="invite-link-label" className="text-sm font-semibold">
        Invite link
      </p>
      <p
        aria-labelledby="invite-link-label"
        className={cx(
          "mt-2 min-h-11 px-3 py-2.5 rounded-control bg-surface-2 text-sm flex items-center",
          link ? "font-mono text-ink break-all select-all" : "text-ink-muted",
        )}
      >
        {link ? link.replace(/^https?:\/\//, "") : "Tap Copy or Share to make a link"}
      </p>
      <div className={cx("mt-3 grid gap-2", canShare && "grid-cols-2")}>
        <button type="button" onClick={copy} className={buttonClasses("secondary", "h-11 px-3")}>
          <Icon name={copied ? "check" : "copy"} className="size-5" />
          {copied ? "Copied" : "Copy"}
        </button>
        {canShare && (
          <button type="button" onClick={share} className={buttonClasses("secondary", "h-11 px-3")}>
            <Icon name="upload" className="size-5" />
            Share
          </button>
        )}
      </div>
      <p role="status" className={cx("text-sm empty:hidden mt-2", failed ? "text-danger" : "text-ink-muted", copied && "sr-only")}>
        {message}
      </p>
    </>
  );
}
