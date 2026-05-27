"use client";

import { useState } from "react";
import { Bookmark, Plus } from "lucide-react";
import type { NormalizedFood } from "@/lib/food/types";
import { scaleNutrition } from "@/lib/food/normalize";
import type { AmountUnit } from "@/lib/types";
import { addFoodEntry, addSavedMeal } from "@/lib/store";
import { Button } from "@/components/ui/button";

const UNITS: AmountUnit[] = ["g", "ml", "serving", "piece"];

export function PortionEditor({
  food,
  onAdded,
}: {
  food: NormalizedFood;
  onAdded: () => void;
}) {
  const [amount, setAmount] = useState(100);
  const [unit, setUnit] = useState<AmountUnit>("g");
  const [saved, setSaved] = useState(false);

  const scaled = scaleNutrition(food, amount || 0, unit);
  const source = food.source === "usda" ? "usda" : "open_food_facts";

  const add = () => {
    addFoodEntry({
      name: food.name,
      brand: food.brand,
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      amount: amount || 0,
      amountUnit: unit,
      source,
      externalId: food.externalId,
      barcode: food.barcode,
    });
    onAdded();
  };

  const save = () => {
    addSavedMeal({
      name: food.name,
      brand: food.brand,
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      amount: amount || 0,
      amountUnit: unit,
      source,
      externalId: food.externalId,
      barcode: food.barcode,
    });
    setSaved(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-base font-semibold leading-tight">{food.name}</p>
        {food.brand && <p className="text-sm text-white/50">{food.brand}</p>}
        {food.servingSize && (
          <p className="mt-1 text-xs text-white/40">
            Serving: {food.servingSize}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-white/50">Amount</label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            min={0}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold outline-none focus:border-accent/60"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 pt-5">
          {UNITS.map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`tap rounded-xl px-3 py-2 text-sm ${
                unit === u
                  ? "bg-accent text-white"
                  : "bg-white/5 text-white/60"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 rounded-2xl bg-white/[0.03] p-3 text-center">
        <Macro label="kcal" value={scaled.calories} />
        <Macro label="protein" value={scaled.protein} suffix="g" />
        <Macro label="carbs" value={scaled.carbs} suffix="g" />
        <Macro label="fat" value={scaled.fat} suffix="g" />
      </div>

      <div className="flex gap-2">
        <Button onClick={add} size="lg" className="flex-1">
          <Plus className="h-5 w-5" /> Add to today
        </Button>
        <Button
          onClick={save}
          variant="secondary"
          size="lg"
          disabled={saved}
          className="px-4"
        >
          <Bookmark className="h-5 w-5" />
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function Macro({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value?: number;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-lg font-bold tabular-nums">
        {value === undefined ? "–" : Math.round(value)}
        <span className="text-xs font-normal text-white/40">{suffix}</span>
      </p>
      <p className="text-[10px] uppercase tracking-wide text-white/40">
        {label}
      </p>
    </div>
  );
}
