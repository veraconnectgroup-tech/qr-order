import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/waiter/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Vera Waiter",
  },
};

export default function WaiterRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
