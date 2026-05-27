"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const COLORS = ["#818cf8", "#22d3ee", "#34d399", "#fbbf24", "#f472b6"];

/**
 * A short, premium confetti burst for milestones (e.g. 7-day streak).
 * Renders nothing unless `fire` flips true; auto-clears after the animation.
 */
export function Celebration({ fire }: { fire: boolean }) {
  const [pieces, setPieces] = useState<number[]>([]);

  useEffect(() => {
    if (!fire) return;
    setPieces(Array.from({ length: 36 }, (_, i) => i));
    const t = window.setTimeout(() => setPieces([]), 1600);
    return () => window.clearTimeout(t);
  }, [fire]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      <AnimatePresence>
        {pieces.map((i) => {
          const angle = (i / pieces.length) * Math.PI * 2;
          const dist = 120 + Math.random() * 180;
          return (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/3 h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              animate={{
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist + 200,
                opacity: 0,
                rotate: Math.random() * 540,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
