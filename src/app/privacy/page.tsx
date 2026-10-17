import type { Metadata } from "next";
import { LegalPage, Points, Section } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

// designs/src/legal.html A. Kris, 2026-10-17: no name or email address; the
// database is with Neon in London; there are no backups. Keep this in step
// with what the app really stores.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p className="mt-4">
        Recipe planner is a personal project run from the UK. This page says what it stores about you, who can see it, and
        how to delete it.
      </p>

      <Section title="What's stored">
        <Points>
          <li>
            <b className="font-semibold">From Google, when you sign in:</b> your name, email address and profile photo, and
            the ID Google gives your account. The app never sees your Google password.
          </li>
          <li>
            <b className="font-semibold">Your household:</b> its name, who&apos;s in it and whether they&apos;re an owner, and
            invite links (stored only in a scrambled form, and they stop working after 7 days).
          </li>
          <li>
            <b className="font-semibold">What you add:</b> the recipes you import, and your household&apos;s favourites,
            ratings, notes, cooking history and meal plans.
          </li>
          <li>
            <b className="font-semibold">To keep it working:</b> a sign-in cookie (it lasts 30 days), how many recipes
            you&apos;ve imported in the last hour (to stop the app being flooded), and the name of the household you last
            left, to tell you you&apos;re no longer in it.
          </li>
          <li>
            <b className="font-semibold">On your device:</b> a cookie remembering whether you like the library as cards or a
            list, and your last comparison, which stays in your browser.
          </li>
        </Points>
      </Section>

      <Section title="Who can see it">
        <p className="mt-2">
          The people in your household see its recipes, plans and notes, and each other&apos;s names, email addresses and
          photos. Nobody outside your household does. Nothing is sold or shared, and there are no adverts, analytics or
          trackers.
        </p>
      </Section>

      <Section title="Where it's kept">
        <p className="mt-2">
          The app runs on Vercel and its database is with Neon, in London. Google handles signing in. Each of them only
          processes your data to run the app.
        </p>
      </Section>

      <Section title="How long it's kept">
        <p className="mt-2">
          Until you delete it. Sign-ins end after 30 days without use, and the import count after an hour. There are no
          backups, so anything deleted is gone for good.
        </p>
      </Section>

      <Section title="Deleting it">
        <p className="mt-2">All of this is on the Household tab, and works straight away:</p>
        <Points>
          <li>
            <b className="font-semibold">Download all recipes</b> gives you a copy of every recipe file first, if you want
            one.
          </li>
          <li>
            <b className="font-semibold">Delete my account</b> deletes your Google details, sign-ins and membership. Recipes,
            notes and plans you added to a shared household stay with it, without your name.
          </li>
          <li>
            <b className="font-semibold">Delete household</b> (owners) deletes its recipes, plans, notes and invite links for
            everyone.
          </li>
        </Points>
      </Section>

      <Section title="Your rights">
        <p className="mt-2">
          You can get a copy of your recipes, change your household&apos;s data, and delete your account at any time, all in
          the app. Your name, email address and photo come from your Google account, so change them there. If you&apos;re
          unhappy with how your data is handled, you can complain to the Information Commissioner&apos;s Office
          (ico.org.uk).
        </p>
      </Section>

      <Section title="Changes">
        <p className="mt-2">If this policy changes, the date at the top changes too. Big changes will be shown in the app first.</p>
      </Section>
    </LegalPage>
  );
}
