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
import { fingerprint } from "./recent";

/**
 * Local-first data store.
 *
 * All app state lives in the browser (localStorage) so the app works
 * instantly with no login and fully offline. The public API here is a thin
 * repository layer: swapping it for Supabase later means re-implementing these
 * functions, not touching the UI.
 */

// Legacy storage key, kept stable across the DailyFuel rebrand so existing
// users' data and backups continue to load. Do not rename without a migration.
export const STORAGE_KEY = "dailybulk:v1";

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
  calorieReminderEnabled: false,
  calorieReminderTime: "21:00",
  calorieReminderThreshold: 700,
  onboardingCompleted: false,
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
      const parsed = JSON.parse(raw) as Partial<AppData>;
      data = coerce(parsed);
      // Migration: people already using the app shouldn't suddenly see the
      // welcome flow. If their backup predates onboarding, mark it done.
      if (parsed.settings && (parsed.settings as Settings).onboardingCompleted === undefined) {
        data = {
          ...data,
          settings: { ...data.settings, onboardingCompleted: true },
        };
      }
      // Migration: the old key-only `favorites` list is replaced by unified
      // saved foods. Fold any legacy favorite keys (resolved from logged
      // foods) into savedMeals so previously-starred foods keep showing up.
      data = migrateFavoritesToSaved(data);
    }
  } catch {
    // Corrupt storage — fall back to defaults rather than crash.
    data = defaultData;
  }
  hydrated = true;
}

/** Idempotently move legacy favorite keys into savedMeals (dedup by
 *  fingerprint). Then drops the favorites list so it's no longer the source
 *  of truth. Safe to re-run. */
function migrateFavoritesToSaved(d: AppData): AppData {
  if (!d.favorites || d.favorites.length === 0) return d;
  const savedKeys = new Set(d.savedMeals.map((m) => fingerprint(m)));
  const additions: SavedMeal[] = [];
  for (const key of d.favorites) {
    if (savedKeys.has(key)) continue;
    // Resolve the key from the most recent matching logged entry.
    const entry = [...d.foodEntries]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .find((e) => fingerprint(e) === key);
    if (!entry) continue;
    savedKeys.add(key);
    additions.push({
      name: entry.name,
      brand: entry.brand,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      amount: entry.amount,
      amountUnit: entry.amountUnit,
      source: savedMealSource(entry.source),
      externalId: entry.externalId,
      barcode: entry.barcode,
      id: uid(),
      createdAt: entry.createdAt,
    });
  }
  return {
    ...d,
    savedMeals: [...additions, ...d.savedMeals],
    favorites: [],
  };
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

// ---------------------------------------------------------------------------
// Non-React access — used by the cloud-sync engine (lib/sync.ts) to read the
// current data, react to changes, and apply data pulled from the cloud. This
// keeps sync logic outside the store while reusing the same source of truth.
// ---------------------------------------------------------------------------

/** Read the current app data (loads from localStorage on first call). */
export function getData(): AppData {
  load();
  return data;
}

/** Subscribe to any data change. Returns an unsubscribe function. */
export function subscribeData(cb: () => void): () => void {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Replace all app data wholesale (e.g. restoring from the cloud). Accepts a
 * partial/unknown shape and fills defaults, exactly like importing a backup.
 */
export function replaceAllData(raw: Partial<AppData>): void {
  set(coerce(raw));
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
    "File does not look like a DailyFuel backup.",
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
// Saved foods (the "star"). A saved food IS a saved meal — one unified store
// so starring a food makes it appear in Saved Foods (and Quick add favorites).
// ---------------------------------------------------------------------------

type SavedFoodInput = {
  name: string;
  brand?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  amount: number;
  amountUnit: SavedMeal["amountUnit"];
  source: string;
  externalId?: string;
  barcode?: string;
};

function savedMealSource(source: string): SavedMeal["source"] {
  return source === "usda" || source === "open_food_facts"
    ? source
    : "manual";
}

/** Is this food currently saved/starred? Matched by fingerprint. */
export function isFoodSaved(food: {
  source: string;
  externalId?: string;
  barcode?: string;
  name: string;
}): boolean {
  const key = fingerprint(food);
  return data.savedMeals.some((m) => fingerprint(m) === key);
}

/**
 * Star/unstar a food. Returns true if it is now saved, false if removed.
 * Deduped by fingerprint so the same food can't be saved twice.
 */
export function toggleSavedFood(food: SavedFoodInput): boolean {
  const key = fingerprint(food);
  const existing = data.savedMeals.find((m) => fingerprint(m) === key);
  if (existing) {
    set({
      ...data,
      savedMeals: data.savedMeals.filter((m) => m.id !== existing.id),
    });
    return false;
  }
  const created: SavedMeal = {
    name: food.name,
    brand: food.brand,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    amount: food.amount,
    amountUnit: food.amountUnit,
    source: savedMealSource(food.source),
    externalId: food.externalId,
    barcode: food.barcode,
    id: uid(),
    createdAt: new Date().toISOString(),
  };
  set({ ...data, savedMeals: [created, ...data.savedMeals] });
  return true;
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
