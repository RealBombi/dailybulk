"use client";

import { Plus, Trash2 } from "lucide-react";
import { addFoodEntry, deleteSavedMeal, useAppData } from "@/lib/store";
import { EmptyState } from "@/components/page-shell";

export function SavedMealsTab({
  onAdded,
  date,
}: {
  onAdded: () => void;
  date?: string;
}) {
  const { savedMeals } = useAppData();

  if (savedMeals.length === 0) {
    return (
      <EmptyState message="No saved foods yet. Tap the star on any food — a search result, a scanned product, or a recent food — to save it here." />
    );
  }

  const log = (id: string) => {
    const meal = savedMeals.find((m) => m.id === id);
    if (!meal) return;
    addFoodEntry({
      name: meal.name,
      brand: meal.brand,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      amount: meal.amount,
      amountUnit: meal.amountUnit,
      source: "saved_meal",
      externalId: meal.externalId,
      barcode: meal.barcode,
      date,
    });
    onAdded();
  };

  return (
    <div className="flex flex-col gap-2">
      {savedMeals.map((meal) => (
        <div
          key={meal.id}
          className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
        >
          <button onClick={() => log(meal.id)} className="min-w-0 flex-1 text-left tap">
            <p className="truncate text-sm font-medium">{meal.name}</p>
            <p className="truncate text-xs text-white/45">
              {Math.round(meal.calories)} kcal
              {meal.protein !== undefined
                ? ` · ${Math.round(meal.protein)}g protein`
                : ""}
            </p>
          </button>
          <button
            onClick={() => log(meal.id)}
            className="tap rounded-full bg-accent/20 p-2 text-accent-soft"
            aria-label="Add meal"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => deleteSavedMeal(meal.id)}
            className="tap rounded-full p-2 text-white/30 hover:text-red-300"
            aria-label="Delete meal"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
