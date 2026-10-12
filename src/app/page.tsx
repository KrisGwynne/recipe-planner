import { redirect } from "next/navigation";

// Until sign-in (PP-153) brings a landing page, the app opens on the library.
export default function Home() {
  redirect("/recipes");
}
