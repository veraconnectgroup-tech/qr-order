import { requireSurface } from "@/lib/auth/require-surface";

export default async function BarAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSurface("bar");
  return children;
}
