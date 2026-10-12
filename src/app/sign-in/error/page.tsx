import type { Metadata } from "next";
import { HOME } from "@/auth/redirect";
import { GoogleSignIn } from "@/components/google-sign-in";
import { Icon } from "@/components/icon";

export const metadata: Metadata = { title: "Sign-in didn't work" };

// Onboarding design G. Plain language and one way forward; Auth.js logs the
// error code on the server, so it isn't shown here.
export default function SignInErrorPage() {
  return (
    <main className="mx-auto max-w-md min-h-dvh px-5 flex flex-col justify-center">
      <div className="rounded-card bg-surface border border-line p-6 text-center">
        <span className="mx-auto size-14 rounded-full bg-danger-soft text-danger grid place-items-center">
          <Icon name="alert" className="size-7" />
        </span>
        <h1 className="font-display text-xl font-semibold mt-4">Sign-in didn&apos;t work</h1>
        <p className="mt-1 text-ink-muted">Google didn&apos;t complete the sign-in, or it was cancelled. Nothing has changed.</p>
        <div className="mt-5">
          <GoogleSignIn redirectTo={HOME} label="Try again" />
        </div>
      </div>
    </main>
  );
}
