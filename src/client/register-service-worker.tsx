"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js (T-014). Production builds only: in `next dev` a service worker would
 * outlive the dev server on that address. Browsers allow service workers only over HTTPS and on
 * localhost, so on the home network's plain HTTP this does nothing.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error: unknown) => {
        console.warn("[receipt-pro] Service worker registration failed:", error);
      });
  }, []);
  return null;
}
