"use client";

import { useEffect, useState } from "react";
import { CopyPlus, Copy } from "lucide-react";
import type { FoodEntry } from "@/lib/types";
import { addFoodEntry, useAppData } from "@/lib/store";
import { addDays, parseDateStr, round } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function CopyFromYesterday({
  date,
  onCopied,
}: {
  date: string;
  onCopied: (count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="tap flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm font-medium text-white/80 hover:bg-white/[0.07]"
      >
        <CopyPlus className="h-4 w-4 text-accent-soft" /> Copy from previous day
      </button>
      {open && (
        <CopySheet
          date={date}
          onClose={() => setOpen(false)}
          onCopied={(n) => {
            setOpen(false);
            onCopied(n);
          }}
        />
      )}
    </>
  );
}

function CopySheet({
  date,
  onClose,
  onCopied,
}: {
  date: string;
  onClose: () => void;
  onCopied: (count: number) => void;
}) {
  const data = useAppData();
  const prevDate = addDays(date, -1);
  const source = data.foodEntries
    .filter((e) => e.date === prevDate)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(source.map((e) => e.id)),
  );

  // re-sync selection when the previous day's entries change
  useEffect(() => {
    setSelected(new Set(source.map((e) => e.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevDate]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const copy = () => {
    const picks = source.filter((e) => selected.has(e.id));
    picks.forEach((e) => copyEntry(e, date));
    onCopied(picks.length);
  };

  const allChecked = selected.size === source.length && source.length > 0;
  const prevLabel = parseDateStr(prevDate).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <Sheet open onClose={onClose} title={`Copy from ${prevLabel}`}>
      {source.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/50">
          No foods to copy from {prevLabel}.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={() =>
              setSelected(
                allChecked ? new Set() : new Set(source.map((e) => e.id)),
              )
            }
            className="tap self-start text-xs font-medium text-accent-soft"
          >
            {allChecked ? "Select none" : "Select all"}
          </button>
          <div className="flex flex-col gap-1">
            {source.map((e) => (
              <label
                key={e.id}
                className="tap flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                  className="h-4 w-4 accent-accent"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="truncate text-xs text-white/45">
                    {round(e.calories)} kcal
                    {e.protein !== undefined
                      ? ` · ${round(e.protein)}g protein`
                      : ""}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <Button onClick={copy} size="lg" disabled={selected.size === 0}>
            <Copy className="h-5 w-5" />
            Copy {selected.size} {selected.size === 1 ? "item" : "items"}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function copyEntry(e: FoodEntry, date: string) {
  addFoodEntry({
    name: e.name,
    brand: e.brand,
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    amount: e.amount,
    amountUnit: e.amountUnit,
    source: e.source,
    externalId: e.externalId,
    barcode: e.barcode,
    mealType: e.mealType,
    date,
  });
}
