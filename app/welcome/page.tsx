"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity as ActivityIcon,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  Pill,
  ScanLine,
  Scale,
  Sparkles,
} from "lucide-react";
import { updateSettings, useAppData, useHydrated } from "@/lib/store";
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  SEX_LABELS,
  SPEED_OPTIONS,
  calculate,
  defaultSpeed,
  weeksToGoal,
  type Activity,
  type CalculatorInputs,
  type CalculatorResult,
  type GoalType,
  type Sex,
} from "@/lib/onboarding";
import { logWeight } from "@/lib/store";
import { todayStr } from "@/lib/utils";
import type { WeightUnit } from "@/lib/types";
import { Button } from "@/components/ui/button";
import Loading from "../loading";

type Step =
  | "welcome"
  | "choose"
  | "calc"
  | "result"
  | "manual";

type BodyGoal = {
  goalType: GoalType;
  currentKg: number;
  targetKg: number;
  speed: number;
  weeks: number | null;
};

export default function WelcomePage() {
  const router = useRouter();
  const data = useAppData();
  const hydrated = useHydrated();
  const [step, setStep] = useState<Step>("welcome");
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [bodyGoal, setBodyGoal] = useState<BodyGoal | null>(null);

  if (!hydrated) return <Loading />;

  const finish = () => {
    updateSettings({ onboardingCompleted: true });
    router.replace("/");
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-1 py-2">
      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <Slide key="welcome">
            <WelcomeStep
              onStart={() => setStep("choose")}
              onSkip={finish}
            />
          </Slide>
        )}
        {step === "choose" && (
          <Slide key="choose">
            <ChooseStep
              onCalc={() => setStep("calc")}
              onManual={() => setStep("manual")}
              onSkip={finish}
              onBack={() => setStep("welcome")}
            />
          </Slide>
        )}
        {step === "calc" && (
          <Slide key="calc">
            <CalcStep
              defaultUnit={data.settings.weightUnit}
              onBack={() => setStep("choose")}
              onResult={(r, bg) => {
                setResult(r);
                setBodyGoal(bg);
                setStep("result");
              }}
            />
          </Slide>
        )}
        {step === "result" && result && bodyGoal && (
          <Slide key="result">
            <ResultStep
              result={result}
              bodyGoal={bodyGoal}
              onBack={() => setStep("calc")}
              onUse={() => {
                updateSettings({
                  calorieGoal: result.calorieGoal,
                  proteinGoal: result.proteinGoal,
                  creatineGoalGrams: result.creatineGoalGrams,
                  goalType: bodyGoal.goalType,
                  targetWeightKg: bodyGoal.targetKg,
                  goalSpeedKgPerWeek: bodyGoal.speed,
                });
                // Seed a starting weight log so the body-goal card has data
                // immediately — only if the user hasn't logged any weight yet.
                if (data.weightLogs.length === 0) {
                  logWeight(
                    todayStr(),
                    bodyGoal.currentKg,
                    data.settings.weightUnit,
                  );
                }
                finish();
              }}
              onManual={() => setStep("manual")}
            />
          </Slide>
        )}
        {step === "manual" && (
          <Slide key="manual">
            <ManualStep onBack={() => setStep("choose")} onDone={finish} />
          </Slide>
        )}
      </AnimatePresence>
    </div>
  );
}

