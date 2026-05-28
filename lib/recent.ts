import type { AmountUnit, AppData, FoodEntry, FoodSource } from "./types";

/**
 * A reusable template for re-logging a food: derived from a past food entry
 * or a saved meal, with everything needed to add a new entry quickly.
 */
export type FoodTemplate = {
  key: string;
  name: string;
  brand?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  amount: number;
  amountUnit: AmountUnit;
  source: FoodSource;
  externalId?: string;
  barcode?: string;
  /** Last time this food was logged (YYYY-MM-DD). */
  lastUsed: string;
};

/** Stable id for deduping the same food across multiple entries. */
export function fingerprint(e: {
  source: string;
  externalId?: string;
  barcode?: string;
  name: string;
}): string {
  if (e.externalId) return `${e.source}|${e.externalId}`;
  if (e.barcode) return `barcode|${e.barcode}`;
  return `name|${e.name.trim().toLowerCase()}`;
}

function templateFromEntry(e: FoodEntry): FoodTemplate {
  return {
    key: fingerprint(e),
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
    lastUsed: e.date,
  };
}

/** Most recently logged foods, deduped by fingerprint, newest first. */
export function recentFoods(data: AppData, limit = 20): FoodTemplate[] {
  const seen = new Map<string, FoodTemplate>();
  const sorted = [...data.foodEntries].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  for (const e of sorted) {
    const key = fingerprint(e);
    if (seen.has(key)) continue;
    seen.set(key, templateFromEntry(e));
    if (seen.size >= limit) break;
  }
  return Array.from(seen.values());
}

/** Recent foods that are currently starred, newest-used first. */
export function favoriteFoods(data: AppData): FoodTemplate[] {
  const all = recentFoods(data, 200);
  const map = new Map(all.map((t) => [t.key, t] as const));
  return data.favorites.map((k) => map.get(k)).filter(Boolean) as FoodTemplate[];
}

/** Recent foods that aren't favorited (favorites are shown separately). */
export function nonFavoriteRecent(data: AppData, limit = 10): FoodTemplate[] {
  const favs = new Set(data.favorites);
  return recentFoods(data, limit + favs.size).filter((t) => !favs.has(t.key)).slice(0, limit);
}
