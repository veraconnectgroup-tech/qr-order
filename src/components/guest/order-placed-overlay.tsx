"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { AnimatedOrderNumber } from "@/components/guest/animated-order-number";

export function OrderPlacedOverlay({
  orderNumber,
  onComplete,
}: {
  orderNumber: number;
  onComplete: () => void;
}) {
  const { tUI } = useAppLocale();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const delay = reduceMotion ? 500 : 2000;
    const timer = window.setTimeout(onComplete, delay);
    return () => window.clearTimeout(timer);
  }, [onComplete, reduceMotion]);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 px-6 text-center"
    >
      <motion.div
        initial={reduceMotion ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", damping: 14, stiffness: 220, delay: 0.05 }
        }
        className="flex size-24 items-center justify-center rounded-full bg-green-500/15"
      >
        <Check className="size-12 text-green-500" strokeWidth={2.5} />
      </motion.div>
      <motion.h1
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduceMotion ? { duration: 0 } : { delay: 0.15, duration: 0.25 }
        }
        className="text-heading mt-6 text-zinc-50"
      >
        {tUI("order.placedTitle")}
      </motion.h1>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduceMotion ? { duration: 0 } : { delay: 0.25, duration: 0.25 }
        }
        className="mt-3"
      >
        <AnimatedOrderNumber orderNumber={orderNumber} />
      </motion.div>
    </motion.div>
  );
}
