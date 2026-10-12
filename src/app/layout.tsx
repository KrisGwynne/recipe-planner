import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recipe planner",
  description: "Plan recipes and meals with your household.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the bottom navigation pad for the phone's safe area (PP-145).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
