import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { safeCallbackPath } from "@/auth/redirect";
import { GoogleSignIn } from "@/components/google-sign-in";
import { Icon, type IconName } from "@/components/icon";

export const metadata: Metadata = { title: "Sign in" };

const features: { icon: IconName; text: string }[] = [
  { icon: "search", text: "Find a recipe by carbs, protein, time or book" },
  { icon: "calendar", text: "Plan meals and see daily calories and protein" },
  { icon: "users", text: "Share it all with the people you cook with" },
];

// Onboarding design A. Google is the only way in, so this one button signs
// up and signs in. Signed-in visitors go straight on. After deleting an
// account (PP-158) it says so (household design M).
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const redirectTo = safeCallbackPath(params.callbackUrl);
  const deleted = params.deleted === "1";
  if (await auth()) redirect(redirectTo);

  return (
    <main className="mx-auto max-w-md min-h-dvh flex flex-col md:justify-center">
      <div className="flex-1 px-6 pt-14 md:flex-none">
        {deleted && (
          <p role="status" className="mb-8 rounded-control bg-veg-soft text-veg px-4 py-3 text-sm font-medium flex gap-3">
            <Icon name="check" className="size-5 shrink-0" strokeWidth={2.5} />
            Your account has been deleted.
          </p>
        )}
        <span className="size-14 rounded-2xl bg-primary text-on-primary grid place-items-center shadow-lg">
          <Icon name="book" className="size-8" />
        </span>
        <h1 className="font-display text-[34px] leading-[40px] font-semibold mt-6">Your recipe book, on your phone.</h1>
        <p className="mt-3 text-[17px] leading-[26px] text-ink-muted">
          Keep your household&apos;s recipes in one place, plan the week&apos;s meals, and see what you&apos;re eating.
        </p>
        <ul className="mt-6 space-y-3">
          {features.map(({ icon, text }) => (
            <li key={icon} className="flex gap-3">
              <span className="size-9 shrink-0 rounded-full bg-primary-soft text-primary grid place-items-center">
                <Icon name={icon} className="size-5" />
              </span>
              <span className="pt-1.5">{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <GoogleSignIn redirectTo={redirectTo} label="Continue with Google" />
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
      </div>
    </main>
  );
}
