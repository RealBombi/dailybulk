"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star } from "lucide-react";
import { toggleSavedFood, useAppData } from "@/lib/store";
import {
  favoriteFoods,
  isSaved,
  nonFavoriteRecent,
  type FoodTemplate,
} from "@/lib/recent";
import { round } from "@/lib/utils";
import { CardTitle } from "@/components/ui/card";
import { QuickPortionSheet } from "./quick-portion-sheet";

const SOURCE_LABEL: Record<string, string> = {
  usda: "USDA",
  open_food_facts: "OFF",
  manual: "Manual",
  saved_meal: "Saved",
};

export function QuickAddList({
  date,
  onAdded,
}: {
  date: string;
  onAdded: () => void;
}) {
  const data = useAppData();
  const favs = favoriteFoods(data);
  const recents = nonFavoriteRecent(data, 8);
  const [picked, setPicked] = useState<FoodTemplate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const star = (t: FoodTemplate) => {
    const nowSaved = toggleSavedFood({
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
    });
    setToast(nowSaved ? "Saved to favorites" : "Removed from favorites");
    window.setTimeout(() => setToast(null), 1500);
  };

  if (favs.length === 0 && recents.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <CardTitle>Quick add</CardTitle>
        <p className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-xs text-white/50">
          No recent foods yet. Log a meal once and it appears here for one-tap
          re-logging.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <CardTitle>Quick add</CardTitle>
      <div className="flex flex-col gap-1.5">
        {favs.map((t) => (
          <Row
            key={`f-${t.key}`}
            template={t}
            favorited
            onPick={() => setPicked(t)}
            onStar={() => star(t)}
          />
        ))}
        {recents.map((t) => (
          <Row
            key={`r-${t.key}`}
            template={t}
            favorited={isSaved(data, t.key)}
            onPick={() => setPicked(t)}
            onStar={() => star(t)}
          />
        ))}
      </div>

      <QuickPortionSheet
        template={picked}
        date={date}
        onAdded={() => {
          setPicked(null);
          onAdded();
        }}
        onClose={() => setPicked(null)}
      />

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
    </section>
  );
}

function Row({
  template,
  favorited = false,
  onPick,
  onStar,
}: {
  template: FoodTemplate;
  favorited?: boolean;
  onPick: () => void;
  onStar: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03]">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStar();
        }}
        aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
        className="tap rounded-full p-3 pl-3"
      >
        <Star
          className={`h-4 w-4 ${
            favorited
              ? "fill-accent text-accent"
              : "text-white/25 hover:text-white/60"
          }`}
        />
      </button>
      <button onClick={onPick} className="tap min-w-0 flex-1 py-3 text-left">
        <p className="truncate text-sm font-medium">{template.name}</p>
        <p className="truncate text-xs text-white/45">
          {Math.round(template.calories)} kcal
          {template.protein !== undefined
            ? ` · ${round(template.protein)}g protein`
            : ""}
          {" · "}
          {template.amount}
          {template.amountUnit === "g" || template.amountUnit === "ml"
            ? template.amountUnit
            : ` ${template.amountUnit}`}
        </p>
      </button>
      <span className="mr-3 shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase text-white/40">
        {SOURCE_LABEL[template.source] ?? template.source}
      </span>
    </div>
  );
}
