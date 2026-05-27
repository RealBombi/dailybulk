"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { addFoodEntry } from "@/lib/store";
import { Button } from "@/components/ui/button";

const PRESETS = [100, 250, 500];

export function QuickAddTab({ onAdded }: { onAdded: () => void }) {
  const [calories, setCalories] = useState("");

  const add = (value: number) => {
    if (!value || value <= 0) return;
    addFoodEntry({
      name: "Quick calories",
      calories: value,
      amount: 1,
      amountUnit: "serving",
      source: "manual",
    });
    setCalories("");
    onAdded();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-white/50">
        Just need the number? Log calories without the details.
      </p>
      <input
        value={calories}
        onChange={(e) => setCalories(e.target.value)}
        inputMode="numeric"
        placeholder="Calories"
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-3xl font-bold outline-none focus:border-accent/60"
      />
      <div className="flex gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setCalories(String((Number(calories) || 0) + p))}
            className="tap flex-1 rounded-2xl bg-white/5 py-3 text-sm font-medium text-white/70"
          >
            +{p}
          </button>
        ))}
      </div>
      <Button size="lg" onClick={() => add(Number(calories))}>
        <Zap className="h-5 w-5" /> Quick add
      </Button>
    </div>
  );
}
