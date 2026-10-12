import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // Google profile photos (avatars).
    remotePatterns: [new URL("https://lh3.googleusercontent.com/**")],
  },
  experimental: {
    // Imports send recipe files in requests of up to 3 MB (src/recipes/review.ts),
    // under Vercel's 4.5 MB request limit.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
