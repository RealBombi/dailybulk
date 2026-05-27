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

  const apiKey = process.env.USDA_API_KEY;
  const results: NormalizedFood[] = [];
  let usdaUsed = false;

  // USDA first for generic foods (PRD priority), Open Food Facts as backup.
  const tasks: Promise<void>[] = [];

  if (apiKey) {
    usdaUsed = true;
    tasks.push(
      searchUsda(query, apiKey)
        .then((r) => {
          results.push(...r);
        })
        .catch(() => {}),
    );
  }

  tasks.push(
    searchOpenFoodFacts(query)
      .then((r) => {
        results.push(...r);
      })
      .catch(() => {}),
  );

  await Promise.all(tasks);

  return NextResponse.json({ results, usda: usdaUsed });
}
