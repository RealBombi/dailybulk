"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { addFoodEntry } from "@/lib/store";
import { round } from "@/lib/utils";
import type { FoodTemplate } from "@/lib/recent";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";

type Props = {
  template: FoodTemplate | null;
  date: string;
  onAdded: () => void;
  onClose: () => void;
};

const SOURCE_LABEL: Record<string, string> = {
  usda: "USDA",
  open_food_facts: "OFF",
  manual: "Manual",
  saved_meal: "Saved",
};

export function QuickPortionSheet({ template, date, onAdded, onClose }: Props) {
  return (
    <Sheet open={!!template} onClose={onClose} title="Add again">
      {template && (
        <Inner template={template} date={date} onAdded={onAdded} />
      )}
    </Sheet>
  );
}

function Inner({
  template,
  date,
  onAdded,
}: {
  template: FoodTemplate;
  date: string;
  onAdded: () => void;
}) {
  const [amount, setAmount] = useState(template.amount);
  const factor =
    template.amount > 0 && amount > 0 ? amount / template.amount : 0;
  const scale = (v?: number) =>
    v === undefined ? undefined : round(v * factor, 1);
  const calories = round(template.calories * factor);
  const valid = amount > 0;

  const add = () => {
    if (!valid) return;
    addFoodEntry({
      name: template.name,
      brand: template.brand,
      calories,
      protein: scale(template.protein),
      carbs: scale(template.carbs),
      fat: scale(template.fat),
      amount,
      amountUnit: template.amountUnit,
      source: template.source,
      externalId: template.externalId,
      barcode: template.barcode,
      date,
    });
    onAdded();
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-start gap-2">
          <p className="flex-1 text-base font-semibold leading-tight">
            {template.name}
          </p>
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase text-white/40">
            {SOURCE_LABEL[template.source] ?? template.source}
          </span>
        </div>
        {template.brand && (
          <p className="text-sm text-white/50">{template.brand}</p>
        )}
        <p className="mt-1 text-xs text-white/40">
          Last used {template.lastUsed}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs text-white/50">
          Amount ({template.amountUnit})
        </label>
        <AmountInput value={amount} onValueChange={setAmount} aria-label="Amount" />
      </div>

      <div className="grid grid-cols-4 gap-2 rounded-2xl bg-white/[0.03] p-3 text-center">
        <Macro label="kcal" value={calories} />
        <Macro label="protein" value={scale(template.protein)} suffix="g" />
        <Macro label="carbs" value={scale(template.carbs)} suffix="g" />
        <Macro label="fat" value={scale(template.fat)} suffix="g" />
      </div>

      {!valid && (
        <p className="text-xs text-amber-300">Enter an amount greater than 0.</p>
      )}

      <Button onClick={add} size="lg" disabled={!valid}>
        <Plus className="h-5 w-5" /> Add
      </Button>
    </div>
  );
}

function Macro({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value?: number;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-lg font-bold tabular-nums">
        {value === undefined ? "–" : Math.round(value)}
        <span className="text-xs font-normal text-white/40">{suffix}</span>
      </p>
      <p className="text-[10px] uppercase tracking-wide text-white/40">
        {label}
      </p>
    </div>
  );
}
