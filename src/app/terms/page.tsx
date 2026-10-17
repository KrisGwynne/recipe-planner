import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms" };

// designs/src/legal.html B. Kris, 2026-10-17: no name or email address; there
// are no backups; nutrition is a guide, not advice.
export default function TermsPage() {
  return (
    <LegalPage title="Terms">
      <p className="mt-4">
        Recipe planner is a free personal project run from the UK. By signing in you agree to these terms. They&apos;re
        short on purpose.
      </p>

      <Section title="The app">
        <p className="mt-2">
          It&apos;s provided as it is, without a guarantee that it&apos;ll always work or always be here. If it&apos;s ever
          going to close, you&apos;ll be told in the app in time to download your recipes.
        </p>
      </Section>

      <Section title="Your recipes">
        <p className="mt-2">
          What you import stays yours; you let the app store it and show it to your household. You&apos;re responsible for
          it. Recipes copied from books and magazines are for your household&apos;s own cooking: don&apos;t use the app to
          publish other people&apos;s work.
        </p>
      </Section>

      <Section title="Nutrition">
        <p className="mt-2">
          Nutrition is copied from the recipe or estimated, and estimates (marked ~) can be well out. It&apos;s a guide, not
          medical or dietary advice.
        </p>
      </Section>

      <Section title="Using it fairly">
        <p className="mt-2">
          Don&apos;t use it for anything illegal, try to get at other households&apos; data, or try to overload it (there are
          limits on imports for this reason). Accounts that do may be removed.
        </p>
      </Section>

      <Section title="Leaving">
        <p className="mt-2">
          You can delete your account at any time from the Household tab; the{" "}
          <Link href="/privacy" className="underline underline-offset-2 text-primary">
            privacy policy
          </Link>{" "}
          says what that deletes.
        </p>
      </Section>

      <Section title="The legal part">
        <p className="mt-2">
          As far as the law allows, the app isn&apos;t liable for any loss from using it, including lost recipes. There are
          no backups, so keep a download of anything you&apos;d miss. Nothing here affects your rights as a consumer. These
          terms are under the law of England and Wales.
        </p>
      </Section>
    </LegalPage>
  );
}
