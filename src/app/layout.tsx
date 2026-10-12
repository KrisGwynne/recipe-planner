import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Recipe planner", template: "%s · Recipe planner" },
  description: "Plan recipes and meals with your household.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the bottom navigation pad for the phone's safe area (PP-145).
  viewportFit: "cover",
};

// Every page is rendered per request, so Next can add the CSP nonce from
// src/proxy.ts to its scripts (a prerendered page has no nonce and would be
// blocked). Nearly every page already was, because it reads the session.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
