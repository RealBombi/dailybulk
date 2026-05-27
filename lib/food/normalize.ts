import type { AmountUnit } from "../types";
import { round } from "../utils";
import type { NormalizedFood } from "./types";

/** Build a NormalizedFood, dropping undefined macro fields cleanly. */
export function makeNormalizedFood(input: NormalizedFood): NormalizedFood {
  return {
    ...input,
    caloriesPer100g: numOrUndef(input.caloriesPer100g),
    proteinPer100g: numOrUndef(input.proteinPer100g),
    carbsPer100g: numOrUndef(input.carbsPer100g),
    fatPer100g: numOrUndef(input.fatPer100g),
  };
}

function numOrUndef(n: number | undefined): number | undefined {
  if (n === undefined || n === null || Number.isNaN(n)) return undefined;
  return round(n, 1);
}

export type ScaledNutrition = {
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

/**
 * Scale per-100g values to an arbitrary amount. For "g"/"ml" the amount is
 * grams/millilitres; for "serving"/"piece" we treat per-100g as a per-unit
 * value (best effort) so the user can still log something sensible.
 */
export function scaleNutrition(
  food: NormalizedFood,
  amount: number,
  unit: AmountUnit,
): ScaledNutrition {
  const factor = unit === "g" || unit === "ml" ? amount / 100 : amount;
  return {
    calories: round((food.caloriesPer100g ?? 0) * factor),
    protein: scale(food.proteinPer100g, factor),
    carbs: scale(food.carbsPer100g, factor),
    fat: scale(food.fatPer100g, factor),
  };
}

function scale(value: number | undefined, factor: number): number | undefined {
  if (value === undefined) return undefined;
  return round(value * factor, 1);
}

type ParsedQty = { value: number; unit: "ml" | "g" };

/** Parse a quantity string like "500 ml", "1.5 l", "33 cl", "500g", "1 kg". */
function parseQuantity(input?: string): ParsedQty | null {
  if (!input) return null;
  const s = input.toLowerCase().replace(",", ".");
  const m = s.match(/([\d.]+)\s*(kg|cl|dl|ml|l|g)\b/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (Number.isNaN(value) || value <= 0) return null;
  switch (m[2]) {
    case "ml":
      return { value, unit: "ml" };
    case "cl":
      return { value: value * 10, unit: "ml" };
    case "dl":
      return { value: value * 100, unit: "ml" };
    case "l":
      return { value: value * 1000, unit: "ml" };
    case "g":
      return { value, unit: "g" };
    case "kg":
      return { value: value * 1000, unit: "g" };
    default:
      return null;
  }
}

/**
 * Suggest a sensible default portion for a food. For single-serve drinks/cans
 * we prefer the full package quantity (e.g. a 500 ml Monster), but we never
 * auto-select the whole package for large multi-serving products (1.5 L milk,
 * 500 g cereal) — those fall back to the serving size or per-100 basis.
 */
export function suggestPortion(food: NormalizedFood): {
  amount: number;
  unit: AmountUnit;
} {
  const raw = (food.rawData ?? {}) as {
    serving_size?: string;
    quantity?: string;
  };
  const serving = parseQuantity(raw.serving_size);
  const quantity = parseQuantity(raw.quantity ?? food.servingSize);

  // Liquids: full container when it's a single-serve size (~150–750 ml).
  if (quantity?.unit === "ml") {
    if (quantity.value >= 150 && quantity.value <= 750) {
      return { amount: round(quantity.value), unit: "ml" };
    }
    if (serving?.unit === "ml" && serving.value <= 750) {
      return { amount: round(serving.value), unit: "ml" };
    }
    return { amount: 100, unit: "ml" };
  }

  // Solids: use a real serving if it's a believable single portion, else 100 g.
  if (quantity?.unit === "g") {
    if (serving?.unit === "g" && serving.value <= 300) {
      return { amount: round(serving.value), unit: "g" };
    }
    return { amount: 100, unit: "g" };
  }

  // No package quantity known — use the serving size if we have one.
  if (serving) {
    return { amount: round(serving.value), unit: serving.unit };
  }
  return { amount: 100, unit: "g" };
}
