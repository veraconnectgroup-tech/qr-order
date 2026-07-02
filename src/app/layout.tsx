import type { Metadata } from "next";
import {
  Inter,
  IBM_Plex_Sans,
  Bricolage_Grotesque,
  Instrument_Serif,
} from "next/font/google";
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

/* Landing-only display faces — premium grotesque + serif italic accent */
const landingDisplay = Bricolage_Grotesque({
  variable: "--font-landing-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const landingSerif = Instrument_Serif({
  variable: "--font-landing-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Denis — AI waiter that never sleeps · Vera Group",
    template: "%s · Denis · Vera Group",
  },
  description:
    "Guests order by QR; kitchen and floor stay in sync — Denis assists at the table. KassenSichV ready. €0 / month.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://qr-order-iota.vercel.app"
  ),
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Denis — AI waiter that never sleeps · Vera Group",
    description:
      "Ordering, kitchen, payments, and Denis intelligence for hospitality in Germany.",
    siteName: "Denis · Vera Group",
    locale: "en_US",
    alternateLocale: ["de_DE", "sr_RS"],
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Denis · Vera Group",
    description:
      "Hospitality operating system — QR ordering, kitchen display, Denis AI.",
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
  // Let the layout shrink when the mobile keyboard opens (iOS 15+ / Chrome 108+).
  interactiveWidget: "resizes-content" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${inter.variable} ${display.variable} ${landingDisplay.variable} ${landingSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <PwaRegister />
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
