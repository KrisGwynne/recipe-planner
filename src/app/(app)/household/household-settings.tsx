"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { firstName } from "@/lib/format";
import { formatShortDate, today } from "@/plans/plan";
import { createInviteAction } from "../../welcome/invite/actions";
import { InviteLink } from "../../welcome/invite/invite-link";
import {
  deleteAccountAction,
  deleteHouseholdAction,
  leaveAction,
  removeMemberAction,
  renameAction,
  revokeInviteAction,
  setRoleAction,
  type RenameState,
} from "./actions";

// The Household tab (designs/src/household.html A to L). Everything here is
// changed through server actions that check the role again; members get the
// page without the owner's controls (design C).

type Role = "owner" | "member";

export type Member = {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: Role;
  joinedAt: Date;
};

/** `createdBy` is the maker's name, or null when it's you. */
type Invite = { id: string; createdAt: Date; expiresAt: Date; createdBy: string | null };

type Open =
  | { kind: "rename" }
  | { kind: "invite" }
  | { kind: "member"; member: Member }
  | { kind: "remove"; member: Member }
  | { kind: "leave" }
  | { kind: "last-owner" }
  | { kind: "delete" }
  | { kind: "delete-account" };

const DAY = 24 * 60 * 60 * 1000;

/** "Kris", or the email if there's no name. */
function shortName(member: Pick<Member, "name" | "email">): string {
  return firstName(member.name) ?? member.email ?? "Someone";
}

