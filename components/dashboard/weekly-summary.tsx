"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useAppData } from "@/lib/store";
import {
  creatineTakenOn,
  totalsForDate,
} from "@/lib/selectors";
import {
  currentWeekDates,
  parseDateStr,
  round,
  todayStr,
} from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/card";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

type Cell = "hit" | "partial" | "none" | "future";

function cellClass(c: Cell): string {
  if (c === "hit") return "bg-accent shadow-glow";
  if (c === "partial") return "bg-accent/30";
  if (c === "future") return "bg-white/[0.02]";
  return "bg-white/[0.06]";
}

function formatRange(days: string[]): string {
  const fmt = (s: string) =>
    parseDateStr(s).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  return `${fmt(days[0])} – ${fmt(days[6])}`;
}

export function WeeklySummary() {
  const data = useAppData();
  const { settings } = data;
  const days = currentWeekDates();
  const today = todayStr();

  const per = days.map((d) => {
    const totals = totalsForDate(data, d);
    const future = d > today;
    return {
      date: d,
      future,
      calories: totals.calories,
      protein: totals.protein,
      calHit: totals.calories > 0 && totals.calories >= settings.calorieGoal,
      protHit: totals.protein > 0 && totals.protein >= settings.proteinGoal,
      logged: totals.calories > 0,
      creatine: creatineTakenOn(data, d),
    };
  });

  const calCells: Cell[] = per.map((p) =>
    p.future
      ? "future"
      : p.calHit
        ? "hit"
        : p.logged
          ? "partial"
          : "none",
  );
  const protCells: Cell[] = per.map((p) =>
    p.future
      ? "future"
      : p.protHit
        ? "hit"
        : p.protein > 0
          ? "partial"
          : "none",
  );
  const creCells: Cell[] = per.map((p) =>
    p.future ? "future" : p.creatine ? "hit" : "none",
  );

  const calHits = per.filter((p) => p.calHit).length;
  const protHits = per.filter((p) => p.protHit).length;
  const creHits = per.filter((p) => p.creatine).length;
  const loggedDays = per.filter((p) => p.logged).length;
  const avgCal = loggedDays
    ? Math.round(per.reduce((s, p) => s + p.calories, 0) / loggedDays)
    : 0;
  const avgProt = loggedDays
    ? round(per.reduce((s, p) => s + p.protein, 0) / loggedDays)
    : 0;

  // Weight trend: weights logged within this week
  const weekWeights = data.weightLogs
    .filter((w) => days.includes(w.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  let weightTrend: {
    kind: "up" | "down" | "stable";
    delta: number;
  } | null = null;
  if (weekWeights.length >= 2) {
    const delta = round(
      weekWeights[weekWeights.length - 1].weight - weekWeights[0].weight,
      1,
    );
    const kind =
      Math.abs(delta) < 0.3 ? "stable" : delta > 0 ? "up" : "down";
    weightTrend = { kind, delta };
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <CardTitle>This week</CardTitle>
        <span className="text-[10px] text-white/40">{formatRange(days)}</span>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-white/30">
        {DAY_LABELS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <Row
        label="Calories"
        sub={
          loggedDays
            ? `${calHits}/7 hit · avg ${avgCal} kcal`
            : `${calHits}/7 hit · no food logged yet`
        }
        cells={calCells}
      />
      <Row
        label="Protein"
        sub={
          loggedDays
            ? `${protHits}/7 hit · avg ${avgProt}g`
            : `${protHits}/7 hit · no food logged yet`
        }
        cells={protCells}
      />
      <Row
        label="Creatine"
        sub={`${creHits}/7 taken`}
        cells={creCells}
      />

      <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-xs">
        <span className="font-medium text-white/80">Weight</span>
        {weightTrend ? (
          <span className="flex items-center gap-1.5 text-white/60">
            {weightTrend.kind === "up" ? (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            ) : weightTrend.kind === "down" ? (
              <TrendingDown className="h-4 w-4 text-sky-400" />
            ) : (
              <Minus className="h-4 w-4 text-white/40" />
            )}
            <span>
              {weightTrend.delta > 0 ? "+" : ""}
              {weightTrend.delta} {settings.weightUnit} this week
            </span>
          </span>
        ) : (
          <span className="text-white/40">
            Log more weights to see your weekly trend
          </span>
        )}
      </div>
    </Card>
  );
}

function Row({
  label,
  sub,
  cells,
}: {
  label: string;
  sub: string;
  cells: Cell[];
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-white/80">{label}</span>
        <span className="text-white/45">{sub}</span>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className={`h-7 rounded-lg ${cellClass(c)}`}
          />
        ))}
      </div>
    </div>
  );
}
