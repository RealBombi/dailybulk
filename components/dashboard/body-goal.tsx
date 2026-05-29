"use client";

import { Target } from "lucide-react";
import { useAppData } from "@/lib/store";
import { latestWeightKg } from "@/lib/selectors";
import { formatWeight } from "@/lib/utils";
import { weeksToGoal } from "@/lib/onboarding";
import { CardTitle } from "@/components/ui/card";

export function BodyGoalCard() {
  const data = useAppData();
  const { settings } = data;
  const targetKg = settings.targetWeightKg;
  if (targetKg === undefined) return null;

  const unit = settings.weightUnit;
  const currentKg = latestWeightKg(data);
  const speedKg = settings.goalSpeedKgPerWeek ?? 0;
  const isMaintain = settings.goalType === "maintain" || !speedKg;

  // No weight data yet — point them to logging.
  if (currentKg === undefined) {
    return (
      <div className="glass flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-accent-soft" />
          <CardTitle>Body goal</CardTitle>
        </div>
        <p className="text-sm text-white/70">
          Target: <span className="font-semibold text-white">{formatWeight(targetKg, unit)}</span>
        </p>
        <p className="text-xs text-white/45">
          Log weight to track progress toward your goal.
        </p>
      </div>
    );
  }

  const diffKg = Math.abs(targetKg - currentKg);
  const weeks = weeksToGoal(currentKg, targetKg, speedKg);
  const speedDisplay = speedKg
    ? `${speedKg > 0 ? "+" : "−"}${formatWeight(Math.abs(speedKg), unit, 1)}/wk`
    : null;
  // Threshold: 0.3 kg ≈ 0.66 lb. Use 0.3 kg internal for consistency.
  const reached = diffKg < 0.3;

  return (
    <div className="glass flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-accent-soft" />
        <CardTitle>Body goal</CardTitle>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Goal" value={formatWeight(targetKg, unit)} />
        <Stat label="Current" value={formatWeight(currentKg, unit)} />
      </div>

      {isMaintain ? (
        <p className="text-xs text-white/55">
          {reached
            ? `Maintaining around ${formatWeight(targetKg, unit)}.`
            : `${formatWeight(diffKg, unit)} from your maintain target.`}
        </p>
      ) : reached ? (
        <p className="text-xs text-emerald-300">Goal reached — nice work.</p>
      ) : (
        <p className="text-xs text-white/55">
          {formatWeight(diffKg, unit)} to go
          {weeks && speedDisplay ? ` · about ${weeks} weeks at ${speedDisplay}` : ""}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
