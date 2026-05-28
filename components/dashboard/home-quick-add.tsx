"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Star, Zap } from "lucide-react";
import { addFoodEntry, useAppData } from "@/lib/store";
import {
  favoriteFoods,
  nonFavoriteRecent,
  type FoodTemplate,
} from "@/lib/recent";
import { todayStr } from "@/lib/utils";

export function HomeQuickAdd() {
  const data = useAppData();
  const favs = favoriteFoods(data);
  const recents = nonFavoriteRecent(data, 5);
  const combined = [...favs, ...recents].slice(0, 5);
  const [toast, setToast] = useState<string | null>(null);

  if (combined.length === 0) return null;

  const add = (t: FoodTemplate) => {
    addFoodEntry({
      name: t.name,
      brand: t.brand,
      calories: t.calories,
      protein: t.protein,
      carbs: t.carbs,
      fat: t.fat,
      amount: t.amount,
      amountUnit: t.amountUnit,
      source: t.source,
      externalId: t.externalId,
      barcode: t.barcode,
      date: todayStr(),
    });
    setToast(t.name);
    window.setTimeout(() => setToast(null), 1500);
  };

  const isFav = (t: FoodTemplate) =>
    data.favorites.includes(t.key);

  return (
    <div className="glass flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-accent-soft" />
        <h3 className="text-xs font-medium uppercase tracking-wider text-white/50">
          Quick add
        </h3>
      </div>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {combined.map((t) => (
          <button
            key={t.key}
            onClick={() => add(t)}
            className="tap flex shrink-0 flex-col items-start gap-0.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.08]"
          >
            <div className="flex items-center gap-1">
              {isFav(t) && <Star className="h-3 w-3 fill-accent text-accent" />}
              <span className="max-w-[140px] truncate text-sm font-medium">
                {t.name}
              </span>
            </div>
            <span className="text-[11px] text-white/45">
              {Math.round(t.calories)} kcal · {t.amount}
              {t.amountUnit === "g" || t.amountUnit === "ml" ? t.amountUnit : ""}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed inset-x-0 bottom-24 z-50 mx-auto flex w-fit items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-glow"
          >
            <Check className="h-4 w-4" /> Added {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
