export type WeightUnit = "kg" | "lbs";
export type Theme = "dark" | "light" | "system";

export type AmountUnit = "g" | "ml" | "serving" | "piece";
export type FoodSource =
  | "manual"
  | "open_food_facts"
  | "usda"
  | "saved_meal";

export type Settings = {
  calorieGoal: number;
  proteinGoal: number;
  creatineGoalGrams: number;
  weightUnit: WeightUnit;
  theme: Theme;
  accentColor: string;
  creatineReminderEnabled: boolean;
  creatineReminderTime: string; // "HH:MM" (24h)
  notificationsEnabled?: boolean;
  calorieReminderEnabled: boolean;
  calorieReminderTime: string; // "HH:MM" (24h)
  calorieReminderThreshold: number; // kcal
};

export type FoodEntry = {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  amount: number;
  amountUnit: AmountUnit;
  source: FoodSource;
  externalId?: string;
  barcode?: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack" | "other";
  date: string; // YYYY-MM-DD
  createdAt: string;
};

export type SavedMeal = {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  amount: number;
  amountUnit: AmountUnit;
  source?: "manual" | "open_food_facts" | "usda";
  externalId?: string;
  barcode?: string;
  createdAt: string;
};

export type CreatineLog = {
  id: string;
  date: string; // YYYY-MM-DD
  grams: number;
  taken: boolean;
  createdAt: string;
};

export type WeightLog = {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number;
  unit: WeightUnit;
  createdAt: string;
};

export type AppData = {
  settings: Settings;
  foodEntries: FoodEntry[];
  savedMeals: SavedMeal[];
  creatineLogs: CreatineLog[];
  weightLogs: WeightLog[];
  /** Dedupe fingerprints of foods the user has starred. */
  favorites: string[];
};
