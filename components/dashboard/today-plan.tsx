"use client";

import Link from "next/link";
import { Bell, Check, Pill, Plus, Scale } from "lucide-react";
import { useAppData, setCreatine } from "@/lib/store";
import { totalsForDate, creatineTakenOn } from "@/lib/selectors";
import { round, todayStr } from "@/lib/utils";
import { CardTitle } from "@/components/ui/card";

export function TodayPlan() {
  const data = useAppData();
  const { settings } = data;
  const today = todayStr();
  const totals = totalsForDate(data, today);

  const calRemaining = Math.max(settings.calorieGoal - totals.calories, 0);
  const calHit = totals.calories >= settings.calorieGoal;
  const protRemaining = Math.max(settings.proteinGoal - totals.protein, 0);
  const protHit = totals.protein >= settings.proteinGoal && totals.protein > 0;
  const creatineTaken = creatineTakenOn(data, today);

  const calLabel = calHit
    ? "Calorie goal hit"
    : `${round(calRemaining)} kcal remaining`;
  const protLabel = protHit
    ? "Protein goal hit"
    : `${round(protRemaining)}g protein remaining`;

  return (
    <div className="glass flex flex-col gap-4 p-5">
      <CardTitle>Today plan</CardTitle>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Calories"
          value={calLabel}
          done={calHit}
        />
        <Stat label="Protein" value={protLabel} done={protHit} />
      </div>

      {/* Creatine row — tap to toggle */}
      <button
        onClick={() => setCreatine(today, !creatineTaken, settings.creatineGoalGrams)}
        className="tap flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            creatineTaken
              ? "bg-emerald-500 text-white"
              : "bg-white/5 text-white/50"
          }`}
        >
          {creatineTaken ? (
            <Check className="h-5 w-5" />
          ) : (
            <Pill className="h-4 w-4" />
          )}
        </span>
        <span className="flex-1 text-sm font-medium">
          {creatineTaken ? "Creatine done" : "Creatine not taken"}
        </span>
        {!creatineTaken && (
          <span className="text-xs font-medium text-accent-soft">
            Mark taken
          </span>
        )}
      </button>

      {/* Reminder status lines */}
      {(settings.creatineReminderEnabled || settings.calorieReminderEnabled) && (
        <div className="flex flex-col gap-1.5 text-xs text-white/45">
          {settings.creatineReminderEnabled && (
            <p className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-accent-soft" />
              {creatineTaken
                ? "Creatine done — no reminder needed today"
                : `Creatine reminder at ${settings.creatineReminderTime}`}
            </p>
          )}
          {settings.calorieReminderEnabled && (
            <p className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-accent-soft" />
              {calHit
                ? "Calorie goal hit — no evening reminder needed"
                : calRemaining < settings.calorieReminderThreshold
                  ? `Only ${round(calRemaining)} kcal left — no evening reminder`
                  : `Evening reminder at ${settings.calorieReminderTime} if more than ${settings.calorieReminderThreshold} kcal remain`}
            </p>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/food?mode=search"
          className="tap flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent to-accent-soft py-3 text-sm font-semibold text-white shadow-glow"
        >
          <Plus className="h-4 w-4" /> Add food
        </Link>
        <Link
          href="/weight"
          className="tap flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm font-medium text-white/80"
        >
          <Scale className="h-4 w-4 text-accent-soft" /> Log weight
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  done,
}: {
  label: string;
  value: string;
  done: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        done
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-white/5 bg-white/[0.03]"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p
        className={`mt-0.5 flex items-center gap-1 text-sm font-semibold ${
          done ? "text-emerald-200" : "text-white"
        }`}
      >
        {done && <Check className="h-4 w-4" />}
        {value}
      </p>
    </div>
  );
}
