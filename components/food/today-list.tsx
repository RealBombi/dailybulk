"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { FoodEntry } from "@/lib/types";
import { deleteFoodEntry, updateFoodEntry } from "@/lib/store";
import { round } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function TodayList({ entries }: { entries: FoodEntry[] }) {
  const [editing, setEditing] = useState<FoodEntry | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {entries.map((e) => (
        <div
          key={e.id}
          className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{e.name}</p>
            <p className="truncate text-xs text-white/45">
              {round(e.calories)} kcal · {e.amount}
              {e.amountUnit === "serving" || e.amountUnit === "piece"
                ? ` ${e.amountUnit}`
                : e.amountUnit}
              {e.protein !== undefined ? ` · ${round(e.protein)}g P` : ""}
            </p>
          </div>
          <button
            onClick={() => setEditing(e)}
            className="tap rounded-full p-2 text-white/30 hover:text-white"
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => deleteFoodEntry(e.id)}
            className="tap rounded-full p-2 text-white/30 hover:text-red-300"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit amount">
        {editing && (
          <EditAmount entry={editing} onDone={() => setEditing(null)} />
        )}
      </Sheet>
    </div>
  );
}

function EditAmount({
  entry,
  onDone,
}: {
  entry: FoodEntry;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(entry.amount);
  const factor = entry.amount > 0 ? amount / entry.amount : 1;

  const scale = (v?: number) => (v === undefined ? undefined : round(v * factor, 1));

  const save = () => {
    updateFoodEntry(entry.id, {
      amount,
      calories: round(entry.calories * factor),
      protein: scale(entry.protein),
      carbs: scale(entry.carbs),
      fat: scale(entry.fat),
    });
    onDone();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base font-semibold">{entry.name}</p>
      <div>
        <label className="mb-1 block text-xs text-white/50">
          Amount ({entry.amountUnit})
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          min={0}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold outline-none focus:border-accent/60"
        />
      </div>
      <p className="text-sm text-white/50">
        {round(entry.calories * factor)} kcal
        {entry.protein !== undefined
          ? ` · ${scale(entry.protein)}g protein`
          : ""}
      </p>
      <Button size="lg" onClick={save}>
        Save
      </Button>
    </div>
  );
}
