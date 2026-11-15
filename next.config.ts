import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lambda runs `.next/standalone/server.js`: the server plus only the files it needs (T-013).
  output: "standalone",
  // The phone opens the dev server by the Mac's LAN address. Next.js blocks dev-only
  // requests from origins other than localhost unless they are listed here.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"]
};

export default nextConfig;
