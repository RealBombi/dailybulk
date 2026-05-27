import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Local date as YYYY-MM-DD (not UTC, so "today" matches the user's clock). */
export function toDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function shortDay(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString(undefined, { weekday: "short" });
}

export function round(n: number, digits = 0): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

export function clampPercent(value: number, goal: number): number {
  if (!goal || goal <= 0) return 0;
  return Math.min(Math.round((value / goal) * 100), 100);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/** "#6366f1" -> "99 102 241" for use in rgb(var(--accent) / <alpha>). */
export function hexToRgbChannels(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

/** Lighten a hex colour toward white by `amount` (0–1). */
export function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}
