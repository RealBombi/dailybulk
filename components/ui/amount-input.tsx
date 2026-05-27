"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Current numeric value (0 is treated as "empty" for display). */
  value: number;
  onValueChange: (n: number) => void;
  className?: string;
  autoFocus?: boolean;
  placeholder?: string;
  "aria-label"?: string;
};

/**
 * A numeric text field that behaves like a normal input: you can fully clear
 * it, it stays empty while typing, and it never forces a leading "0". The
 * parent receives 0 while the field is empty and clamps/validates on submit.
 */
export function AmountInput({
  value,
  onValueChange,
  className,
  autoFocus,
  placeholder,
  "aria-label": ariaLabel,
}: Props) {
  const [text, setText] = useState(value > 0 ? String(value) : "");
  const lastNum = useRef(value);

  // Sync only when the value changes from the outside (e.g. a smart default),
  // never on the user's own keystrokes — that's what caused the "0500" bug.
  useEffect(() => {
    if (value !== lastNum.current) {
      lastNum.current = value;
      setText(value > 0 ? String(value) : "");
    }
  }, [value]);

  const handleChange = (raw: string) => {
    if (raw !== "" && !/^\d*[.,]?\d*$/.test(raw)) return;
    setText(raw);
    const n = Number(raw.replace(",", "."));
    const next = raw.trim() !== "" && !Number.isNaN(n) ? n : 0;
    lastNum.current = next;
    onValueChange(next);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      className={cn(
        "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold outline-none focus:border-accent/60",
        className,
      )}
    />
  );
}
