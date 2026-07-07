import { makeNormalizedFood } from "../normalize";
import type { NormalizedFood } from "../types";

const SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

// USDA FoodData Central nutrient numbers. Energy has three variants: classic
// kcal (208, used by SR Legacy/Branded/FNDDS) and the Atwater factors (957/
// 958, used by newer Foundation entries INSTEAD of 208 — without them,
// Foundation foods like "Milk, whole" appear to have no calorie data).
const NUTRIENT = {
  energyKcal: "208",
  energyAtwaterGeneral: "957",
  energyAtwaterSpecific: "958",
  protein: "203",
  carbs: "205",
  fat: "204",
} as const;

type UsdaNutrient = {
  nutrientNumber?: string;
  value?: number;
};

type UsdaFood = {
  fdcId: number;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: UsdaNutrient[];
};

function nutrientValue(food: UsdaFood, number: string): number | undefined {
  const found = food.foodNutrients?.find((n) => n.nutrientNumber === number);
  return found?.value;
}

function energyKcal(food: UsdaFood): number | undefined {
  return (
    nutrientValue(food, NUTRIENT.energyKcal) ??
    nutrientValue(food, NUTRIENT.energyAtwaterSpecific) ??
    nutrientValue(food, NUTRIENT.energyAtwaterGeneral)
  );
}

export async function searchUsda(
  query: string,
  apiKey: string,
  pageSize = 20,
  dataType = "Foundation,SR Legacy,Branded",
): Promise<NormalizedFood[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("dataType", dataType);

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`USDA search failed: ${res.status}`);
  }
  const json = (await res.json()) as { foods?: UsdaFood[] };
  const foods = json.foods ?? [];

  return foods.map((food) => {
    const serving =
      food.servingSize && food.servingSizeUnit
        ? `${food.servingSize} ${food.servingSizeUnit}`
        : undefined;
    return makeNormalizedFood({
      source: "usda",
      externalId: String(food.fdcId),
      barcode: food.gtinUpc || undefined,
      name: food.description ?? "Unknown food",
      brand: food.brandName || food.brandOwner || undefined,
      caloriesPer100g: energyKcal(food),
      proteinPer100g: nutrientValue(food, NUTRIENT.protein),
      carbsPer100g: nutrientValue(food, NUTRIENT.carbs),
      fatPer100g: nutrientValue(food, NUTRIENT.fat),
      servingSize: serving,
      rawData: food,
    });
  });
}
