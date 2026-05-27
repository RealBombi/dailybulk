export type FoodApiSource = "usda" | "open_food_facts";

export type NormalizedFood = {
  source: FoodApiSource;
  externalId: string;
  barcode?: string;
  name: string;
  brand?: string;
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  servingSize?: string;
  rawData: unknown;
};
