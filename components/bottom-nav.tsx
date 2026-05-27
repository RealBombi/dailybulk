"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, UtensilsCrossed, Pill, LineChart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/food", label: "Food", icon: UtensilsCrossed },
  { href: "/creatine", label: "Creatine", icon: Pill },
  { href: "/weight", label: "Weight", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto flex max-w-md items-center justify-between rounded-3xl border border-white/10 bg-bg-soft/80 px-2 py-2 backdrop-blur-xl shadow-card">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-1 flex-col items-center gap-1 py-2 tap"
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="pointer-events-none absolute inset-0 rounded-2xl bg-white/[0.07]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon
                className={cn(
                  "relative h-5 w-5 transition-colors",
                  active ? "text-accent-soft" : "text-white/45",
                )}
                strokeWidth={active ? 2.4 : 2}
              />
              <span
                className={cn(
                  "relative text-[10px] font-medium transition-colors",
                  active ? "text-white" : "text-white/40",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
