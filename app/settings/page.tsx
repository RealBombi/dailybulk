"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Download, Sparkles, Trash2, Upload } from "lucide-react";
import { useAppData, updateSettings, importData, STORAGE_KEY } from "@/lib/store";
import { totalsForDate, latestWeightKg } from "@/lib/selectors";
import { formatWeight, todayStr } from "@/lib/utils";
import type { WeightUnit } from "@/lib/types";
import {
  notificationPermission,
  requestNotificationPermission,
  showTestNotification,
  type PermissionState,
} from "@/lib/notifications";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudSyncCard } from "@/components/settings/cloud-sync";
import { PushRemindersCard } from "@/components/settings/push-reminders";

const ACCENTS = ["#6366f1", "#22d3ee", "#34d399", "#f472b6", "#fbbf24"];

type Message = { tone: "ok" | "err"; text: string };

export default function SettingsPage() {
  const data = useAppData();
  const { settings } = data;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [perm, setPerm] = useState<PermissionState>("unsupported");
  const [notifMsg, setNotifMsg] = useState<string | null>(null);

  useEffect(() => {
    setPerm(notificationPermission());
  }, []);

  const enableNotifications = async () => {
    setNotifMsg(null);
    let p = notificationPermission();
    if (p === "unsupported") {
      setNotifMsg("Notifications aren't supported in this browser.");
      return;
    }
    if (p === "default") {
      p = await requestNotificationPermission();
      setPerm(p);
    }
    if (p === "granted") {
      updateSettings({ notificationsEnabled: true });
      const ok = await showTestNotification();
      setNotifMsg(
        ok
          ? "Notifications enabled — you should see a test notification."
          : "Permission granted, but this device couldn't show a notification.",
      );
    } else if (p === "denied") {
      updateSettings({ notificationsEnabled: false });
      setNotifMsg(
        "Notifications are blocked. Enable them in your browser or site settings to get reminders.",
      );
    } else {
      setNotifMsg("Notifications aren't supported in this browser.");
    }
  };

  const exportData = () => {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? "{}";
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dailyfuel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (file: File) => {
    setMessage(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = importData(json);
      if (result.ok) {
        setMessage({ tone: "ok", text: "Backup restored successfully." });
      } else {
        setMessage({ tone: "err", text: result.error });
      }
    } catch {
      setMessage({ tone: "err", text: "Couldn't read that file — is it a valid backup?" });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const reset = () => {
    if (
      window.confirm(
        "Delete all DailyFuel data on this device? This cannot be undone.",
      )
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
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

      <BodyGoalSettings router={router} />

      <Card className="flex flex-col gap-4">
        <CardTitle>Creatine reminder</CardTitle>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Daily reminder</span>
          <Toggle
            on={settings.creatineReminderEnabled}
            onChange={(v) => updateSettings({ creatineReminderEnabled: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Time</span>
          <input
            type="time"
            value={settings.creatineReminderTime}
            disabled={!settings.creatineReminderEnabled}
            onChange={(e) =>
              updateSettings({ creatineReminderTime: e.target.value })
            }
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm tabular-nums outline-none focus:border-accent/60 disabled:opacity-40 [color-scheme:dark]"
          />
        </div>

        <Button variant="secondary" onClick={enableNotifications}>
          <Bell className="h-4 w-4" />
          {perm === "granted" ? "Test notification" : "Enable notifications"}
        </Button>
        {notifMsg && <p className="text-xs text-white/60">{notifMsg}</p>}
        <p className="text-xs text-white/40">
          Fires while the app is open. For reminders with the app closed,
          enable Background reminders below.
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Evening calorie reminder</CardTitle>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Daily reminder</span>
          <Toggle
            on={settings.calorieReminderEnabled}
            onChange={(v) => updateSettings({ calorieReminderEnabled: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">Time</span>
          <input
            type="time"
            value={settings.calorieReminderTime}
            disabled={!settings.calorieReminderEnabled}
            onChange={(e) =>
              updateSettings({ calorieReminderTime: e.target.value })
            }
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm tabular-nums outline-none focus:border-accent/60 disabled:opacity-40 [color-scheme:dark]"
          />
        </div>
        <NumberSetting
          label="Threshold"
          suffix="kcal"
          value={settings.calorieReminderThreshold}
          step={50}
          onChange={(v) => updateSettings({ calorieReminderThreshold: v })}
        />
        <p className="text-xs text-white/40">
          Reminds you if you have more than {settings.calorieReminderThreshold}{" "}
          kcal left at this time.
        </p>
        {settings.calorieReminderEnabled && (
          <CalorieReminderStatus />
        )}
        {settings.calorieReminderEnabled && perm !== "granted" && (
          <p className="text-xs text-amber-300">
            Enable notifications above to allow this reminder.
          </p>
        )}
      </Card>

      <PushRemindersCard />

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

      <CloudSyncCard />

      <Card className="flex flex-col gap-3">
        <CardTitle>Data</CardTitle>
        <p className="text-xs text-white/40">
          Your data is stored on this device. Export a backup sometimes so you
          don&apos;t lose it.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportData} className="flex-1">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            className="flex-1"
          >
            <Upload className="h-4 w-4" /> Import
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
          }}
        />
        {message && (
          <p
            className={`text-xs ${
              message.tone === "ok" ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {message.text}
          </p>
        )}
        <Button variant="danger" onClick={reset}>
          <Trash2 className="h-4 w-4" /> Reset all data
        </Button>
      </Card>

      <p className="pb-2 text-center text-xs text-white/25">DailyFuel · v0.4.0</p>
    </PageShell>
  );
}

function BodyGoalSettings({
  router,
}: {
  router: ReturnType<typeof useRouter>;
}) {
  const data = useAppData();
  const { settings } = data;
  const unit = settings.weightUnit;
  const currentKg = latestWeightKg(data);
  const targetKg = settings.targetWeightKg;
  const speedKg = settings.goalSpeedKgPerWeek;
  const goalLabel =
    settings.goalType === "lose"
      ? "Lose weight"
      : settings.goalType === "maintain"
        ? "Maintain"
        : settings.goalType === "lean_bulk"
          ? "Lean gain"
          : settings.goalType === "bulk_faster"
            ? "Gain faster"
            : "—";
  const speedLabel = !speedKg
    ? "Maintain"
    : `${speedKg > 0 ? "+" : "−"}${formatWeight(Math.abs(speedKg), unit, 1)}/week`;

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>Body goal</CardTitle>
      {targetKg === undefined ? (
        <p className="text-xs text-white/45">
          No body goal yet. Run the setup to choose a target weight and weekly
          speed.
        </p>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <Row label="Goal" value={goalLabel} />
          <Row
            label="Current weight"
            value={currentKg !== undefined ? formatWeight(currentKg, unit) : "—"}
          />
          <Row label="Target weight" value={formatWeight(targetKg, unit)} />
          <Row label="Weekly speed" value={speedLabel} />
        </div>
      )}
      <Button variant="secondary" onClick={() => router.push("/welcome")}>
        <Sparkles className="h-4 w-4" />
        {targetKg === undefined ? "Set up body goal" : "Restart setup / recalculate goals"}
      </Button>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/55">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

function CalorieReminderStatus() {
  const data = useAppData();
  const { settings } = data;
  const todayCalories = totalsForDate(data, todayStr()).calories;
  const remaining = Math.max(settings.calorieGoal - todayCalories, 0);
  let text: string;
  if (remaining <= 0) {
    text = "Calorie goal hit — no reminder needed today";
  } else if (remaining < settings.calorieReminderThreshold) {
    text = `Only ${remaining} kcal remaining — no reminder needed`;
  } else {
    text = `Calorie reminder set for ${settings.calorieReminderTime} if more than ${settings.calorieReminderThreshold} kcal remain`;
  }
  return <p className="text-xs text-white/60">{text}</p>;
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`tap relative h-7 w-12 rounded-full transition-colors ${
        on ? "bg-accent" : "bg-white/15"
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
          on ? "left-6" : "left-1"
        }`}
      />
    </button>
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
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const n = Number(raw);
    if (raw.trim() !== "" && !Number.isNaN(n) && n >= 0) {
      onChange(n);
    } else {
      setText(String(value));
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-white/70">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - step))}
          className="tap h-9 w-9 shrink-0 rounded-full bg-white/5 text-lg text-white/70"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-16 rounded-xl border border-white/10 bg-white/5 px-1 py-1.5 text-center text-base font-semibold tabular-nums outline-none focus:border-accent/60"
        />
        <span className="w-7 text-xs text-white/40">{suffix}</span>
        <button
          onClick={() => onChange(value + step)}
          className="tap h-9 w-9 shrink-0 rounded-full bg-white/5 text-lg text-white/70"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
