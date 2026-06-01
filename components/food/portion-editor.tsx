"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Star } from "lucide-react";
import type { NormalizedFood } from "@/lib/food/types";
import { scaleNutrition, suggestPortion } from "@/lib/food/normalize";
import type { AmountUnit } from "@/lib/types";
import { addFoodEntry, isFoodSaved, toggleSavedFood, useAppData } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";

const UNITS: AmountUnit[] = ["g", "ml", "serving", "piece"];

export function PortionEditor({
  food,
  onAdded,
  date,
}: {
  food: NormalizedFood;
  onAdded: () => void;
  date?: string;
}) {
  const data = useAppData();
  const suggested = useRef(suggestPortion(food)).current;
  const [amount, setAmount] = useState(suggested.amount);
  const [unit, setUnit] = useState<AmountUnit>(suggested.unit);
  const [toast, setToast] = useState<string | null>(null);

  const valid = amount > 0;
  const scaled = scaleNutrition(food, amount || 0, unit);
  const source = food.source === "usda" ? "usda" : "open_food_facts";
  // Reflect persistent saved state (matched by fingerprint, not amount).
  void data; // re-render when savedMeals change
  const saved = isFoodSaved({
    source,
    externalId: food.externalId,
    barcode: food.barcode,
    name: food.name,
  });

  const add = () => {
    if (!valid) return;
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
      date,
    });
    onAdded();
  };

  const save = () => {
    if (!valid && !saved) return;
    const nowSaved = toggleSavedFood({
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
    setToast(nowSaved ? "Saved to favorites" : "Removed from favorites");
    window.setTimeout(() => setToast(null), 1500);
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
          <AmountInput value={amount} onValueChange={setAmount} aria-label="Amount" />
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

      {!valid && (
        <p className="text-xs text-amber-300">Enter an amount greater than 0.</p>
      )}

      <div className="flex gap-2">
        <Button onClick={add} size="lg" disabled={!valid} className="flex-1">
          <Plus className="h-5 w-5" /> Add
        </Button>
        <Button
          onClick={save}
          variant="secondary"
          size="lg"
          disabled={!valid && !saved}
          className="px-4"
        >
          <Star className={`h-5 w-5 ${saved ? "fill-accent text-accent" : ""}`} />
          {saved ? "Saved" : "Save"}
        </Button>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed inset-x-0 bottom-24 z-[80] mx-auto flex w-fit items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-glow"
          >
            <Star className="h-4 w-4 fill-white" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
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
