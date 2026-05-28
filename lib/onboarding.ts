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
};

export type CalculatorResult = {
  bmr: number;
  maintenanceKcal: number;
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

const round50 = (n: number) => Math.max(0, Math.round(n / 50) * 50);
const round5 = (n: number) => Math.max(0, Math.round(n / 5) * 5);

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
  const adjusted = maintenance + GOAL_DELTA[inputs.goal];
  const calorieGoal = Math.max(round50(adjusted), MIN_KCAL[inputs.sex]);
  const proteinGoal = round5(PROTEIN_G_PER_KG[inputs.goal] * inputs.weightKg);
  return {
    bmr: Math.round(bmr),
    maintenanceKcal: round50(maintenance),
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
