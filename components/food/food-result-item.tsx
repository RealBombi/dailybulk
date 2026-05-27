"use client";

import { ChevronRight } from "lucide-react";
import type { NormalizedFood } from "@/lib/food/types";

export function FoodResultItem({
  food,
  onClick,
}: {
  food: NormalizedFood;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="tap flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left hover:bg-white/[0.06]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{food.name}</p>
        <p className="truncate text-xs text-white/45">
          {food.brand ? `${food.brand} · ` : ""}
          {food.caloriesPer100g !== undefined
            ? `${Math.round(food.caloriesPer100g)} kcal / 100g`
            : "no calorie data"}
          {food.proteinPer100g !== undefined
            ? ` · ${Math.round(food.proteinPer100g)}g protein`
            : ""}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase text-white/40">
        {food.source === "usda" ? "USDA" : "OFF"}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
    </button>
  );
}
