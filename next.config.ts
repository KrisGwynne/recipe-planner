import type { NextConfig } from "next";
import { securityHeaders } from "./src/security/headers";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // Google profile photos (avatars).
    remotePatterns: [new URL("https://lh3.googleusercontent.com/**")],
  },
  // The fixed security headers; the Content-Security-Policy, which needs a
  // nonce per request, is set in src/proxy.ts.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
