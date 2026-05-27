"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type GaugeProps = {
  /** 0–100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Sweep angle in degrees (360 = full circle, 270 = open-bottom dial). */
  sweep?: number;
  gradientFrom?: string;
  gradientTo?: string;
  trackClassName?: string;
  className?: string;
  children?: React.ReactNode;
};

let gradientCounter = 0;

/**
 * Ali Imam-style circular gauge: a gradient progress arc over a soft track,
 * animated as the value changes. Pass content via children to render in the
 * centre (big numbers, labels, etc.).
 */
export function Gauge({
  value,
  size = 220,
  strokeWidth = 16,
  sweep = 300,
  gradientFrom = "#818cf8",
  gradientTo = "#22d3ee",
  trackClassName,
  className,
  children,
}: GaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (sweep / 360) * circumference;
  const gap = circumference - arcLength;
  const dashOffset = arcLength * (1 - clamped / 100);
  // Rotate so the arc is centred at the bottom opening.
  const rotation = 90 + (360 - sweep) / 2;
  const id = `gauge-grad-${gradientCounter++}`;

  return (
    <div
      className={cn("relative", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="block">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="100%" stopColor={gradientTo} />
          </linearGradient>
        </defs>
        <g transform={`rotate(${rotation} ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${gap}`}
            className={cn("stroke-white/[0.07]", trackClassName)}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            // Gap spans the whole circumference so the single dash never
            // repeats — the offset then controls the visible fill length.
            strokeDasharray={`${arcLength} ${circumference}`}
            initial={false}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
            style={{ filter: "drop-shadow(0 0 8px rgba(129,140,248,0.45))" }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
