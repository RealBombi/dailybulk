import { NextResponse } from "next/server";
import { searchUsda } from "@/lib/food/providers/usda";
import { searchOpenFoodFacts } from "@/lib/food/providers/open-food-facts";
import type { NormalizedFood } from "@/lib/food/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ results: [], usda: false });
  }

  const apiKey = process.env.USDA_FDC_API_KEY;
  let usdaResults: NormalizedFood[] = [];
  let offResults: NormalizedFood[] = [];
  let usdaUsed = false;

  // USDA first for generic foods (PRD priority), Open Food Facts as backup.
  const tasks: Promise<void>[] = [];

  if (apiKey) {
    usdaUsed = true;
    tasks.push(
      searchUsda(query, apiKey)
        .then((r) => {
          usdaResults = r;
        })
        .catch(() => {}),
    );
  }

  tasks.push(
    searchOpenFoodFacts(query)
      .then((r) => {
        offResults = r;
      })
      .catch(() => {}),
  );

  await Promise.all(tasks);

  // Rank for usefulness rather than raw API order:
  //  1. Entries without calorie data are useless (they'd log 0 kcal) — drop.
  //  2. Generic USDA entries (plain foods) outrank branded products — raw API
  //     order buries "Chicken, breast, cooked" under a wall of US-supermarket
  //     ready-meals that happen to be named "GRILLED CHICKEN BREAST".
  const usable = (f: NormalizedFood) => f.caloriesPer100g !== undefined;
  const generic = usdaResults.filter((f) => usable(f) && !f.brand);
  const branded = usdaResults.filter((f) => usable(f) && Boolean(f.brand));
  const results = [...generic, ...branded, ...offResults.filter(usable)];

  return NextResponse.json({ results, usda: usdaUsed });
}
