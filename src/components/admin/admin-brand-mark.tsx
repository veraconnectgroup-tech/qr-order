import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { cn } from "@/lib/utils";

/** Product brand lockup: Denis primary, Vera Group attribution. */
export function AdminBrandMark({ className }: { className?: string }) {
  return <DenisBrandMark className={className} />;
}
