"use client";

import { Target } from "lucide-react";
import { useAppData } from "@/lib/store";
import { latestWeight } from "@/lib/selectors";
import { round } from "@/lib/utils";
import { weeksToGoal } from "@/lib/onboarding";
import { CardTitle } from "@/components/ui/card";

export function BodyGoalCard() {
  const data = useAppData();
  const { settings } = data;
  const target = settings.targetWeightKg;
  if (target === undefined) return null;

  const latest = latestWeight(data);
  const unit = settings.weightUnit;
  const isMaintain = settings.goalType === "maintain" || !settings.goalSpeedKgPerWeek;
  const speed = settings.goalSpeedKgPerWeek ?? 0;

  // No weight data yet — point them to logging.
  if (!latest) {
    return (
      <div className="glass flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-accent-soft" />
          <CardTitle>Body goal</CardTitle>
        </div>
        <p className="text-sm text-white/70">
          Target: <span className="font-semibold text-white">{target} {unit}</span>
        </p>
        <p className="text-xs text-white/45">
          Log weight to track progress toward your goal.
        </p>
      </div>
    );
  }

  const current = latest.weight;
  const diff = round(Math.abs(target - current), 1);
  const weeks = weeksToGoal(current, target, speed);

  return (
    <div className="glass flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-accent-soft" />
        <CardTitle>Body goal</CardTitle>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Goal" value={`${target} ${unit}`} />
        <Stat label="Current" value={`${round(current, 1)} ${unit}`} />
      </div>

      {isMaintain ? (
        <p className="text-xs text-white/55">
          {diff < 0.5
            ? `Maintaining around ${target} ${unit}.`
            : `${diff} ${unit} from your maintain target.`}
        </p>
      ) : diff < 0.3 ? (
        <p className="text-xs text-emerald-300">Goal reached — nice work.</p>
      ) : (
        <p className="text-xs text-white/55">
          {diff} {unit} to go
          {weeks ? ` · about ${weeks} weeks at ${speed > 0 ? "+" : ""}${speed} ${unit}/wk` : ""}
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
