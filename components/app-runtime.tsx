"use client";

import { useEffect, useRef } from "react";
import { useAppData } from "@/lib/store";
import { hexToRgbChannels, lighten } from "@/lib/utils";

/**
 * Client-side runtime side-effects:
 *  - mirrors the user's accent colour into CSS variables on <html>
 *  - asks the browser to keep storage persistent (best-effort, once)
 */
export function AppRuntime() {
  const { settings } = useAppData();
  const askedPersist = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", hexToRgbChannels(settings.accentColor));
    root.style.setProperty(
      "--accent-soft",
      hexToRgbChannels(lighten(settings.accentColor, 0.25)),
    );
  }, [settings.accentColor]);

  useEffect(() => {
    if (askedPersist.current) return;
    askedPersist.current = true;
    // Reduce the chance the browser evicts our local data. No-op where unsupported.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  return null;
}
