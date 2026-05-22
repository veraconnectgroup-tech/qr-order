"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function HeroFloat({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.75, delay, ease }}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={
          reduce
            ? undefined
            : { duration: 5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.5 }
        }
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function HeroSlideIn({
  children,
  className,
  from = "right",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  from?: "left" | "right" | "bottom";
  delay?: number;
}) {
  const offset =
    from === "left"
      ? { x: -24, y: 12 }
      : from === "bottom"
        ? { x: 0, y: 24 }
        : { x: 24, y: 12 };

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

export function HeroGlow({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full bg-orange-500/[0.07] blur-3xl",
        className
      )}
      animate={
        reduce
          ? undefined
          : { opacity: [0.5, 0.85, 0.5], scale: [1, 1.05, 1] }
      }
      transition={
        reduce ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }
      }
    />
  );
}

export function ShowcaseReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, delay, ease }}
    >
      {children}
    </motion.div>
  );
}
