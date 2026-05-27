"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/lib/store";
import { creatineTakenOn } from "@/lib/selectors";
import { todayStr } from "@/lib/utils";
import { notificationPermission, REMINDER_SENT_KEY } from "@/lib/notifications";

const pad = (n: number) => String(n).padStart(2, "0");

export function ReminderDebug() {
  const data = useAppData();
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const s = data.settings;
  const now = new Date();
  const current = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds(),
  )}`;
  let lastSent = "—";
  try {
    lastSent = window.localStorage.getItem(REMINDER_SENT_KEY) || "—";
  } catch {
    /* ignore */
  }

  const rows: [string, string][] = [
    ["Reminder enabled", s.creatineReminderEnabled ? "yes" : "no"],
    ["Reminder time", s.creatineReminderTime],
    ["Current time", current],
    ["Taken today", creatineTakenOn(data, todayStr()) ? "yes" : "no"],
    ["Permission", notificationPermission()],
    ["Last sent", lastSent],
  ];

  return (
    <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs">
      <summary className="cursor-pointer select-none text-white/50">
        Reminder debug
      </summary>
      <div className="mt-2 flex flex-col gap-1 font-mono">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <span className="text-white/40">{k}</span>
            <span className="text-white/80">{v}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
