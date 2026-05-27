"use client";

import { useState } from "react";
import { z } from "zod";
import { Plus } from "lucide-react";
import { addFoodEntry, addSavedMeal } from "@/lib/store";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative().optional(),
  carbs: z.number().nonnegative().optional(),
  fat: z.number().nonnegative().optional(),
});

const empty = {
  name: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};

export function ManualAddTab({
  onAdded,
  date,
}: {
  onAdded: () => void;
  date?: string;
}) {
  const [form, setForm] = useState({ ...empty });
  const [alsoSave, setAlsoSave] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof empty) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const num = (v: string) => (v === "" ? undefined : Number(v));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      name: form.name.trim(),
      calories: Number(form.calories || 0),
      protein: num(form.protein),
      carbs: num(form.carbs),
      fat: num(form.fat),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    const data = parsed.data;
    addFoodEntry({
      name: data.name,
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fat: data.fat,
      amount: 1,
      amountUnit: "serving",
      source: "manual",
      date,
    });
    if (alsoSave) {
      addSavedMeal({
        name: data.name,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        amount: 1,
        amountUnit: "serving",
        source: "manual",
      });
    }
    setForm({ ...empty });
    setAlsoSave(false);
    setError(null);
    onAdded();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Name">
        <input
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
          placeholder="e.g. Chicken wrap"
          className="input"
        />
      </Field>

      <Field label="Calories (kcal)">
        <input
          value={form.calories}
          onChange={(e) => set("calories")(e.target.value)}
          inputMode="numeric"
          placeholder="650"
          className="input"
        />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Protein (g)">
          <input
            value={form.protein}
            onChange={(e) => set("protein")(e.target.value)}
            inputMode="numeric"
            className="input"
          />
        </Field>
        <Field label="Carbs (g)">
          <input
            value={form.carbs}
            onChange={(e) => set("carbs")(e.target.value)}
            inputMode="numeric"
            className="input"
          />
        </Field>
        <Field label="Fat (g)">
          <input
            value={form.fat}
            onChange={(e) => set("fat")(e.target.value)}
            inputMode="numeric"
            className="input"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-white/60">
        <input
          type="checkbox"
          checked={alsoSave}
          onChange={(e) => setAlsoSave(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        Also save as a meal for quick re-logging
      </label>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <Button type="submit" size="lg">
        <Plus className="h-5 w-5" /> Add to today
      </Button>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          padding: 0.7rem 0.9rem;
          font-size: 0.95rem;
          outline: none;
        }
        :global(.input:focus) {
          border-color: rgba(99, 102, 241, 0.6);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-white/50">{label}</label>
      {children}
    </div>
  );
}
