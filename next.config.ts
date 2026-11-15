import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The phone opens the dev server by the Mac's LAN address. Next.js blocks dev-only
  // requests from origins other than localhost unless they are listed here.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"]
};

export default nextConfig;
