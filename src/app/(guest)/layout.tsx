import { GuestAccessibilityLayout } from "@/components/guest/guest-accessibility-layout";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GuestAccessibilityLayout>{children}</GuestAccessibilityLayout>;
}
