import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const display = IBM_Plex_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "QR Order — Ordering & payments for hospitality",
    template: "%s — QR Order",
  },
  description:
    "QR-based guest ordering, live kitchen operations, and Stripe payments for restaurants, bars, and hotel F&B. KassenSichV compliant. Made in Germany.",
  metadataBase: new URL("https://qr-order-iota.vercel.app"),
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "QR Order — Ordering & payments for hospitality",
    description:
      "Scan. Order. Pay. Enterprise ordering infrastructure for hospitality venues.",
    url: "https://qr-order-iota.vercel.app",
    siteName: "QR Order",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "QR Order",
    description: "Enterprise ordering & payments for hospitality",
  },
  robots: { index: true, follow: true },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <PwaRegister />
          {children}
          <Toaster richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
