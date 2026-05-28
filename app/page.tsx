"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAppData, useHydrated } from "@/lib/store";
import { totalsForDate, creatineTakenOn } from "@/lib/selectors";
import { dailyStatus } from "@/lib/status";
import { clampPercent, lighten, round, todayStr } from "@/lib/utils";
import Loading from "./loading";
import { Gauge } from "@/components/ui/gauge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { PageShell } from "@/components/page-shell";
import { CreatineCard } from "@/components/dashboard/creatine-card";
import { WeightCard } from "@/components/dashboard/weight-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { WeeklySummary } from "@/components/dashboard/weekly-summary";
import { HomeQuickAdd } from "@/components/dashboard/home-quick-add";
import { TodayPlan } from "@/components/dashboard/today-plan";
import { BodyGoalCard } from "@/components/dashboard/body-goal";

const toneStyles: Record<string, string> = {
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  info: "border-white/10 bg-white/[0.04] text-white/70",
};

export default function HomePage() {
  const data = useAppData();
  const hydrated = useHydrated();
  const router = useRouter();
  const today = todayStr();

  // Send first-time users to the welcome flow once we know their state.
  useEffect(() => {
    if (hydrated && !data.settings.onboardingCompleted) {
      router.replace("/welcome");
    }
  }, [hydrated, data.settings.onboardingCompleted, router]);

  // Avoid flashing default goals before localStorage has loaded (or while
  // redirecting a brand-new user to onboarding).
  if (!hydrated || !data.settings.onboardingCompleted) return <Loading />;
  const totals = totalsForDate(data, today);
  const { settings } = data;

  const caloriePercent = clampPercent(totals.calories, settings.calorieGoal);
  const proteinPercent = clampPercent(totals.protein, settings.proteinGoal);
  const remaining = Math.max(settings.calorieGoal - totals.calories, 0);
  const over = Math.max(totals.calories - settings.calorieGoal, 0);

  const status = dailyStatus(
    totals,
    settings,
    creatineTakenOn(data, today),
  );

  const greeting = new Date().getHours() < 12 ? "Good morning" : "Today";

  return (
    <PageShell>
      <header className="pt-1">
        <p className="text-sm text-white/45">{greeting}</p>
        <h1 className="text-2xl font-bold tracking-tight">DailyFuel</h1>
      </header>

      {/* Calorie gauge */}
      <div className="glass flex flex-col items-center gap-2 p-6">
        <Gauge
          value={caloriePercent}
          size={240}
          strokeWidth={18}
          gradientFrom={settings.accentColor}
          gradientTo={lighten(settings.accentColor, 0.35)}
        >
          <p className="text-xs uppercase tracking-widest text-white/40">
            Calories
          </p>
          <div className="flex items-end gap-1">
            <AnimatedNumber
              value={totals.calories}
              className="text-5xl font-bold tabular-nums"
            />
          </div>
          <p className="text-sm text-white/50">
            / {settings.calorieGoal} kcal
          </p>
          <p
            className={`mt-1 text-xs ${over > 0 ? "text-amber-300" : "text-accent-soft"}`}
          >
            {over > 0
              ? `${over} kcal over goal`
              : remaining > 0
                ? `${remaining} kcal remaining`
                : "Goal reached"}
          </p>
        </Gauge>
      </div>

      {/* Protein + macros */}
      <div className="glass flex items-center gap-5 p-5">
        <Gauge
          value={proteinPercent}
          size={104}
          strokeWidth={10}
          sweep={360}
          gradientFrom="#34d399"
          gradientTo="#22d3ee"
        >
          <span className="text-base font-bold tabular-nums">
            {proteinPercent}%
          </span>
        </Gauge>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-white/50">
            Protein
          </p>
          <p className="text-2xl font-bold">
            <AnimatedNumber value={round(totals.protein)} />
            <span className="text-base font-normal text-white/50">
              {" "}
              / {settings.proteinGoal}g
            </span>
          </p>
          <div className="mt-1 flex gap-3 text-xs text-white/45">
            <span>{round(totals.carbs)}g carbs</span>
            <span>{round(totals.fat)}g fat</span>
          </div>
        </div>
      </div>

      {/* Daily status */}
      <motion.div
        key={status.message}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border px-4 py-3 text-sm font-medium ${toneStyles[status.tone]}`}
      >
        {status.message}
      </motion.div>

      <TodayPlan />
      <QuickActions />
      <HomeQuickAdd />
      <CreatineCard />
      <WeightCard />
      <BodyGoalCard />
      <WeeklySummary />
    </PageShell>
  );
}
