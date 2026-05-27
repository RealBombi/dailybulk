"use client";

import { motion } from "framer-motion";
import { Check, Flame, CalendarDays, Bell } from "lucide-react";
import { useAppData, setCreatine } from "@/lib/store";
import {
  creatineStreak,
  creatineTakenOn,
  creatineWeeklyCount,
  lastNDays,
} from "@/lib/selectors";
import { parseDateStr, shortDay, todayStr, toDateStr } from "@/lib/utils";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CreatinePage() {
  const data = useAppData();
  const today = todayStr();
  const taken = creatineTakenOn(data, today);
  const streak = creatineStreak(data);
  const weekly = creatineWeeklyCount(data);
  const grams = data.settings.creatineGoalGrams;
  const { creatineReminderEnabled, creatineReminderTime } = data.settings;

  return (
    <PageShell>
      <PageHeader title="Creatine" subtitle={`${grams}g daily goal`} />

      {creatineReminderEnabled && (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm">
          <Bell className="h-4 w-4 text-accent-soft" />
          <span className="text-white/70">
            {taken
              ? "Creatine done — no reminder needed today"
              : `Reminder set for ${creatineReminderTime}`}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3">
          <Flame className="h-7 w-7 text-orange-400" />
          <div>
            <p className="text-2xl font-bold">{streak}</p>
            <p className="text-xs text-white/50">day streak</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-accent-soft" />
          <div>
            <p className="text-2xl font-bold">{weekly}/7</p>
            <p className="text-xs text-white/50">this week</p>
          </div>
        </Card>
      </div>

      <Button
        size="lg"
        variant={taken ? "success" : "primary"}
        onClick={() => setCreatine(today, !taken, grams)}
        className="h-16 text-base"
      >
        {taken ? (
          <>
            <Check className="h-5 w-5" /> Taken — tap to undo
          </>
        ) : (
          "Took creatine"
        )}
      </Button>

      {/* Last 7 days strip */}
      <Card>
        <CardTitle>Last 7 days</CardTitle>
        <div className="mt-3 flex justify-between">
          {lastNDays(7).map((d) => {
            const on = creatineTakenOn(data, d);
            return (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <motion.div
                  initial={false}
                  animate={{ scale: on ? 1 : 0.9 }}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                    on
                      ? "bg-emerald-500 text-white shadow-[0_0_16px_-4px_rgba(16,185,129,0.8)]"
                      : "bg-white/5 text-white/30"
                  }`}
                >
                  {on ? <Check className="h-4 w-4" /> : ""}
                </motion.div>
                <span className="text-[10px] text-white/40">{shortDay(d)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <MonthCalendar data={data} grams={grams} />
    </PageShell>
  );
}

function MonthCalendar({
  data,
  grams,
}: {
  data: ReturnType<typeof useAppData>;
  grams: number;
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7; // Monday-first
  const monthLabel = first.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const cells: (string | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toDateStr(new Date(year, month, d)));
  }

  const today = todayStr();

  return (
    <Card>
      <CardTitle>{monthLabel}</CardTitle>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] text-white/30">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const on = creatineTakenOn(data, date);
          const isFuture = date > today;
          const day = parseDateStr(date).getDate();
          const isToday = date === today;
          return (
            <button
              key={i}
              disabled={isFuture}
              onClick={() => setCreatine(date, !on, grams)}
              className={`tap flex aspect-square items-center justify-center rounded-xl text-xs ${
                on
                  ? "bg-emerald-500/90 font-bold text-white"
                  : isFuture
                    ? "text-white/15"
                    : "bg-white/5 text-white/40"
              } ${isToday ? "ring-2 ring-accent" : ""}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
