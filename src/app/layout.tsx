import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StorePilot — Store Management",
  description: "A mobile-first inventory, sales and store operations platform.",
  applicationName: "StorePilot",
  manifest: "/manifest.webmanifest"
};
export const viewport: Viewport = { themeColor: "#152b4a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
