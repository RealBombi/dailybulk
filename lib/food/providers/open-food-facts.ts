import { makeNormalizedFood } from "../normalize";
import type { NormalizedFood } from "../types";

const PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";
const SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";

const FIELDS =
  "code,product_name,brands,nutriments,serving_size,quantity";

type OffNutriments = {
  ["energy-kcal_100g"]?: number;
  ["proteins_100g"]?: number;
  ["carbohydrates_100g"]?: number;
  ["fat_100g"]?: number;
};

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  quantity?: string;
  nutriments?: OffNutriments;
};

function toNormalized(p: OffProduct): NormalizedFood | null {
  if (!p.code) return null;
  const n = p.nutriments ?? {};
  return makeNormalizedFood({
    source: "open_food_facts",
    externalId: p.code,
    barcode: p.code,
    name: p.product_name?.trim() || "Unnamed product",
    brand: p.brands?.split(",")[0]?.trim() || undefined,
    caloriesPer100g: n["energy-kcal_100g"],
    proteinPer100g: n["proteins_100g"],
    carbsPer100g: n["carbohydrates_100g"],
    fatPer100g: n["fat_100g"],
    servingSize: p.serving_size || p.quantity || undefined,
    rawData: p,
  });
}

export async function getByBarcode(
  barcode: string,
): Promise<NormalizedFood | null> {
  const url = `${PRODUCT_URL}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "DailyFuel/0.1 (personal fitness tracker)",
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { status?: number; product?: OffProduct };
  if (json.status !== 1 || !json.product) return null;
  return toNormalized(json.product);
}

export async function searchOpenFoodFacts(
  query: string,
  pageSize = 20,
): Promise<NormalizedFood[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(pageSize));
  url.searchParams.set("fields", FIELDS);

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "DailyFuel/0.1 (personal fitness tracker)",
    },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { products?: OffProduct[] };
  return (json.products ?? [])
    .map(toNormalized)
    .filter((f): f is NormalizedFood => f !== null);
}
