import type { NextConfig } from "next";

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
console.log(backendUrl)
const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // Every /api/* request goes to the NestJS API (sendors_API) on the same
      // origin, so its httpOnly auth cookies stay first-party. `beforeFiles`
      // runs before Next.js routes, so the old src/app/api handlers can never
      // shadow the backend, even if their files are still on disk.
      beforeFiles: [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }],
    };
  },
};

export default nextConfig;
