"use client";

import { useState } from "react";
import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useAppData, logWeight } from "@/lib/store";
import { latestWeight, weightTrend } from "@/lib/selectors";
import { todayStr } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function WeightCard() {
  const data = useAppData();
  const latest = latestWeight(data);
  const trend = weightTrend(data);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const unit = data.settings.weightUnit;

  const save = () => {
    const w = Number(value);
    if (!w || w <= 0) return;
    logWeight(todayStr(), w, unit);
    setValue("");
    setOpen(false);
  };

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <>
      <button
        onClick={() => {
          setValue(latest ? String(latest.weight) : "");
          setOpen(true);
        }}
        className="glass tap flex w-full items-center gap-4 p-5 text-left"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-white/60">
          <Scale className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-white/50">
            Weight
          </p>
          {latest ? (
            <p className="text-lg font-bold">
              {latest.weight}
              <span className="text-sm font-normal text-white/50">
                {" "}
                {latest.unit}
              </span>
            </p>
          ) : (
            <p className="text-lg font-bold">Log today&apos;s weight</p>
          )}
          <p className="text-sm text-white/50">
            {latest ? "Tap to update" : "Start your trend"}
          </p>
        </div>
        {trend && (
          <TrendIcon
            className={`h-5 w-5 ${
              trend === "up"
                ? "text-emerald-400"
                : trend === "down"
                  ? "text-sky-400"
                  : "text-white/40"
            }`}
          />
        )}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Log weight">
        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              className="w-40 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-4xl font-bold outline-none focus:border-accent/60"
            />
            <span className="pb-4 text-xl text-white/50">{unit}</span>
          </div>
          <Button size="lg" onClick={save}>
            Save weight
          </Button>
        </div>
      </Sheet>
    </>
  );
}
