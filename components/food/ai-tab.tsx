"use client";

import { useRef, useState } from "react";
import { Camera, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { addFoodEntry } from "@/lib/store";
import { round } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * AI food logging tab. The AI only identifies foods, preparation and portion
 * grams (see /api/food/estimate); all nutrition numbers come from the USDA
 * database. Everything lands in an editable draft the user confirms — nothing
 * is ever logged automatically.
 */

type Per100g = {
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

type EstimateItem = {
  label: string;
  grams: number;
  assumption?: string;
  matched: boolean;
  food?: {
    name: string;
    brand?: string;
    source: "usda" | "open_food_facts";
    externalId: string;
    per100g: Per100g;
  };
};

type Draft = EstimateItem & { include: boolean };

type Photo = { data: string; mediaType: string; name: string };

const MAX_IMAGE_EDGE = 1024;
/** Two photos: the meal itself plus e.g. the nutrition label on the pack. */
const MAX_PHOTOS = 2;

/** Downscale a photo client-side so uploads stay small and cheap. */
async function fileToResizedBase64(
  file: File,
): Promise<{ data: string; mediaType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image."));
      el.src = url;
    });
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process that image.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return { data: dataUrl.split(",")[1], mediaType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function scaled(per100g: Per100g, grams: number) {
  const f = grams / 100;
  return {
    calories: round(per100g.calories * f),
    protein: per100g.protein !== undefined ? round(per100g.protein * f, 1) : undefined,
    carbs: per100g.carbs !== undefined ? round(per100g.carbs * f, 1) : undefined,
    fat: per100g.fat !== undefined ? round(per100g.fat * f, 1) : undefined,
  };
}

export function AiTab({ onAdded, date }: { onAdded: () => void; date?: string }) {
  const [text, setText] = useState("");
  const [comments, setComments] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const analyze = async (withComments: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/food/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          comments: withComments ? comments.trim() || undefined : undefined,
          images: photos.length
            ? photos.map((p) => ({ data: p.data, mediaType: p.mediaType }))
            : undefined,
        }),
      });
      const json = (await res.json()) as { items?: EstimateItem[]; error?: string };
      if (!res.ok || !json.items) {
        setError(json.error ?? "Something went wrong.");
        return;
      }
      setDrafts(json.items.map((i) => ({ ...i, include: i.matched })));
    } catch {
      setError("Couldn't reach the server — are you online?");
    } finally {
      setBusy(false);
    }
  };

  const onPickPhotos = async (files: File[]) => {
    setError(null);
    try {
      const room = MAX_PHOTOS - photos.length;
      const added = await Promise.all(
        files.slice(0, room).map(async (file) => {
          const resized = await fileToResizedBase64(file);
          return { ...resized, name: file.name };
        }),
      );
      if (added.length > 0) {
        setPhotos((p) => [...p, ...added].slice(0, MAX_PHOTOS));
        setDrafts(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that image.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePhoto = (idx: number) =>
    setPhotos((p) => p.filter((_, i) => i !== idx));

  const setGrams = (idx: number, grams: number) =>
    setDrafts((d) =>
      d ? d.map((it, i) => (i === idx ? { ...it, grams } : it)) : d,
    );

  const toggle = (idx: number) =>
    setDrafts((d) =>
      d ? d.map((it, i) => (i === idx ? { ...it, include: !it.include } : it)) : d,
    );

  const addAll = () => {
    if (!drafts) return;
    const chosen = drafts.filter((d) => d.include && d.matched && d.food && d.grams > 0);
    for (const d of chosen) {
      const n = scaled(d.food!.per100g, d.grams);
      addFoodEntry({
        name: d.food!.name,
        brand: d.food!.brand,
        calories: n.calories,
        protein: n.protein,
        carbs: n.carbs,
        fat: n.fat,
        amount: d.grams,
        amountUnit: "g",
        source: d.food!.source,
        externalId: d.food!.externalId,
        date,
      });
    }
    if (chosen.length > 0) {
      setDrafts(null);
      setText("");
      setComments("");
      setPhotos([]);
      onAdded();
    }
  };

  const included = drafts?.filter((d) => d.include && d.matched && d.grams > 0) ?? [];
  const totals = included.reduce(
    (acc, d) => {
      const n = scaled(d.food!.per100g, d.grams);
      return {
        calories: acc.calories + n.calories,
        protein: acc.protein + (n.protein ?? 0),
      };
    },
    { calories: 0, protein: 0 },
  );

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={'Describe what you ate and how it was made…\ne.g. "butter-fried shrimp, but with light butter, and a glass of skimmed milk"'}
        className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-accent/60"
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            disabled={photos.length >= MAX_PHOTOS}
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            {photos.length === 0
              ? "Add photo"
              : `Add photo (${photos.length}/${MAX_PHOTOS})`}
          </Button>
          {photos.map((p, i) => (
            <span
              key={i}
              className="flex min-w-0 max-w-[45%] items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/60"
            >
              <span className="truncate">{p.name || `photo ${i + 1}`}</span>
              <button
                onClick={() => removePhoto(i)}
                className="tap shrink-0 rounded-full p-0.5 text-white/40 hover:text-white"
                aria-label={`Remove ${p.name || `photo ${i + 1}`}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
        {photos.length > 0 && photos.length < MAX_PHOTOS && (
          <p className="text-[11px] text-white/35">
            Tip: add a second photo of the packaging/nutrition label to help
            identify the exact product.
          </p>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) void onPickPhotos(files);
        }}
      />

      <Button
        onClick={() => void analyze(false)}
        disabled={busy || (!text.trim() && photos.length === 0)}
      >
        <Sparkles className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} />
        {busy ? "Checking the database…" : drafts ? "Analyze again" : "Analyze"}
      </Button>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {drafts && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-white/40">
            AI identified the foods; all nutrition comes from the USDA database.
            Check the portions before adding.
          </p>

          {drafts.map((d, i) => (
            <DraftRow
              key={i}
              draft={d}
              onGrams={(g) => setGrams(i, g)}
              onToggle={() => toggle(i)}
            />
          ))}

          <div className="flex flex-col gap-2 pt-1">
            <input
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder='Correct something… e.g. "it was only half a portion"'
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-accent/60"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !comments.trim()}
              onClick={() => void analyze(true)}
            >
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              Re-check with correction
            </Button>
          </div>

          <Button size="lg" onClick={addAll} disabled={included.length === 0}>
            <Plus className="h-5 w-5" />
            Add {included.length} item{included.length === 1 ? "" : "s"} ·{" "}
            {round(totals.calories)} kcal / {round(totals.protein)}g protein
          </Button>
        </div>
      )}
    </div>
  );
}

function DraftRow({
  draft,
  onGrams,
  onToggle,
}: {
  draft: Draft;
  onGrams: (g: number) => void;
  onToggle: () => void;
}) {
  if (!draft.matched || !draft.food) {
    return (
      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
        <p className="text-sm font-medium text-white/80">{draft.label}</p>
        <p className="text-xs text-amber-200/80">
          No database match found — add this one via Search or Manual.
        </p>
      </div>
    );
  }
  const n = scaled(draft.food.per100g, draft.grams);
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
        draft.include ? "border-white/10 bg-white/[0.04]" : "border-white/5 opacity-45"
      }`}
    >
      <input
        type="checkbox"
        checked={draft.include}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 accent-accent"
        aria-label={`Include ${draft.label}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{draft.label}</p>
        <p className="truncate text-[11px] text-white/40">
          {draft.food.name}
          {draft.food.brand ? ` · ${draft.food.brand}` : ""}
        </p>
        {draft.assumption && (
          <p className="truncate text-[11px] text-white/30">{draft.assumption}</p>
        )}
        <p className="text-xs text-white/60">
          {n.calories} kcal{n.protein !== undefined ? ` · ${n.protein}g protein` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={draft.grams}
          onChange={(e) => onGrams(Math.max(0, Number(e.target.value) || 0))}
          className="w-16 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-accent/60"
          aria-label={`Grams of ${draft.label}`}
        />
        <span className="text-xs text-white/40">g</span>
      </div>
    </div>
  );
}
