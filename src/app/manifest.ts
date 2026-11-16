import type { MetadataRoute } from "next";

/**
 * Served at /manifest.webmanifest (T-014): "add to home screen" installs the app, which then opens
 * full screen on the receipt list. Browsers fetch it without the login cookie, so it is public
 * (src/proxy.ts). Colours: design B (src/app/globals.css).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "receipt-pro",
    short_name: "receipt-pro",
    lang: "zh-CN",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf6f0",
    theme_color: "#faf6f0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The character sits inside the safe circle (public/icons/icon.svg), so Android may crop it.
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
