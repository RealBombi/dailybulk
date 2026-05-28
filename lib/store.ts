"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import type {
  AppData,
  CreatineLog,
  FoodEntry,
  SavedMeal,
  Settings,
  WeightLog,
} from "./types";
import { todayStr, uid } from "./utils";

/**
 * Local-first data store.
 *
 * All app state lives in the browser (localStorage) so the app works
 * instantly with no login and fully offline. The public API here is a thin
 * repository layer: swapping it for Supabase later means re-implementing these
 * functions, not touching the UI.
 */

const STORAGE_KEY = "dailybulk:v1";

const defaultSettings: Settings = {
  calorieGoal: 3000,
  proteinGoal: 180,
  creatineGoalGrams: 5,
  weightUnit: "kg",
  theme: "dark",
  accentColor: "#6366f1",
  creatineReminderEnabled: false,
  creatineReminderTime: "22:00",
  notificationsEnabled: false,
};

const defaultData: AppData = {
  settings: defaultSettings,
  foodEntries: [],
  savedMeals: [],
  creatineLogs: [],
  weightLogs: [],
  favorites: [],
};

let data: AppData = defaultData;
let loaded = false;
let hydrated = false;
const listeners = new Set<() => void>();

/** Build a complete AppData from a partial/unknown shape, filling defaults. */
function coerce(parsed: Partial<AppData>): AppData {
  return {
    ...defaultData,
    ...parsed,
    settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
    foodEntries: parsed.foodEntries ?? [],
    savedMeals: parsed.savedMeals ?? [],
    creatineLogs: parsed.creatineLogs ?? [],
    weightLogs: parsed.weightLogs ?? [],
    favorites: parsed.favorites ?? [],
  };
}

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      data = coerce(JSON.parse(raw) as Partial<AppData>);
    }
  } catch {
    // Corrupt storage — fall back to defaults rather than crash.
    data = defaultData;
  }
  hydrated = true;
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota / private-mode errors.
  }
}

function emit(): void {
  listeners.forEach((l) => l());
}

function set(next: AppData): void {
  data = next;
  persist();
  emit();
}

function subscribe(cb: () => void): () => void {
  load();
  listeners.add(cb);
  // load() may have replaced `data` after the initial server snapshot.
  cb();
  return () => listeners.delete(cb);
}

function getSnapshot(): AppData {
  return data;
}

function getServerSnapshot(): AppData {
  return defaultData;
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True once localStorage has been read on the client. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hydrated,
    () => false,
  );
}

// ---------------------------------------------------------------------------
// Backup / restore
// ---------------------------------------------------------------------------

const importSchema = z
  .object({
    settings: z.record(z.unknown()).optional(),
    foodEntries: z.array(z.object({ id: z.string() }).passthrough()).optional(),
    savedMeals: z.array(z.object({ id: z.string() }).passthrough()).optional(),
    creatineLogs: z.array(z.object({ id: z.string() }).passthrough()).optional(),
    weightLogs: z.array(z.object({ id: z.string() }).passthrough()).optional(),
    favorites: z.array(z.string()).optional(),
  })
  .refine(
    (d) =>
      d.foodEntries ||
      d.savedMeals ||
      d.creatineLogs ||
      d.weightLogs ||
      d.settings ||
      d.favorites,
    "File does not look like a DailyBulk backup.",
  );

export type ImportResult = { ok: true } | { ok: false; error: string };

/** Validate a parsed backup object and, if valid, replace all app data. */
export function importData(raw: unknown): ImportResult {
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid backup file.",
    };
  }
  set(coerce(parsed.data as Partial<AppData>));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function updateSettings(patch: Partial<Settings>): void {
  set({ ...data, settings: { ...data.settings, ...patch } });
}

// ---------------------------------------------------------------------------
// Food entries
// ---------------------------------------------------------------------------

export function addFoodEntry(
  entry: Omit<FoodEntry, "id" | "createdAt" | "date"> & { date?: string },
): FoodEntry {
  const created: FoodEntry = {
    ...entry,
    id: uid(),
    date: entry.date ?? todayStr(),
    createdAt: new Date().toISOString(),
  };
  set({ ...data, foodEntries: [created, ...data.foodEntries] });
  return created;
}

export function updateFoodEntry(id: string, patch: Partial<FoodEntry>): void {
  set({
    ...data,
    foodEntries: data.foodEntries.map((e) =>
      e.id === id ? { ...e, ...patch } : e,
    ),
  });
}

export function deleteFoodEntry(id: string): void {
  set({ ...data, foodEntries: data.foodEntries.filter((e) => e.id !== id) });
}

// ---------------------------------------------------------------------------
// Saved meals
// ---------------------------------------------------------------------------

export function addSavedMeal(
  meal: Omit<SavedMeal, "id" | "createdAt">,
): SavedMeal {
  const created: SavedMeal = {
    ...meal,
    id: uid(),
    createdAt: new Date().toISOString(),
  };
  set({ ...data, savedMeals: [created, ...data.savedMeals] });
  return created;
}

export function deleteSavedMeal(id: string): void {
  set({ ...data, savedMeals: data.savedMeals.filter((m) => m.id !== id) });
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export function toggleFavorite(key: string): void {
  const has = data.favorites.includes(key);
  set({
    ...data,
    favorites: has
      ? data.favorites.filter((k) => k !== key)
      : [key, ...data.favorites],
  });
}

// ---------------------------------------------------------------------------
// Creatine
// ---------------------------------------------------------------------------

export function setCreatine(date: string, taken: boolean, grams: number): void {
  const existing = data.creatineLogs.find((l) => l.date === date);
  if (existing) {
    set({
      ...data,
      creatineLogs: data.creatineLogs.map((l) =>
        l.date === date ? { ...l, taken, grams } : l,
      ),
    });
  } else {
    const log: CreatineLog = {
      id: uid(),
      date,
      grams,
      taken,
      createdAt: new Date().toISOString(),
    };
    set({ ...data, creatineLogs: [log, ...data.creatineLogs] });
  }
}

export function toggleCreatine(date: string, grams: number): void {
  const existing = data.creatineLogs.find((l) => l.date === date);
  setCreatine(date, !(existing?.taken ?? false), grams);
}

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

export function logWeight(date: string, weight: number, unit: WeightLog["unit"]): void {
  const existing = data.weightLogs.find((l) => l.date === date);
  if (existing) {
    set({
      ...data,
      weightLogs: data.weightLogs.map((l) =>
        l.date === date ? { ...l, weight, unit } : l,
      ),
    });
  } else {
    const log: WeightLog = {
      id: uid(),
      date,
      weight,
      unit,
      createdAt: new Date().toISOString(),
    };
    set({ ...data, weightLogs: [log, ...data.weightLogs] });
  }
}

export function deleteWeightLog(id: string): void {
  set({ ...data, weightLogs: data.weightLogs.filter((l) => l.id !== id) });
}
