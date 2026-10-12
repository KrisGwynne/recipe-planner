import { Nav } from "@/components/nav";
import { requireHousehold } from "@/households/session";

/**
 * The app shell: page content plus the main navigation. Every page in it
 * needs a signed-in user with a household (otherwise: sign-in, or /welcome to
 * create one). On phones the content leaves room at the bottom for the fixed
 * tab bar and the home indicator.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireHousehold();
  return (
    <div className="min-h-dvh md:flex">
      <Nav />
      <div className="flex-1 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
    </div>
  );
}
