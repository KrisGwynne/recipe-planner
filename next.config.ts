import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // Google profile photos (avatars).
    remotePatterns: [new URL("https://lh3.googleusercontent.com/**")],
  },
};

export default nextConfig;
