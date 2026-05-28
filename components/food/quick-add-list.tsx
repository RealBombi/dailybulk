"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toggleFavorite, useAppData } from "@/lib/store";
import {
  favoriteFoods,
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
          />
        ))}
        {recents.map((t) => (
          <Row key={`r-${t.key}`} template={t} onPick={() => setPicked(t)} />
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
    </section>
  );
}

function Row({
  template,
  favorited = false,
  onPick,
}: {
  template: FoodTemplate;
  favorited?: boolean;
  onPick: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03]">
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(template.key);
        }}
        aria-label={favorited ? "Unfavorite" : "Favorite"}
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
