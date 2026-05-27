import type { Settings } from "./types";
import type { DayTotals } from "./selectors";

export type DailyStatus = {
  message: string;
  tone: "good" | "warn" | "info";
};

/**
 * Builds the dashboard's single dynamic status line from the day's progress.
 * Prioritises the most useful nudge: big calorie gaps, low protein, or praise.
 */
export function dailyStatus(
  totals: DayTotals,
  settings: Settings,
  creatineTaken: boolean,
  hour = new Date().getHours(),
): DailyStatus {
  const calRemaining = settings.calorieGoal - totals.calories;
  const proteinPct = settings.proteinGoal
    ? totals.protein / settings.proteinGoal
    : 1;

  if (totals.calories === 0) {
    return { message: "Nothing logged yet. Add your first meal.", tone: "info" };
  }

  // Evening warning when calories are very low (bulking — eating enough matters).
  if (hour >= 19 && calRemaining > settings.calorieGoal * 0.4) {
    return {
      message: `Low on calories — ${calRemaining} kcal still to go today.`,
      tone: "warn",
    };
  }

  if (calRemaining > 0) {
    if (proteinPct < 0.5) {
      return { message: "Protein is low today — aim higher.", tone: "warn" };
    }
    return {
      message: `You need ${calRemaining} kcal more to hit your goal.`,
      tone: "info",
    };
  }

  if (!creatineTaken) {
    return {
      message: "Calories hit. Don't forget your creatine.",
      tone: "info",
    };
  }

  return { message: "You're on track. Nice work today.", tone: "good" };
}
