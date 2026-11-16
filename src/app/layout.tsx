import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "receipt-pro"
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
      <body>{children}</body>
    </html>
  );
}
