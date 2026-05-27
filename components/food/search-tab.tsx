"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { NormalizedFood } from "@/lib/food/types";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { FoodResultItem } from "./food-result-item";
import { PortionEditor } from "./portion-editor";

export function SearchTab({ onAdded }: { onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NormalizedFood | null>(null);

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/food/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.results ?? []);
      setSearched(true);
    } catch {
      setError("Search failed. Check your connection or add the food manually.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={run} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="chicken breast, oats, banana…"
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-9 pr-3 text-sm outline-none focus:border-accent/60"
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {searched && !loading && results.length === 0 && !error && (
        <p className="px-1 text-sm text-white/50">
          No results. Try the Manual tab to add it yourself.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {results.map((food) => (
          <FoodResultItem
            key={`${food.source}-${food.externalId}`}
            food={food}
            onClick={() => setSelected(food)}
          />
        ))}
      </div>

      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Add food"
      >
        {selected && (
          <PortionEditor
            food={selected}
            onAdded={() => {
              setSelected(null);
              onAdded();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
