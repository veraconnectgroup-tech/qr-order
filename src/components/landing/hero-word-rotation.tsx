"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const WORDS = ["Restaurants", "Bars", "Hotels", "Cafés", "Kantinen"];

export function HeroWordRotation() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % WORDS.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [reduce]);

  const word = WORDS[index];

  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-x-2 text-[17px] text-zinc-500 sm:text-[18px]">
      <span>Entwickelt für</span>
      <span className="relative inline-flex h-[1.4em] min-w-[9ch] overflow-hidden">
        {reduce ? (
          <span className="font-medium text-orange-400">Gastronomie</span>
        ) : (
          <AnimatePresence mode="wait">
            <motion.span
              key={word}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -16, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-0 font-medium text-orange-400"
            >
              {word}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
      <span>in Deutschland.</span>
    </p>
  );
}
