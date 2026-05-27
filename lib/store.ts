"use client";

import { useSyncExternalStore } from "react";
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
};

const defaultData: AppData = {
  settings: defaultSettings,
  foodEntries: [],
  savedMeals: [],
  creatineLogs: [],
  weightLogs: [],
};

let data: AppData = defaultData;
let loaded = false;
const listeners = new Set<() => void>();

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppData>;
      data = {
        ...defaultData,
        ...parsed,
        settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
        foodEntries: parsed.foodEntries ?? [],
        savedMeals: parsed.savedMeals ?? [],
        creatineLogs: parsed.creatineLogs ?? [],
        weightLogs: parsed.weightLogs ?? [],
      };
    }
  } catch {
    // Corrupt storage — fall back to defaults rather than crash.
    data = defaultData;
  }
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
