import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { accounts, sessions, users } from "@/db/schema";
import { resolveRedirect } from "./redirect";

// Google is the only way in. Database sessions, Auth.js's default 30 days
// (decisions 2026-10-11). Reads AUTH_SECRET, AUTH_GOOGLE_ID and
// AUTH_GOOGLE_SECRET from the environment. The config is built per request so
// builds don't need DATABASE_URL.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), { usersTable: users, accountsTable: accounts, sessionsTable: sessions }),
  providers: [Google],
  session: { strategy: "database" },
  pages: { signIn: "/sign-in", error: "/sign-in/error" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
    redirect({ url, baseUrl }) {
      return resolveRedirect(url, baseUrl);
    },
  },
  trustHost: true,
}));

/** The signed-in user, or a redirect to sign-in. For pages that need one. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return { ...session.user, id: session.user.id };
}
