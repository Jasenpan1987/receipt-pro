import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RegisterServiceWorker } from "src/client/register-service-worker";

export const metadata: Metadata = {
  title: "receipt-pro",
  // The manifest itself is src/app/manifest.ts. iPhones take the home-screen icon from
  // apple-touch-icon, not from the manifest (T-014).
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png"
  },
  appleWebApp: {
    capable: true,
    title: "receipt-pro",
    // The page keeps its own background under the status bar; nothing slides beneath it.
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The bottom bar reaches the screen edge and pads itself above the iPhone's home indicator.
  viewportFit: "cover",
  themeColor: "#faf6f0"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
