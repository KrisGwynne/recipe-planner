import { requireUser } from "@/auth";
import { Nav } from "@/components/nav";

/**
 * The app shell: page content plus the main navigation. Every page in it
 * needs a signed-in user. On phones the content leaves room at the bottom for
 * the fixed tab bar and the home indicator.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="min-h-dvh md:flex">
      <Nav />
      <div className="flex-1 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
    </div>
  );
}
