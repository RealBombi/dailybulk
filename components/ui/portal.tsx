"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into document.body so fixed-position overlays cover the
 * whole viewport, escaping any ancestor with a `transform` (e.g. animated
 * page wrappers) that would otherwise become their containing block.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
