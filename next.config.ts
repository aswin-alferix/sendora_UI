import type { NextConfig } from "next";

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // `fallback` runs only after every Next.js route (including dynamic API
      // routes) fails to match. The existing app/api handlers keep working, and
      // anything they don't serve (/api/auth/*, /api/health, …) goes to the
      // NestJS API on the same origin, so auth cookies stay first-party.
      // Remove each app/api handler as its endpoint moves to the backend.
      fallback: [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }],
    };
  },
};

export default nextConfig;
