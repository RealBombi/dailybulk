import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { searchUsda } from "@/lib/food/providers/usda";
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
- searchQuery must be a short generic term likely to match USDA FoodData Central (e.g. "shrimp cooked", "butter light", "bread white"). No brand names unless the user gave one.
- If the user added comments or corrections, they override everything else.
- At most ${MAX_ITEMS} items; merge trivial ones rather than exceeding it.`;

const MATCH_SYSTEM = `You match parsed food items to USDA database candidates for a nutrition-tracking app.

Rules:
- For each item pick the candidate that best matches the food AS PREPARED (cooked vs raw, light vs regular, skimmed vs whole).
- Prefer generic (non-branded) entries with plausible per-100g calories over branded ones, unless the user named a brand.
- Return -1 when no candidate is an acceptable match — a wrong match is worse than no match.
- Never invent nutrition data; you are only choosing among the given candidates.`;

type EstimateRequest = {
  text?: string;
  comments?: string;
  image?: { data: string; mediaType: string };
};

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function candidateLine(i: number, f: NormalizedFood): string {
  const parts = [
    `[${i}] ${f.name}`,
    f.brand ? `brand: ${f.brand}` : "generic",
    `${f.caloriesPer100g ?? "?"} kcal/100g`,
    `${f.proteinPer100g ?? "?"}g protein/100g`,
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
  const image = body.image;
  if (!text && !image) {
    return NextResponse.json(
      { error: "Describe the meal or attach a photo." },
      { status: 400 },
    );
  }
  if (image && !ALLOWED_IMAGE_TYPES.has(image.mediaType)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  }
  // ~2 MB base64 cap — the client downscales photos before uploading.
  if (image && image.data.length > 2_800_000) {
    return NextResponse.json({ error: "Photo is too large." }, { status: 413 });
  }

  const client = new Anthropic();

  try {
    // ---- Step 1: parse the description into ingredients + gram estimates ----
    const userContent: Anthropic.ContentBlockParam[] = [];
    if (image) {
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
      image && !text ? "Identify the foods in this photo." : null,
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

    // ---- Step 2: look every ingredient up in USDA (nutrition source of truth) ----
    const candidates = await Promise.all(
      items.map((item) =>
        searchUsda(item.searchQuery, usdaKey, CANDIDATES_PER_ITEM).catch(
          () => [] as NormalizedFood[],
        ),
      ),
    );

    // ---- Step 3: Claude picks the best USDA record per item (or none) ----
    const matchPrompt = items
      .map((item, i) => {
        const list = candidates[i];
        const lines =
          list.length === 0
            ? "(no candidates found)"
            : list.map((f, j) => candidateLine(j, f)).join("\n");
        return `Item ${i}: ${item.label} (as prepared; ~${item.grams} g)\nCandidates:\n${lines}`;
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
    const decisions = new Map<number, number>();
    for (const m of matchOut?.matches ?? []) {
      decisions.set(m.itemIndex, m.candidateIndex);
    }

    // ---- Step 4: scale database nutrition to the estimated grams ----
    const results = items.map((item, i) => {
      const pick = decisions.get(i) ?? -1;
      const food =
        pick >= 0 && pick < candidates[i].length ? candidates[i][pick] : null;
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