function Slide({
  children,
  ...rest
}: {
  children: React.ReactNode;
  key?: string;
}) {
  return (
    <motion.div
      {...rest}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Welcome
// ---------------------------------------------------------------------------

const FEATURES = [
  { icon: BarChart3, text: "Track calories and protein" },
  { icon: ScanLine, text: "Scan barcodes and search foods" },
  { icon: Pill, text: "Track creatine and build a streak" },
  { icon: Scale, text: "Track weight and see your trend" },
  { icon: Bell, text: "Get useful daily reminders" },
];

function WelcomeStep({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="flex flex-1 flex-col justify-center gap-6 py-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-accent to-accent-soft shadow-glow">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">DailyFuel</h1>
          <p className="max-w-xs text-sm text-white/55">
            A simple, fast way to track calories, protein, creatine and weight —
            and actually stay consistent.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {FEATURES.map(({ icon: Icon, text }, i) => (
            <motion.div
              key={text}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
            >
              <Icon className="h-5 w-5 text-accent-soft" />
              <span className="text-sm text-white/80">{text}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 pb-2">
        <Button size="lg" onClick={onStart}>
          Get started <ArrowRight className="h-5 w-5" />
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip setup
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Choose path
// ---------------------------------------------------------------------------

function ChooseStep({
  onCalc,
  onManual,
  onSkip,
  onBack,
}: {
  onCalc: () => void;
  onManual: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-4">
      <BackBar onBack={onBack} />
      <div className="flex flex-1 flex-col justify-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Set your goals</h2>
          <p className="mt-1 text-sm text-white/55">
            Choose how you&apos;d like to start. You can change everything later
            in Settings.
          </p>
        </div>
        <BigChoice
          icon={<Sparkles className="h-5 w-5" />}
          title="Calculate my goals"
          sub="Quick questionnaire — we estimate calories and protein"
          onClick={onCalc}
          primary
        />
        <BigChoice
          icon={<ActivityIcon className="h-5 w-5" />}
          title="Enter goals manually"
          sub="Already know your numbers? Type them in"
          onClick={onManual}
        />
        <BigChoice
          icon={<ArrowRight className="h-5 w-5" />}
          title="Skip for now"
          sub="Use sensible defaults (3000 kcal, 180g protein)"
          onClick={onSkip}
        />
      </div>
    </div>
  );
}

function BigChoice({
  icon,
  title,
  sub,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap flex items-center gap-4 rounded-3xl border px-5 py-4 text-left ${
        primary
          ? "border-accent/40 bg-accent/10"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          primary ? "bg-accent text-white" : "bg-white/5 text-accent-soft"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="block text-xs text-white/50">{sub}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-white/30" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Calculator
// ---------------------------------------------------------------------------

function CalcStep({
  defaultUnit,
  onBack,
  onResult,
}: {
  defaultUnit: WeightUnit;
  onBack: () => void;
  onResult: (r: CalculatorResult, b: BodyGoal) => void;
}) {
  const [goal, setGoal] = useState<GoalType>("lean_bulk");
  const [sex, setSex] = useState<Sex>("male");
  const [age, setAge] = useState("25");
  const [height, setHeight] = useState("180");
  const [weight, setWeight] = useState("80");
  const [activity, setActivity] = useState<Activity>("moderately");
  const [trainingDays, setTrainingDays] = useState(4);
  const [target, setTarget] = useState("75");
  const [speed, setSpeed] = useState<number>(defaultSpeed("lean_bulk") ?? 0.25);
  const [error, setError] = useState<string | null>(null);

  // When the goal changes, reset the speed pick to its sensible default and
  // nudge the target toward something matching the direction.
  const onGoalChange = (g: GoalType) => {
    setGoal(g);
    const s = defaultSpeed(g);
    if (s !== undefined) setSpeed(s);
    const cur = Number(weight) || 0;
    if (g === "lose" && cur > 0) setTarget(String(Math.max(40, cur - 5)));
    else if ((g === "lean_bulk" || g === "bulk_faster") && cur > 0)
      setTarget(String(cur + 5));
    else if (g === "maintain") setTarget(String(cur || 0));
  };

  const submit = () => {
    const ageN = Number(age);
    const heightN = Number(height);
    const weightN = Number(weight);
    if (
      !ageN || ageN < 13 || ageN > 100 ||
      !heightN || heightN < 120 || heightN > 230 ||
      !weightN || weightN < 30 || weightN > 300
    ) {
      setError("Please enter a realistic age, height (cm) and weight (kg).");
      return;
    }

    // Target weight validation (skipped for maintain — we just use current)
    let targetN: number;
    let speedN: number;
    if (goal === "maintain") {
      targetN = weightN;
      speedN = 0;
    } else {
      targetN = Number(target);
      speedN = speed;
      if (!targetN || targetN < 30 || targetN > 300) {
        setError("Pick a realistic target weight in kg.");
        return;
      }
      if (goal === "lose" && targetN >= weightN) {
        setError("Your target should be lower than your current weight to lose.");
        return;
      }
      if (
        (goal === "lean_bulk" || goal === "bulk_faster") &&
        targetN <= weightN
      ) {
        setError("Your target should be higher than your current weight to gain.");
        return;
      }
      if (!speedN) {
        setError("Pick a weekly speed to continue.");
        return;
      }
    }

    const inputs: CalculatorInputs = {
      goal,
      sex,
      age: ageN,
      heightCm: heightN,
      weightKg: weightN,
      activity,
      trainingDays,
    };
    const bg: BodyGoal = {
      goalType: goal,
      currentKg: weightN,
      targetKg: targetN,
      speed: speedN,
      weeks: weeksToGoal(weightN, targetN, speedN),
    };
    onResult(calculate(inputs), bg);
  };

  const speedOpts = SPEED_OPTIONS[goal];

  return (
    <div className="flex flex-1 flex-col px-4">
      <BackBar onBack={onBack} />
      <div className="flex flex-col gap-5 overflow-y-auto pb-4">
        <h2 className="text-2xl font-bold">A few quick questions</h2>

        <Field label="Your goal">
          <ChipGrid
            cols={2}
            options={GOAL_LABELS.map((g) => ({
              id: g.id,
              label: g.label,
              sub: g.sub,
            }))}
            value={goal}
            onChange={(v) => onGoalChange(v as GoalType)}
          />
        </Field>

        <Field label="Sex">
          <ChipGrid
            cols={3}
            options={SEX_LABELS}
            value={sex}
            onChange={(v) => setSex(v as Sex)}
          />
        </Field>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Age">
            <NumInput value={age} onChange={setAge} />
          </Field>
          <Field label="Height (cm)">
            <NumInput value={height} onChange={setHeight} />
          </Field>
          <Field label={`Weight (kg)`}>
            <NumInput value={weight} onChange={setWeight} />
          </Field>
        </div>

        <Field label="Activity level">
          <ChipGrid
            cols={1}
            options={ACTIVITY_LABELS}
            value={activity}
            onChange={(v) => setActivity(v as Activity)}
          />
        </Field>

        <Field label={`Training days per week: ${trainingDays}`}>
          <input
            type="range"
            min={0}
            max={7}
            value={trainingDays}
            onChange={(e) => setTrainingDays(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </Field>

        {goal !== "maintain" && (
          <>
            <Field label="Target weight (kg)">
              <NumInput value={target} onChange={setTarget} />
            </Field>
            <Field label="Goal speed">
              <ChipGrid
                cols={speedOpts.length === 3 ? 3 : 2}
                options={speedOpts.map((s) => ({
                  id: String(s.value),
                  label: s.label,
                  sub: s.sub,
                }))}
                value={String(speed)}
                onChange={(v) => setSpeed(Number(v))}
              />
            </Field>
          </>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}

        <Button size="lg" onClick={submit}>
          Calculate <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Result
// ---------------------------------------------------------------------------

function ResultStep({
  result,
  bodyGoal,
  onBack,
  onUse,
  onManual,
}: {
  result: CalculatorResult;
  bodyGoal: BodyGoal;
  onBack: () => void;
  onUse: () => void;
  onManual: () => void;
}) {
  const maintain = bodyGoal.goalType === "maintain";
  const speedLabel = maintain
    ? `Maintain around ${bodyGoal.targetKg} kg`
    : `${bodyGoal.speed > 0 ? "+" : ""}${bodyGoal.speed} kg/week`;
  const timelineLabel =
    maintain
      ? "—"
      : bodyGoal.weeks === null
        ? "—"
        : `about ${bodyGoal.weeks} weeks`;
  return (
    <div className="flex flex-1 flex-col px-4">
      <BackBar onBack={onBack} />
      <div className="flex flex-1 flex-col justify-center gap-4">
        <h2 className="text-2xl font-bold">Your starting goals</h2>

        <div className="flex flex-col gap-3">
          <ResultRow
            label="Maintenance"
            value={`${result.maintenanceKcal} kcal`}
            muted
          />
          <ResultRow
            label="Calorie goal"
            value={`${result.calorieGoal} kcal`}
            big
          />
          <ResultRow
            label="Protein goal"
            value={`${result.proteinGoal} g`}
            big
          />
          <ResultRow
            label="Creatine"
            value={`${result.creatineGoalGrams} g daily`}
          />
          <ResultRow
            label="Target weight"
            value={`${bodyGoal.targetKg} kg`}
          />
          <ResultRow label="Planned change" value={speedLabel} />
          <ResultRow label="Estimated time" value={timelineLabel} />
        </div>

        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/50">
          This is only an estimate. Adjust based on your real weight trend over
          2–3 weeks.
        </p>
      </div>

      <div className="flex flex-col gap-2 pb-2">
        <Button size="lg" onClick={onUse}>
          <Check className="h-5 w-5" /> Use these goals
        </Button>
        <Button variant="secondary" onClick={onManual}>
          Adjust manually
        </Button>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  big = false,
  muted = false,
}: {
  label: string;
  value: string;
  big?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
        big
          ? "border-accent/30 bg-accent/10"
          : "border-white/5 bg-white/[0.03]"
      }`}
    >
      <span className={`text-sm ${muted ? "text-white/45" : "text-white/70"}`}>
        {label}
      </span>
      <span
        className={`font-bold tabular-nums ${big ? "text-xl" : "text-base"} ${
          muted ? "text-white/60" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Manual
// ---------------------------------------------------------------------------

function ManualStep({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const data = useAppData();
  const [cal, setCal] = useState(String(data.settings.calorieGoal));
  const [prot, setProt] = useState(String(data.settings.proteinGoal));
  const [cre, setCre] = useState(String(data.settings.creatineGoalGrams));
  const [unit, setUnit] = useState<WeightUnit>(data.settings.weightUnit);

  const save = () => {
    updateSettings({
      calorieGoal: Math.max(0, Number(cal) || 0),
      proteinGoal: Math.max(0, Number(prot) || 0),
      creatineGoalGrams: Math.max(0, Number(cre) || 0),
      weightUnit: unit,
    });
    onDone();
  };

  return (
    <div className="flex flex-1 flex-col px-4">
      <BackBar onBack={onBack} />
      <div className="flex flex-1 flex-col justify-center gap-4">
        <h2 className="text-2xl font-bold">Enter your goals</h2>

        <Field label="Calorie goal (kcal)">
          <NumInput value={cal} onChange={setCal} />
        </Field>
        <Field label="Protein goal (g)">
          <NumInput value={prot} onChange={setProt} />
        </Field>
        <Field label="Creatine goal (g)">
          <NumInput value={cre} onChange={setCre} />
        </Field>
        <Field label="Weight unit">
          <div className="flex gap-1 rounded-full bg-white/5 p-0.5">
            {(["kg", "lbs"] as WeightUnit[]).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`tap flex-1 rounded-full px-4 py-2 text-sm ${
                  unit === u ? "bg-white text-bg" : "text-white/50"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="pb-2">
        <Button size="lg" onClick={save} className="w-full">
          <Check className="h-5 w-5" /> Save and start
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center py-2">
      <button
        onClick={onBack}
        className="tap flex items-center gap-1 rounded-full px-2 py-1.5 text-sm text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/45">
        {label}
      </label>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg font-semibold tabular-nums outline-none focus:border-accent/60 [color-scheme:dark]"
    />
  );
}

function ChipGrid({
  cols,
  options,
  value,
  onChange,
}: {
  cols: 1 | 2 | 3;
  options: { id: string; label: string; sub?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const grid =
    cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={`grid ${grid} gap-2`}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`tap rounded-2xl border px-3 py-2.5 text-left ${
              active
                ? "border-accent/50 bg-accent/15"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <span className="block text-sm font-medium">{o.label}</span>
            {o.sub && (
              <span className="block text-[11px] text-white/45">{o.sub}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
