import type { AppData, FoodEntry, WeightLog } from "./types";
import { addDays, round, todayStr } from "./utils";

export type DayTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function entriesForDate(data: AppData, date: string): FoodEntry[] {
  return data.foodEntries
    .filter((e) => e.date === date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function totalsForDate(data: AppData, date: string): DayTotals {
  return entriesForDate(data, date).reduce<DayTotals>(
    (acc, e) => ({
      calories: acc.calories + (e.calories || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function creatineTakenOn(data: AppData, date: string): boolean {
  return data.creatineLogs.find((l) => l.date === date)?.taken ?? false;
}

/** Consecutive days (ending today) with creatine taken. */
export function creatineStreak(data: AppData): number {
  let streak = 0;
  let cursor = todayStr();
  // If today isn't taken yet, the streak is whatever ran up to yesterday.
  if (!creatineTakenOn(data, cursor)) {
    cursor = addDays(cursor, -1);
  }
  while (creatineTakenOn(data, cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Last N days as date strings, oldest first. */
export function lastNDays(n: number, end = todayStr()): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(addDays(end, -i));
  }
  return days;
}

export function creatineWeeklyCount(data: AppData): number {
  return lastNDays(7).filter((d) => creatineTakenOn(data, d)).length;
}

export function latestWeight(data: AppData): WeightLog | undefined {
  return [...data.weightLogs].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function weightSeries(data: AppData): WeightLog[] {
  return [...data.weightLogs].sort((a, b) => a.date.localeCompare(b.date));
}

export function weeklyAverageWeight(data: AppData): number | undefined {
  const recent = weightSeries(data).filter((l) =>
    lastNDays(7).includes(l.date),
  );
  if (recent.length === 0) return undefined;
  const sum = recent.reduce((a, l) => a + l.weight, 0);
  return round(sum / recent.length, 1);
}

export type Trend = "up" | "down" | "stable";

export function weightTrend(data: AppData): Trend | undefined {
  const series = weightSeries(data);
  if (series.length < 2) return undefined;
  const first = series[0].weight;
  const last = series[series.length - 1].weight;
  const diff = last - first;
  if (Math.abs(diff) < 0.3) return "stable";
  return diff > 0 ? "up" : "down";
}
