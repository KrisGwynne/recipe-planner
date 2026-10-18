import type { Metadata } from "next";
import SignInPage from "./sign-in/page";

export const metadata: Metadata = { title: "Recipe planner" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The landing page (onboarding design A; Kris, 2026-10-17): the sign-in page,
// for signed-out visitors. Signed-in visitors go on to their recipes, as the
// sign-in page already does.
export default function Home({ searchParams }: Props) {
  return SignInPage({ searchParams });
}
