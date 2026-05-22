import { toast } from "sonner";
import { formatPrice } from "@/lib/format";

export function toastAddedToCart(
  productName: string,
  lineTotal: number,
  currency: string
) {
  toast.success(`${productName} · ${formatPrice(lineTotal, currency)}`, {
    description: "Added to cart",
    duration: 3000,
    classNames: {
      toast:
        "bg-zinc-900! border border-zinc-800! border-l-[3px]! border-l-orange-500! text-zinc-50!",
      description: "text-zinc-400!",
    },
  });
}
