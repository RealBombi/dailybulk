/**
 * Calorie / protein goal calculator using Mifflin-St Jeor + an activity
 * multiplier. Returns rounded, clamped recommendations — "starting estimates"
 * that the user adjusts after seeing their weight trend.
 */

export type GoalType = "lose" | "maintain" | "lean_bulk" | "bulk_faster";
export type Sex = "male" | "female" | "neutral";
export type Activity =
  | "sedentary"
  | "lightly"
  | "moderately"
  | "very"
  | "athlete";

export type CalculatorInputs = {
  goal: GoalType;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  trainingDays: number;
  /** Optional weekly speed in kg/week. If provided it drives the calorie
   *  adjustment via the 7700 kcal/kg rule; otherwise the fixed goal delta
   *  fallback is used (e.g. for the manual flow). */
  speedKgPerWeek?: number;
};

export type CalculatorResult = {
  bmr: number;
  maintenanceKcal: number;
  /** Signed daily kcal adjustment actually applied (post-cap). */
  dailyAdjustmentKcal: number;
  calorieGoal: number;
  proteinGoal: number;
  creatineGoalGrams: number;
};

const ACTIVITY: Record<Activity, number> = {
  sedentary: 1.2,
  lightly: 1.375,
  moderately: 1.55,
  very: 1.725,
  athlete: 1.9,
};

const GOAL_DELTA: Record<GoalType, number> = {
  lose: -300,
  maintain: 0,
  lean_bulk: 300,
  bulk_faster: 500,
};

const PROTEIN_G_PER_KG: Record<GoalType, number> = {
  lose: 2.0,
  maintain: 1.6,
  lean_bulk: 1.8,
  bulk_faster: 1.8,
};

const MIN_KCAL: Record<Sex, number> = {
  male: 1500,
  female: 1200,
  neutral: 1400,
};

/** Rough rule of thumb: ~7700 kcal per kg of body mass. */
export const KCAL_PER_KG = 7700;
/** Safety cap on positive (gaining) daily adjustment to keep estimates sane. */
export const MAX_DAILY_SURPLUS = 700;

const round50 = (n: number) => Math.max(0, Math.round(n / 50) * 50);
const round5 = (n: number) => Math.max(0, Math.round(n / 5) * 5);

/** Signed daily kcal change from a weekly weight-change target. Surplus is
 *  capped at +MAX_DAILY_SURPLUS; deficit isn't capped here (the per-sex
 *  minimum kcal floor handles aggressive cuts). */
export function dailyAdjustmentKcal(speedKgPerWeek: number): number {
  const raw = (speedKgPerWeek * KCAL_PER_KG) / 7;
  return Math.round(raw > MAX_DAILY_SURPLUS ? MAX_DAILY_SURPLUS : raw);
}

export function calcBmr(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return base - 78; // neutral midpoint of (+5) and (-161)
}

export function calculate(inputs: CalculatorInputs): CalculatorResult {
  const bmr = calcBmr(inputs.sex, inputs.weightKg, inputs.heightCm, inputs.age);
  const maintenance = bmr * ACTIVITY[inputs.activity];

  // Prefer the user's selected weekly speed (7700 kcal/kg), fall back to the
  // fixed per-goal delta when no speed was picked (e.g. manual setup flow).
  const dailyAdj =
    inputs.speedKgPerWeek !== undefined
      ? dailyAdjustmentKcal(inputs.speedKgPerWeek)
      : GOAL_DELTA[inputs.goal];

  const adjusted = maintenance + dailyAdj;
  const calorieGoal = Math.max(round50(adjusted), MIN_KCAL[inputs.sex]);
  const proteinGoal = round5(PROTEIN_G_PER_KG[inputs.goal] * inputs.weightKg);
  return {
    bmr: Math.round(bmr),
    maintenanceKcal: round50(maintenance),
    dailyAdjustmentKcal: dailyAdj,
    calorieGoal,
    proteinGoal,
    creatineGoalGrams: 5,
  };
}

export const GOAL_LABELS: { id: GoalType; label: string; sub: string }[] = [
  { id: "lose", label: "Lose weight", sub: "−300 kcal" },
  { id: "maintain", label: "Maintain", sub: "stay the same" },
  { id: "lean_bulk", label: "Lean gain", sub: "+300 kcal" },
  { id: "bulk_faster", label: "Gain faster", sub: "+500 kcal" },
];

export const SEX_LABELS: { id: Sex; label: string }[] = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "neutral", label: "Prefer not to say" },
];

export const ACTIVITY_LABELS: { id: Activity; label: string; sub: string }[] = [
  { id: "sedentary", label: "Sedentary", sub: "mostly sitting" },
  { id: "lightly", label: "Lightly active", sub: "light walks" },
  { id: "moderately", label: "Moderately active", sub: "regular activity" },
  { id: "very", label: "Very active", sub: "hard training" },
  { id: "athlete", label: "Athlete", sub: "twice-a-day training" },
];

export type SpeedOption = { value: number; label: string; sub: string };

/** Weekly weight-change options per goal type. Empty for maintain. */
export const SPEED_OPTIONS: Record<GoalType, SpeedOption[]> = {
  lose: [
    { value: -0.25, label: "Slow cut", sub: "−0.25 kg/wk" },
    { value: -0.5, label: "Normal cut", sub: "−0.5 kg/wk" },
    { value: -0.75, label: "Aggressive cut", sub: "−0.75 kg/wk" },
  ],
  maintain: [],
  lean_bulk: [
    { value: 0.25, label: "Slow gain", sub: "+0.25 kg/wk" },
    { value: 0.5, label: "Moderate gain", sub: "+0.5 kg/wk" },
  ],
  bulk_faster: [
    { value: 0.5, label: "Moderate gain", sub: "+0.5 kg/wk" },
    { value: 0.75, label: "Faster gain", sub: "+0.75 kg/wk" },
  ],
};

/** Default speed pick when the user first sees options for this goal. */
export function defaultSpeed(goal: GoalType): number | undefined {
  if (goal === "maintain") return 0;
  if (goal === "lose") return -0.5;
  if (goal === "lean_bulk") return 0.25;
  if (goal === "bulk_faster") return 0.5;
  return undefined;
}

/** Whole weeks (rounded up) to reach target at the given weekly change. */
export function weeksToGoal(
  currentKg: number,
  targetKg: number,
  speedPerWeek: number,
): number | null {
  if (!speedPerWeek) return null;
  const diff = Math.abs(targetKg - currentKg);
  if (diff === 0) return 0;
  return Math.max(1, Math.ceil(diff / Math.abs(speedPerWeek)));
}
