import { signIn } from "@/auth";
import { GoogleIcon } from "@/components/icon";

/** Starts Google sign-in, then returns to `redirectTo` (a path on this site). */
export function GoogleSignIn({ redirectTo, label }: { redirectTo: string; label: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo });
      }}
    >
      <button
        type="submit"
        className="w-full h-12 rounded-control bg-surface border border-line shadow-sm font-semibold inline-flex items-center justify-center gap-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <GoogleIcon className="size-5" />
        {label}
      </button>
    </form>
  );
}
