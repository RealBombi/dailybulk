"use client";

import Link from "next/link";
import { Plus, Search, ScanLine, Bookmark, Zap } from "lucide-react";

const shortcuts = [
  { href: "/food?mode=search", label: "Search", icon: Search },
  { href: "/food?mode=barcode", label: "Scan", icon: ScanLine },
  { href: "/food?mode=saved", label: "Saved", icon: Bookmark },
  { href: "/food?mode=quick", label: "Quick", icon: Zap },
];

export function QuickActions() {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/food?mode=manual"
        className="tap flex h-16 items-center justify-center gap-2 rounded-3xl bg-gradient-to-br from-accent to-accent-soft text-lg font-bold text-white shadow-glow"
      >
        <Plus className="h-6 w-6" /> Add food
      </Link>
      <div className="grid grid-cols-4 gap-2">
        {shortcuts.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="glass tap flex flex-col items-center gap-1.5 py-3"
          >
            <Icon className="h-5 w-5 text-accent-soft" />
            <span className="text-[11px] text-white/60">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
