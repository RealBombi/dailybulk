"use client";

import { Download, Trash2 } from "lucide-react";
import { useAppData, updateSettings } from "@/lib/store";
import type { WeightUnit } from "@/lib/types";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ACCENTS = ["#6366f1", "#22d3ee", "#34d399", "#f472b6", "#fbbf24"];

export default function SettingsPage() {
  const { settings } = useAppData();

  const exportData = () => {
    const raw = window.localStorage.getItem("dailybulk:v1") ?? "{}";
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dailybulk-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    if (
      window.confirm(
        "Delete all DailyBulk data on this device? This cannot be undone.",
      )
    ) {
      window.localStorage.removeItem("dailybulk:v1");
      window.location.reload();
    }
  };

  return (
    <PageShell>
      <PageHeader title="Settings" subtitle="Goals and preferences" />

      <Card className="flex flex-col gap-4">
        <CardTitle>Daily goals</CardTitle>
        <NumberSetting
          label="Calorie goal"
          suffix="kcal"
          value={settings.calorieGoal}
          step={50}
          onChange={(v) => updateSettings({ calorieGoal: v })}
        />
        <NumberSetting
          label="Protein goal"
          suffix="g"
          value={settings.proteinGoal}
          step={5}
          onChange={(v) => updateSettings({ proteinGoal: v })}
        />
        <NumberSetting
          label="Creatine goal"
          suffix="g"
          value={settings.creatineGoalGrams}
          step={1}
          onChange={(v) => updateSettings({ creatineGoalGrams: v })}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Preferences</CardTitle>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Weight unit</span>
          <div className="flex gap-1 rounded-full bg-white/5 p-0.5">
            {(["kg", "lbs"] as WeightUnit[]).map((u) => (
              <button
                key={u}
                onClick={() => updateSettings({ weightUnit: u })}
                className={`tap rounded-full px-4 py-1.5 text-sm ${
                  settings.weightUnit === u
                    ? "bg-white text-bg"
                    : "text-white/50"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Accent</span>
          <div className="flex gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                onClick={() => updateSettings({ accentColor: c })}
                style={{ backgroundColor: c }}
                className={`tap h-7 w-7 rounded-full ${
                  settings.accentColor === c
                    ? "ring-2 ring-white ring-offset-2 ring-offset-bg"
                    : ""
                }`}
                aria-label={`Accent ${c}`}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>Data</CardTitle>
        <p className="text-xs text-white/40">
          Everything is stored privately on this device.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportData} className="flex-1">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button variant="danger" onClick={reset} className="flex-1">
            <Trash2 className="h-4 w-4" /> Reset
          </Button>
        </div>
      </Card>

      <p className="pb-2 text-center text-xs text-white/25">DailyBulk · v0.1</p>
    </PageShell>
  );
}

function NumberSetting({
  label,
  suffix,
  value,
  step,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/70">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - step))}
          className="tap h-9 w-9 rounded-full bg-white/5 text-lg text-white/70"
        >
          −
        </button>
        <span className="w-20 text-center text-base font-semibold tabular-nums">
          {value}
          <span className="text-xs font-normal text-white/40"> {suffix}</span>
        </span>
        <button
          onClick={() => onChange(value + step)}
          className="tap h-9 w-9 rounded-full bg-white/5 text-lg text-white/70"
        >
          +
        </button>
      </div>
    </div>
  );
}
