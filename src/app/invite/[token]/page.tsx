import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { Avatar } from "@/components/avatar";
import { GoogleSignIn } from "@/components/google-sign-in";
import { buttonClasses } from "@/components/ui/button";
import { INVITE_DAYS, getInvite, type InvitePreview } from "@/data";
import { firstName } from "@/lib/format";
import { joinAction, notYouAction } from "./actions";

// Invite links are secrets: keep them out of search engines.
export const metadata: Metadata = { title: "Invite", robots: { index: false, follow: false } };

// Onboarding designs D (signed out), E (signed in) and F (can't be used).
// Until someone joins, only the inviter's name and photo and the household
// name are shown.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  const user = session?.user?.id ? session.user : null;
  const invite = await getInvite(token, user?.id ?? null);
  const signedIn = user !== null;

  if (!invite) {
    return (
      <Problem title="This invite link isn't valid" action={home(signedIn)}>
        Check you have the whole link, or ask for a new one.
      </Problem>
    );
  }

  const inviter = firstName(invite.inviter.name);
  const them = inviter ?? "the person who invited you";
  const { you } = invite;

  if (you.kind === "member") {
    return (
      <Problem title="You're already a member">
        You&apos;re in {invite.householdName}.{" "}
        <Link href="/recipes" className="font-semibold text-primary">
          Go to recipes
        </Link>
      </Problem>
    );
  }
  if (invite.status === "expired") {
    return (
      <Problem title="This invite has expired" action={home(signedIn)}>
        Invite links last {INVITE_DAYS} days. Ask {them} for a new one.
      </Problem>
    );
  }
  if (invite.status === "used") {
    return (
      <Problem title="This invite has already been used" action={home(signedIn)}>
        Each link works once. If that wasn&apos;t you, ask {them} for a new one.
      </Problem>
    );
  }
  if (invite.status === "revoked") {
    return (
      <Problem title="This invite was cancelled" action={home(signedIn)}>
        {inviter ?? "The person who invited you"} turned this link off. Ask them for a new one if you still need it.
      </Problem>
    );
  }
  if (you.kind === "other-household") {
    return (
      <Problem
        title="You're already in a household"
        action={{ href: "/household", label: "Go to Household settings" }}
      >
        You can be in one household at a time. To join {invite.householdName}, leave {you.householdName} first in
        Household settings. Its recipes stay with its other members.
      </Problem>
    );
  }

  return (
    <main className="mx-auto max-w-md min-h-dvh flex flex-col">
      <div className="flex-1 px-6 pt-16 text-center">
        <Invitation invite={invite} />
        {signedIn ? (
          <p className="mt-6 text-sm text-ink-muted rounded-control bg-surface-2 px-4 py-3 text-left">
            As a member you can import recipes, edit notes and plan meals. {inviter ?? "The owner"} manages members and
            invites.
          </p>
        ) : (
          <p className="mt-3 text-[17px] leading-[26px] text-ink-muted">
            Share recipes and meal plans in Recipe planner. Sign in with Google to accept.
          </p>
        )}
      </div>
      <div className="px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {signedIn ? (
          <>
            <form action={joinAction.bind(null, token)}>
              <button type="submit" className={buttonClasses("primary", "w-full")}>
                Join {invite.householdName}
              </button>
            </form>
            <form action={notYouAction.bind(null, token)} className="mt-3 text-center text-sm text-ink-muted">
              Signed in as {user.email} ·{" "}
              <button type="submit" className="font-semibold text-primary">
                Not you?
              </button>
            </form>
          </>
        ) : (
          <>
            <GoogleSignIn redirectTo={`/invite/${token}`} label="Continue with Google" />
            <p className="mt-4 text-center text-xs text-ink-subtle">
              By continuing you agree to the{" "}
              <Link href="/terms" className="underline">
                terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline">
                privacy policy
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Invitation({ invite }: { invite: InvitePreview }) {
  return (
    <>
      <div className="flex justify-center">
        <Avatar name={invite.inviter.name} image={invite.inviter.image} className="ring-4 ring-bg" />
      </div>
      <p className="mt-5 text-ink-muted">{invite.inviter.name ?? "Someone"} invited you to join</p>
      <h1 className="font-display text-[30px] leading-9 font-semibold mt-1">{invite.householdName}</h1>
    </>
  );
}

/** The way on from a problem page: into the app, or to sign-in. */
function home(signedIn: boolean) {
  return signedIn ? { href: "/recipes", label: "Go to recipes" } : { href: "/sign-in", label: "Go to sign in" };
}

/** Screen F: why an invite can't be used, as a full page, with a way on. */
function Problem({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-md min-h-dvh px-5 flex flex-col justify-center">
      <div className="rounded-card bg-surface border border-line p-5">
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-ink-muted">{children}</p>
        {action && (
          <Link href={action.href} className={buttonClasses("secondary", "mt-4 h-11 px-4 w-full")}>
            {action.label}
          </Link>
        )}
      </div>
    </main>
  );
}
