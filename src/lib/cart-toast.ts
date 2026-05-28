import { toast } from "sonner";
import { formatPrice } from "@/lib/format";

export function toastAddedToCart(
  productName: string,
  lineTotal: number,
  currency: string
) {
  toast.success("Added to cart", {
    description: `${productName} · ${formatPrice(lineTotal, currency)}`,
    duration: 3000,
    position: "top-center",
    classNames: {
      toast:
        "bg-zinc-900! border border-zinc-800! border-l-[3px]! border-l-orange-500! text-zinc-50!",
      description: "text-zinc-400!",
    },
  });
}
