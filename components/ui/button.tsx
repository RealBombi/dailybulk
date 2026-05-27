"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "success" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-accent to-violet-500 text-white shadow-glow hover:brightness-110",
  secondary: "bg-white/[0.06] text-white border border-white/10 hover:bg-white/10",
  ghost: "text-white/70 hover:text-white hover:bg-white/5",
  success:
    "bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-[0_0_30px_-8px_rgba(16,185,129,0.6)]",
  danger: "bg-red-500/15 text-red-300 border border-red-500/20 hover:bg-red-500/25",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-xl",
  md: "h-11 px-4 text-sm rounded-2xl",
  lg: "h-14 px-6 text-base rounded-2xl",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "tap inline-flex items-center justify-center gap-2 font-semibold disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