/** "Kris", "Kris and Sam", "Kris, Sam or Alex". */
function listNames(names: string[], conjunction: "and" | "or" = "and"): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} ${conjunction} ${names.at(-1)}`;
}

/** "Expires in 5 days" (design A). */
export function expiresIn(expiresAt: Date, now = new Date()): string {
  const days = Math.max(1, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY));
  return days === 1 ? "Expires in 1 day" : `Expires in ${days} days`;
}

/** "Made by you 2 days ago", "Made by Kris today". */
export function madeBy(invite: Pick<Invite, "createdAt" | "createdBy">, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(invite.createdAt).getTime()) / DAY);
  const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return `Made by ${invite.createdBy === null ? "you" : (firstName(invite.createdBy) ?? "someone")} ${when}`;
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={cx(
        "h-6 px-2 shrink-0 rounded-full text-xs font-semibold inline-flex items-center",
        role === "owner" ? "bg-primary-soft text-primary" : "bg-surface-2",
      )}
    >
      {role === "owner" ? "Owner" : "Member"}
    </span>
  );
}

export function HouseholdSettings({
  household,
  me,
  members,
  invites,
  account,
}: {
  household: { name: string; role: Role; recipes: number; plans: number };
  me: string;
  members: Member[];
  invites: Invite[];
  /** The top of your account card: who you are, and Sign out (a server form). */
  account: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<Open | null>(null);
  const close = () => setOpen(null);

  const owner = household.role === "owner";
  const owners = members.filter((m) => m.role === "owner");
  const others = members.filter((m) => m.userId !== me);
  const lastOwner = owner && owners.length === 1;
  const alone = others.length === 0;

  async function changeRole(member: Member, role: Role) {
    close();
    if (!(await setRoleAction(member.userId, role))) return toast("Couldn't change that. Try again.");
    const name = shortName(member);
    toast(role === "owner" ? `${name} is now an owner` : `${name} is now a member`, {
      undo: () => void setRoleAction(member.userId, role === "owner" ? "member" : "owner"),
    });
  }

  async function remove(member: Member) {
    close();
    if (await removeMemberAction(member.userId)) toast(`Removed ${shortName(member)}`);
    else toast("Couldn't remove them. Try again.");
  }

  async function cancelLink(id: string) {
    if (await revokeInviteAction(id)) toast("Link cancelled");
    else toast("Couldn't cancel that link. Try again.");
  }

  async function deleteMyAccount(confirmName?: string): Promise<boolean> {
    // On success the action signs out and goes on to the sign-in page.
    if (await deleteAccountAction(confirmName)) return true;
    toast("Couldn't delete your account. Try again.");
    return false;
  }

  async function leave() {
    // On success the action goes on to /welcome.
    if (!(await leaveAction())) {
      close();
      toast("Couldn't leave. Try again.");
    }
  }

  const inviteButton = (className: string) =>
    owner && (
      <button type="button" onClick={() => setOpen({ kind: "invite" })} className={buttonClasses("secondary", className)}>
        <Icon name="plus" className="size-5" />
        Invite someone
      </button>
    );

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-8 max-w-5xl">
      {/* The household and its people */}
      <div>
        {owner ? (
          <button
            type="button"
            onClick={() => setOpen({ kind: "rename" })}
            className="w-full rounded-card bg-surface border border-line p-4 flex items-center gap-3 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-xs text-ink-muted">Household name</span>
              <span className="block font-display text-xl font-semibold leading-snug break-words">{household.name}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Icon name="pencil" className="size-4" />
              Rename
            </span>
          </button>
        ) : (
          <div className="rounded-card bg-surface border border-line p-4">
            <span className="block text-xs text-ink-muted">Household name</span>
            <span className="block font-display text-xl font-semibold leading-snug break-words">{household.name}</span>
          </div>
        )}

        <div id="members" className="mt-6 flex items-center justify-between gap-3 scroll-mt-4">
          <h2 className="text-[17px] font-semibold">
            Members <span className="font-normal text-ink-muted tabular-nums">{members.length}</span>
          </h2>
          {inviteButton("hidden md:inline-flex h-10 px-4 text-sm")}
        </div>
        <ul className="mt-2 rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
          {members.map((m) => {
            const you = m.userId === me;
            const row = (
              <>
                <Avatar name={m.name ?? m.email} image={m.image} size={40} className="shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">
                    {m.name ?? m.email}
                    {you && <span className="font-normal text-ink-muted"> (you)</span>}
                  </span>
                  {m.name && <span className="block text-sm text-ink-muted truncate">{m.email}</span>}
                </span>
                <RoleBadge role={m.role} />
              </>
            );
            return (
              <li key={m.userId}>
                {owner && !you ? (
                  <button
                    type="button"
                    onClick={() => setOpen({ kind: "member", member: m })}
                    className="w-full flex items-center gap-3 px-4 min-h-16 py-2.5 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    {row}
                    <Icon name="chevron-right" className="size-5 shrink-0 text-ink-subtle" />
                  </button>
                ) : (
                  <div className="flex items-center gap-3 px-4 min-h-16 py-2.5">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
        {inviteButton("md:hidden mt-3 w-full")}
        {!owner && (
          <p className="mt-3 rounded-control bg-surface-2 px-4 py-3 text-sm text-ink-muted">
            {owners.length === 1
              ? `${shortName(owners[0])} is the owner, so they invite people and look after the household.`
              : `${listNames(owners.map(shortName))} are the owners, so they invite people and look after the household.`}
          </p>
        )}

        {owner && invites.length > 0 && (
          <>
            <h2 className="mt-6 text-[17px] font-semibold">Open invite links</h2>
            <ul className="mt-2 rounded-card bg-surface border border-line divide-y divide-line">
              {invites.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 pl-4 pr-2 min-h-16 py-2.5">
                  <Icon name="link" className="size-5 shrink-0 text-ink-muted" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium">{expiresIn(invite.expiresAt)}</span>
                    <span className="block text-sm text-ink-muted">
                      {madeBy(invite)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => cancelLink(invite.id)}
                    className="h-11 px-3 rounded-control text-sm font-semibold text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Cancel link
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-ink-subtle">
              Each link lets one person join. To send one again, invite them again and cancel the old one.
            </p>
          </>
        )}
      </div>

      {/* Account, then leave or delete */}
      <div>
        <h2 className="text-[17px] font-semibold">Recipes</h2>
        <DownloadAll count={household.recipes} />

        <h2 className="mt-6 text-[17px] font-semibold">Your account</h2>
        <div className="mt-2 rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
          {account}
          <button
            type="button"
            onClick={() => setOpen({ kind: "delete-account" })}
            className="w-full h-13 px-4 flex items-center font-semibold text-left text-danger hover:bg-surface-2"
          >
            Delete my account…
          </button>
        </div>

        {!(alone && !owner) && (
          <>
            <h2 className="mt-6 text-[17px] font-semibold">{owner ? "Leave or delete" : "Leave"}</h2>
            <div className="mt-2 rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
              {!alone && (
                <button
                  type="button"
                  onClick={() => setOpen({ kind: lastOwner ? "last-owner" : "leave" })}
                  className="w-full px-4 py-3 flex flex-col items-start text-left hover:bg-surface-2"
                >
                  <span className="font-semibold">Leave {household.name}…</span>
                  {lastOwner && <span className="text-sm text-ink-muted">Make someone else an owner first.</span>}
                </button>
              )}
              {owner && (
                <button
                  type="button"
                  onClick={() => setOpen({ kind: "delete" })}
                  className="w-full px-4 py-3 flex flex-col items-start text-left hover:bg-surface-2"
                >
                  <span className="font-semibold text-danger">Delete {household.name}…</span>
                  <span className="text-sm text-ink-muted">Deletes its recipes and plans for everyone.</span>
                </button>
              )}
            </div>
          </>
        )}

        <p className="mt-6 text-center text-sm text-ink-subtle">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
            Terms
          </Link>
        </p>
      </div>

      {open?.kind === "rename" && (
        <RenameSheet
          name={household.name}
          onClose={close}
          onSaved={() => {
            close();
            toast("Renamed");
          }}
        />
      )}

      {open?.kind === "invite" && (
        <Sheet
          title="Invite someone"
          onClose={() => {
            close();
            router.refresh();
          }}
        >
          <p className="text-ink-muted">Send them a link. They&apos;ll need a Google account.</p>
          <div className="mt-4 rounded-card bg-surface border border-line p-4">
            <InviteLink createLink={createInviteAction} householdName={household.name} />
          </div>
          <p className="mt-3 text-sm text-ink-subtle">Works once, for one person, and expires in 7 days. They join as a member.</p>
          <button
            type="button"
            onClick={() => {
              close();
              router.refresh();
            }}
            className="mt-4 w-full h-12 rounded-control font-semibold hover:bg-surface-2"
          >
            Done
          </button>
        </Sheet>
      )}

      {open?.kind === "member" && (
        <Sheet title={open.member.name ?? open.member.email ?? "Member"} onClose={close}>
          <div className="-mt-2 flex items-center gap-3">
            <Avatar name={open.member.name ?? open.member.email} image={open.member.image} size={48} className="shrink-0" />
            <p className="text-sm text-ink-muted">
              {open.member.role === "owner" ? "Owner" : "Member"} · joined{" "}
              {formatShortDate(today(new Date(open.member.joinedAt)))}
            </p>
          </div>
          <ul className="mt-3 divide-y divide-line">
            <li>
              <button
                type="button"
                onClick={() => changeRole(open.member, open.member.role === "owner" ? "member" : "owner")}
                className="w-full min-h-13 py-3 flex items-center gap-3 text-left font-medium"
              >
                <Icon name="users" className="size-5 shrink-0 text-ink-muted" />
                {open.member.role === "owner" ? (
                  "Make a member"
                ) : (
                  <span>
                    Make an owner
                    <span className="block text-sm font-normal text-ink-muted">
                      Owners invite and remove people, rename the household and can delete it.
                    </span>
                  </span>
                )}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setOpen({ kind: "remove", member: open.member })}
                className="w-full min-h-13 py-3 flex items-center gap-3 text-left font-medium text-danger"
              >
                <Icon name="x" className="size-5 shrink-0" />
                Remove from household…
              </button>
            </li>
          </ul>
          <button type="button" onClick={close} className="mt-3 w-full h-12 rounded-control font-semibold hover:bg-surface-2">
            Cancel
          </button>
        </Sheet>
      )}

      {open?.kind === "remove" && (
        <Confirm
          title={`Remove ${shortName(open.member)} from ${household.name}?`}
          action={`Remove ${shortName(open.member)}`}
          onConfirm={() => remove(open.member)}
          onClose={close}
        >
          They&apos;ll lose access to its recipes and plans straight away. Anything they added stays. You can invite them
          again later.
        </Confirm>
      )}

      {open?.kind === "leave" && (
        <Confirm title={`Leave ${household.name}?`} action="Leave household" onConfirm={leave} onClose={close}>
          You&apos;ll lose access to its {counted(household.recipes, "recipe")} and {counted(household.plans, "meal plan")}.
          They stay with {listNames(others.map(shortName))}. To come back, ask an owner for a new invite.
        </Confirm>
      )}

      {open?.kind === "last-owner" && (
        <Sheet title="Choose another owner first" onClose={close}>
          <p className="text-ink-muted">
            You&apos;re the only owner of {household.name}. Make {listNames(others.map(shortName), "or")} an owner, then you can leave. Or delete the household for everyone.
          </p>
          <button
            type="button"
            onClick={() => {
              close();
              document.getElementById("members")?.scrollIntoView({ behavior: "smooth" });
            }}
            className={buttonClasses("primary", "mt-5 w-full")}
          >
            Choose an owner
          </button>
          <button
            type="button"
            onClick={() => setOpen({ kind: "delete" })}
            className="mt-2 w-full h-12 rounded-control font-semibold text-danger hover:bg-surface-2"
          >
            Delete the household…
          </button>
        </Sheet>
      )}

      {open?.kind === "delete" && (
        <DeleteSheet household={household} others={others.map(shortName)} onClose={close} />
      )}

      {open?.kind === "delete-account" &&
        (alone ? (
          // Design L: the household goes too.
          <Sheet title={`Delete your account and ${household.name}?`} onClose={close}>
            <p className="text-ink-muted">
              You&apos;re the only person in {household.name}, so it goes too: {counted(household.recipes, "recipe")} and{" "}
              {counted(household.plans, "meal plan")}. This can&apos;t be undone.
            </p>
            <DownloadFirst count={household.recipes} />
            <TypeNameToConfirm
              name={household.name}
              action="Delete account and household"
              onConfirm={deleteMyAccount}
              onClose={close}
            />
          </Sheet>
        ) : lastOwner ? (
          // Design L: not without another owner.
          <Sheet title="Choose another owner first" onClose={close}>
            <p className="text-ink-muted">
              You&apos;re the only owner of {household.name}. Make {listNames(others.map(shortName), "or")} an owner before
              deleting your account, so the household isn&apos;t left without one.
            </p>
            <button
              type="button"
              onClick={() => {
                close();
                document.getElementById("members")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={buttonClasses("primary", "mt-5 w-full")}
            >
              Choose an owner
            </button>
          </Sheet>
        ) : (
          // Design K.
          <Confirm
            title="Delete your account?"
            action="Delete my account"
            onConfirm={async () => {
              if (!(await deleteMyAccount())) close();
            }}
            onClose={close}
          >
            You&apos;ll leave {household.name} and your sign-in details are deleted. Its recipes and plans stay with{" "}
            {listNames(others.map(shortName))}. Signing in with Google again starts from scratch.
          </Confirm>
        ))}
    </div>
  );
}

/** The route that sends the household's recipes as a .zip (PP-164). A plain link, so the browser downloads it. */
const DOWNLOAD = "/household/download";

/** "Download all recipes" (design B): anyone in the household can. */
function DownloadAll({ count }: { count: number }) {
  const inner = (
    <>
      <span className="size-10 shrink-0 rounded-full bg-surface-2 grid place-items-center">
        <Icon name="download" className="size-5" />
      </span>
      <span className="flex-1">
        <span className="block font-semibold">Download all recipes</span>
        <span className="block text-sm text-ink-muted">
          {count === 0
            ? "No recipes to download yet."
            : `${counted(count, "recipe file")} in a .zip: a backup, or a way to move them to another household.`}
        </span>
      </span>
    </>
  );
  const box = "mt-2 w-full rounded-card bg-surface border border-line p-4 flex items-center gap-3 text-left";
  return count === 0 ? (
    <div aria-disabled="true" className={cx(box, "opacity-60")}>
      {inner}
    </div>
  ) : (
    <a href={DOWNLOAD} download className={cx(box, "hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary")}>
      {inner}
    </a>
  );
}

/** "Download all recipes first" on the sheets that delete them (designs J and L). The sheet stays open. */
function DownloadFirst({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <a
      href={DOWNLOAD}
      download
      className="mt-4 w-full rounded-control bg-surface-2 px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-line focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Icon name="download" className="size-5 shrink-0" />
      <span>
        <span className="block font-semibold">Download all recipes first</span>
        <span className="block text-ink-muted">Keep a copy to import somewhere else.</span>
      </span>
    </a>
  );
}

function counted(n: number, noun: string): string {
  return n === 1 ? `1 ${noun}` : `${n} ${noun}s`;
}

/** Foundations' confirmation sheet (as for deleting a plan). */
function Confirm({
  title,
  action,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  action: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="text-ink-muted">{children}</p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onConfirm();
          setBusy(false);
        }}
        className={buttonClasses("danger", "mt-5 w-full")}
      >
        {action}
      </button>
      <button type="button" onClick={onClose} className="mt-2 w-full h-12 rounded-control font-semibold hover:bg-surface-2">
        Cancel
      </button>
    </Sheet>
  );
}

function RenameSheet({ name, onClose, onSaved }: { name: string; onClose: () => void; onSaved: () => void }) {
  const [state, formAction, pending] = useActionState<RenameState, FormData>(renameAction, {});
  useEffect(() => {
    if (state.saved) onSaved();
  }, [state, onSaved]);
  return (
    <Sheet title="Rename household" onClose={onClose}>
      <form action={formAction} noValidate>
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input
            name="name"
            defaultValue={name}
            maxLength={50}
            autoComplete="off"
            aria-invalid={state.error ? true : undefined}
            aria-describedby="rename-hint"
            className={cx(
              "mt-1.5 w-full h-12 px-4 rounded-control bg-surface-2 border text-[17px] focus:outline-none focus:border-2 focus:border-primary",
              state.error ? "border-2 border-danger" : "border-line",
            )}
          />
          <span id="rename-hint" className={cx("mt-1.5 block text-sm", state.error ? "text-danger" : "text-ink-subtle")}>
            {state.error ?? "Only members see this, and people you invite."}
          </span>
        </label>
        <button type="submit" disabled={pending} className={buttonClasses("primary", "mt-6 w-full")}>
          Save
        </button>
      </form>
    </Sheet>
  );
}

/** Design J: lists what goes and asks for the name. */
function DeleteSheet({
  household,
  others,
  onClose,
}: {
  household: { name: string; recipes: number; plans: number };
  others: string[];
  onClose: () => void;
}) {
  const toast = useToast();

  async function remove(typed: string): Promise<boolean> {
    // On success the action goes on to /welcome.
    if (await deleteHouseholdAction(typed)) return true;
    toast("Couldn't delete the household. Try again.");
    return false;
  }

  return (
    <Sheet title={`Delete ${household.name}?`} onClose={onClose}>
      <p className="text-ink-muted">This deletes, for everyone, and can&apos;t be undone:</p>
      <ul className="mt-2 space-y-1">
        <li className="flex gap-2">
          <span className="text-danger" aria-hidden="true">•</span>
          {counted(household.recipes, "recipe")}, with their notes, ratings and cooking history
        </li>
        <li className="flex gap-2">
          <span className="text-danger" aria-hidden="true">•</span>
          {counted(household.plans, "meal plan")}
        </li>
        <li className="flex gap-2">
          <span className="text-danger" aria-hidden="true">•</span>
          {others.length > 0
            ? `The household itself: ${listNames(others)} lose${others.length === 1 ? "s" : ""} access`
            : "The household itself"}
        </li>
      </ul>
      <DownloadFirst count={household.recipes} />
      <TypeNameToConfirm name={household.name} action="Delete household" onConfirm={remove} onClose={onClose} />
    </Sheet>
  );
}

/**
 * Where the household and its recipes go (designs J and L): the button stays
 * off until the name matches, ignoring case and spaces at the ends.
 */
function TypeNameToConfirm({
  name,
  action,
  onConfirm,
  onClose,
}: {
  name: string;
  action: string;
  /** True when it worked (and the page is moving on). */
  onConfirm: (typed: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  async function confirm() {
    setBusy(true);
    if (!(await onConfirm(typed))) setBusy(false);
  }

  return (
    <>
      <label className="block mt-4">
        <span className="text-sm font-medium">
          Type <b>{name}</b> to confirm
        </span>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          className="mt-1.5 w-full h-12 px-4 rounded-control bg-surface-2 border border-line text-[17px] focus:outline-none focus:border-2 focus:border-primary"
        />
      </label>
      <button type="button" disabled={!matches || busy} onClick={confirm} className={buttonClasses("danger", "mt-5 w-full")}>
        {action}
      </button>
      <button type="button" onClick={onClose} className="mt-2 w-full h-12 rounded-control font-semibold hover:bg-surface-2">
        Cancel
      </button>
    </>
  );
}
