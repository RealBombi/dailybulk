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
