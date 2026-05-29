import type { Metadata } from "next";

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    title: "Vera Bar",
  },
};

export default function BarRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
