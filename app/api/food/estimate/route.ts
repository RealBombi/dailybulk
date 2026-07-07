import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { searchUsda } from "@/lib/food/providers/usda";
import {
  getByBarcode,
  searchOpenFoodFacts,
} from "@/lib/food/providers/open-food-facts";
import { scaleNutrition } from "@/lib/food/normalize";
import type { NormalizedFood } from "@/lib/food/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AI food logging — natural-language (or photo) meal descriptions.
 *
 * Division of labor, by design:
 *   - Claude identifies WHAT was eaten, HOW it was prepared, and roughly HOW
 *     MUCH (grams). It never invents a single nutrition number.
 *   - USDA FoodData Central provides ALL nutrition data; Claude only picks
 *     which USDA record best matches each identified ingredient.
 *   - The user confirms an editable draft before anything is logged.
 */

// Cheap + fast and good enough for parsing/matching; override via env if needed.
const MODEL = process.env.FOOD_AI_MODEL || "claude-haiku-4-5";
const MAX_ITEMS = 8;
const CANDIDATES_PER_ITEM = 8;

// JSON Schemas for structured outputs (kept plain — the app pins zod v3,
// which the SDK's zod helper doesn't support).
const PARSE_SCHEMA = {
  type: "object" as const,
  properties: {
    items: {
      type: "array",
      description:
        "One entry per distinct ingredient/food, as actually prepared and eaten.",
      items: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description:
              "Short human-readable name for this ingredient as eaten, e.g. 'Shrimp, butter-fried'",
          },
          searchQuery: {
            type: "string",
            description:
              "Generic USDA FoodData Central search query for this ingredient as prepared, e.g. 'shrimp cooked'",
          },
          grams: {
            type: "number",
            description:
              "Estimated total grams eaten of this ingredient. Use the user's stated amount when given.",
          },
          assumption: {
            type: "string",
            description:
              "Any portion/preparation assumption made, briefly, e.g. 'assumed 1 glass = 250 ml'",
          },
          barcode: {
            type: "string",
            description:
              "ONLY if a product barcode's digits (EAN/UPC, 8-14 digits printed under the bars) are clearly readable in a photo: those digits. Omit otherwise; never guess.",
          },
        },
        required: ["label", "searchQuery", "grams"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const MATCH_SCHEMA = {
  type: "object" as const,
  properties: {
    matches: {
      type: "array",
      description: "Exactly one match decision per parsed item.",
      items: {
        type: "object",
        properties: {
          itemIndex: { type: "number", description: "Index of the parsed item" },
          candidateIndex: {
            type: "number",
            description:
              "Index of the best-matching USDA candidate for this item, or -1 if none is acceptable",
          },
        },
        required: ["itemIndex", "candidateIndex"],
        additionalProperties: false,
      },
    },
  },
  required: ["matches"],
  additionalProperties: false,
};

type ParsedItem = {
  label: string;
  searchQuery: string;
  grams: number;
  assumption?: string;
  barcode?: string;
};

/** Extract and parse the JSON text of a structured-output response. */
function jsonOutput<T>(message: Anthropic.Message): T | null {
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const PARSE_SYSTEM = `You identify foods from meal descriptions or photos for a nutrition-tracking app.

Rules:
- Break the meal into distinct ingredients AS PREPARED. Preparation details matter: "fried in butter" means butter is its own ingredient; "light butter" means the light/reduced-fat variant; "skimmed milk" is not whole milk.
- NEVER output calorie or macro numbers. A separate food database provides all nutrition data. Your only quantitative output is the estimated grams eaten.
- Estimate grams conservatively from common portions (1 egg ≈ 50 g, 1 glass ≈ 250 ml ≈ 250 g, 1 slice bread ≈ 35 g, 1 tbsp butter/oil ≈ 14 g, 1 chicken breast ≈ 170 g). When the user states an amount, use it exactly.
- When the user states an ingredient's measured amount ("80g oats", "50g dry rice"), output that ingredient in the form it was measured — "Oats, dry" with searchQuery "oats" — NOT the cooked dish, so the database values apply to the stated grams. Only use cooked-dish entries when the user describes the finished dish without ingredient amounts.
- searchQuery must be a short generic term likely to match USDA FoodData Central (e.g. "shrimp cooked", "butter light", "bread white"). No brand names unless the user gave one.
- Photos may include the meal itself and/or the product packaging or nutrition label. Use a label photo to identify the exact product, variant and brand (put the brand in searchQuery then) and to read the stated serving size — but never copy nutrition numbers from it; the database supplies all nutrition data.
- If a barcode's digits are clearly readable in a photo, return them in the item's barcode field — they enable an exact product lookup.
- If the user added comments or corrections, they override everything else. After a correction, the label must cleanly describe the corrected food ("Skimmed milk", not "Whole milk, skimmed").
- At most ${MAX_ITEMS} items; merge trivial ones rather than exceeding it.`;

const MATCH_SYSTEM = `You match parsed food items to USDA database candidates for a nutrition-tracking app.

Rules:
- For each item pick the candidate that best matches the food AS PREPARED (cooked vs raw, light vs regular, skimmed vs whole).
- For plain whole foods (chicken breast, rice, eggs, milk...) ALWAYS prefer generic entries. Pick a BRANDED candidate only when the item explicitly names that brand — branded products with matching names are often composite ready-meals, not the plain food.
- Sanity-check the per-100g macros against what the food should plausibly contain. Plain cooked meat is high-protein and ~0g carbs — a "chicken breast" candidate with 13g carbs/100g is a ready-meal with sides, so reject it. Similar plausibility checks apply to other foods.
- Return -1 when no candidate is an acceptable match — a wrong match is worse than no match.
- Never invent nutrition data; you are only choosing among the given candidates.`;

type EstimateImage = { data: string; mediaType: string };

type EstimateRequest = {
  text?: string;
  comments?: string;
  /** Up to two photos — e.g. the meal itself plus the nutrition label. */
  images?: EstimateImage[];
};

const MAX_IMAGES = 2;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const PREP_WORDS =
  /\b(cooked|raw|fried|grilled|roasted|boiled|baked|steamed|prepared|fresh|dry|plain)\b/g;

/** Progressively simpler retry queries when the primary search finds nothing. */
function fallbackQueries(query: string): string[] {
  const out: string[] = [];
  const stripped = query.replace(PREP_WORDS, "").replace(/\s+/g, " ").trim();
  if (stripped && stripped.toLowerCase() !== query.toLowerCase()) out.push(stripped);
  const first = (stripped || query).split(" ")[0];
  if (first && !out.includes(first) && first.toLowerCase() !== query.toLowerCase()) {
    out.push(first);
  }
  return out;
}

const usable = (f: NormalizedFood) => f.caloriesPer100g !== undefined;

/**
 * Candidate ladder per ingredient: generic USDA → branded USDA → simplified
 * query retries → Open Food Facts text search (covers European products).
 */
async function findCandidates(
  query: string,
  usdaKey: string,
): Promise<NormalizedFood[]> {
  const generic = (
    await searchUsda(query, usdaKey, CANDIDATES_PER_ITEM, "Foundation,SR Legacy").catch(
      () => [] as NormalizedFood[],
    )
  ).filter(usable);
  if (generic.length >= 3) return generic;

  const branded = (
    await searchUsda(
      query,
      usdaKey,
      CANDIDATES_PER_ITEM - generic.length,
      "Branded",
    ).catch(() => [] as NormalizedFood[])
  ).filter(usable);
  const combined = [...generic, ...branded];
  if (combined.length > 0) return combined;

  // Nothing found — the query is often over-specified ("oatmeal cooked").
  for (const retry of fallbackQueries(query)) {
    const again = (
      await searchUsda(retry, usdaKey, CANDIDATES_PER_ITEM, "Foundation,SR Legacy").catch(
        () => [] as NormalizedFood[],
      )
    ).filter(usable);
    if (again.length > 0) return again;
  }

  // Last resort: Open Food Facts text search (has European/Nordic products).
  return (
    await searchOpenFoodFacts(query, 6).catch(() => [] as NormalizedFood[])
  ).filter(usable);
}

function candidateLine(i: number, f: NormalizedFood): string {
  const parts = [
    `[${i}] ${f.name}`,
    f.brand ? `BRANDED: ${f.brand}` : "generic",
    `per 100g: ${f.caloriesPer100g ?? "?"} kcal`,
    `${f.proteinPer100g ?? "?"}g protein`,
    `${f.carbsPer100g ?? "?"}g carbs`,
    `${f.fatPer100g ?? "?"}g fat`,
  ];
  return parts.join(" | ");
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI food logging isn't configured on this server." },
      { status: 503 },
    );
  }
  const usdaKey = process.env.USDA_FDC_API_KEY;
  if (!usdaKey) {
    return NextResponse.json(
      { error: "Food database (USDA) isn't configured on this server." },
      { status: 503 },
    );
  }

  let body: EstimateRequest;
  try {
    body = (await request.json()) as EstimateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = body.text?.trim();
  const comments = body.comments?.trim();
  const images = (body.images ?? []).slice(0, MAX_IMAGES);
  if (!text && images.length === 0) {
    return NextResponse.json(
      { error: "Describe the meal or attach a photo." },
      { status: 400 },
    );
  }
  for (const image of images) {
    if (!ALLOWED_IMAGE_TYPES.has(image.mediaType)) {
      return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
    }
    // ~2 MB base64 cap each — the client downscales photos before uploading.
    if (image.data.length > 2_800_000) {
      return NextResponse.json({ error: "Photo is too large." }, { status: 413 });
    }
  }

  const client = new Anthropic();

  try {
    // ---- Step 1: parse the description into ingredients + gram estimates ----
    const userContent: Anthropic.ContentBlockParam[] = [];
    for (const image of images) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data: image.data,
        },
      });
    }
    const promptParts = [
      images.length > 0 && !text
        ? `Identify the foods in ${images.length === 1 ? "this photo" : "these photos"}.`
        : null,
      text ? `Meal description: ${text}` : null,
      comments ? `User comments/corrections (these override everything else): ${comments}` : null,
    ].filter(Boolean);
    userContent.push({ type: "text", text: promptParts.join("\n\n") });

    const parsed = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: [
        {
          type: "text",
          text: PARSE_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
      output_config: {
        format: { type: "json_schema", schema: PARSE_SCHEMA },
      },
    });

    const parsedOut = jsonOutput<{ items: ParsedItem[] }>(parsed);
    const items = (parsedOut?.items ?? []).slice(0, MAX_ITEMS);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "Couldn't identify any foods — try describing the meal differently." },
        { status: 422 },
      );
    }

    // ---- Step 2: resolve each ingredient against the databases ----
    // A readable barcode beats everything: Open Food Facts has the exact
    // product (including European/Nordic goods USDA lacks), same as the
    // Barcode tab. Otherwise run the USDA-first candidate ladder.
    const resolved = await Promise.all(
      items.map(async (item) => {
        if (item.barcode && /^\d{8,14}$/.test(item.barcode)) {
          const product = await getByBarcode(item.barcode).catch(() => null);
          if (product && usable(product)) {
            return { direct: product, candidates: [] as NormalizedFood[] };
          }
        }
        return {
          direct: null as NormalizedFood | null,
          candidates: await findCandidates(item.searchQuery, usdaKey),
        };
      }),
    );

    // ---- Step 3: Claude picks the best record per unresolved item (or none) ----
    const needsMatch = items
      .map((_, i) => i)
      .filter((i) => !resolved[i].direct && resolved[i].candidates.length > 0);

    const decisions = new Map<number, number>();
    if (needsMatch.length > 0) {
      const matchPrompt = needsMatch
        .map((i) => {
          const lines = resolved[i].candidates
            .map((f, j) => candidateLine(j, f))
            .join("\n");
          return `Item ${i}: ${items[i].label} (as prepared; ~${items[i].grams} g)\nCandidates:\n${lines}`;
        })
        .join("\n\n");

      const matched = await client.messages.create({
        model: MODEL,
        max_tokens: 800,
        system: [
          {
            type: "text",
            text: MATCH_SYSTEM,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: matchPrompt }],
        output_config: {
          format: { type: "json_schema", schema: MATCH_SCHEMA },
        },
      });

      const matchOut = jsonOutput<{
        matches: { itemIndex: number; candidateIndex: number }[];
      }>(matched);
      for (const m of matchOut?.matches ?? []) {
        decisions.set(m.itemIndex, m.candidateIndex);
      }
    }

    // ---- Step 4: scale database nutrition to the estimated grams ----
    const results = items.map((item, i) => {
      const pick = decisions.get(i) ?? -1;
      const food =
        resolved[i].direct ??
        (pick >= 0 && pick < resolved[i].candidates.length
          ? resolved[i].candidates[pick]
          : null);
      if (!food || food.caloriesPer100g === undefined) {
        return {
          label: item.label,
          grams: Math.round(item.grams),
          assumption: item.assumption,
          matched: false as const,
        };
      }
      const nutrition = scaleNutrition(food, item.grams, "g");
      return {
        label: item.label,
        grams: Math.round(item.grams),
        assumption: item.assumption,
        matched: true as const,
        food: {
          name: food.name,
          brand: food.brand,
          source: food.source,
          externalId: food.externalId,
          per100g: {
            calories: food.caloriesPer100g,
            protein: food.proteinPer100g,
            carbs: food.carbsPer100g,
            fat: food.fatPer100g,
          },
        },
        nutrition,
      };
    });

    return NextResponse.json({ items: results });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status === 429 ? 429 : 502;
      return NextResponse.json(
        {
          error:
            err.status === 429
              ? "AI is rate-limited right now — try again in a moment."
              : "AI food analysis failed — you can still add the food manually.",
        },
        { status },
      );
    }
    return NextResponse.json(
      { error: "Something went wrong analyzing the meal." },
      { status: 500 },
    );
  }
}
