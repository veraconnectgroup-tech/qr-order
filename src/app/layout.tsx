import type { Metadata } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = DM_Serif_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Vera — Die Plattform für Gastronomie",
    template: "%s — Vera",
  },
  description:
    "Bestellung, Küche, Zahlung und Analyse für Gastronomie in Deutschland. KassenSichV-konform. 0 € / Monat.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://qr-order-iota.vercel.app"
  ),
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Vera — Die Plattform für Gastronomie",
    description:
      "Bestellung. Küche. Zahlung. Die All-in-One Plattform für Gastronomie.",
    siteName: "Vera",
    locale: "de_DE",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vera",
    description: "Die All-in-One Plattform für Gastronomie in Deutschland",
    images: ["/opengraph-image"],
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
      lang="de"
      className={`${inter.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <PwaRegister />
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
