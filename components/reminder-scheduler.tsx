"use client";

import { useEffect, useRef } from "react";
import { useAppData } from "@/lib/store";
import { creatineTakenOn, totalsForDate } from "@/lib/selectors";
import { todayStr } from "@/lib/utils";
import {
  canUseNotifications,
  showNotification,
  REMINDER_SENT_KEY,
  CALORIE_REMINDER_SENT_KEY,
} from "@/lib/notifications";

const CHECK_MS = 15_000;
const DEBUG = process.env.NODE_ENV !== "production";

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/**
 * Best-effort local creatine reminder. While the app is open, once the chosen
 * time has passed and creatine isn't taken yet, it fires a single notification
 * for that day+time. Without server push it can't fire when the app is fully
 * closed — that's the documented limitation.
 */
export function ReminderScheduler() {
  const data = useAppData();
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!canUseNotifications()) return;

    const readMarker = (key: string): string => {
      try {
        return window.localStorage.getItem(key) ?? "";
      } catch {
        return "";
      }
    };
    const writeMarker = (key: string, value: string) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    };

    const check = () => {
      const s = dataRef.current.settings;
      const today = todayStr();
      const permission = Notification.permission;
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();

      // --- Creatine reminder -------------------------------------------------
      {
        const taken = creatineTakenOn(dataRef.current, today);
        const targetMin = minutesOf(s.creatineReminderTime);
        const marker = `${today}|${s.creatineReminderTime}`;
        const sent = readMarker(REMINDER_SENT_KEY);
        const due =
          s.creatineReminderEnabled &&
          permission === "granted" &&
          !taken &&
          nowMin >= targetMin &&
          sent !== marker;
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.debug("[creatine-reminder]", {
            enabled: s.creatineReminderEnabled,
            time: s.creatineReminderTime,
            now: hhmm(now),
            takenToday: taken,
            permission,
            lastSent: sent || "—",
            due,
          });
        }
        if (due) {
          writeMarker(REMINDER_SENT_KEY, marker);
          void showNotification(
            "Creatine reminder",
            `Don't forget your creatine (${s.creatineGoalGrams}g).`,
            "dailyfuel-creatine",
          );
        }
      }

      // --- Evening calorie reminder -----------------------------------------
      {
        const totals = totalsForDate(dataRef.current, today);
        const remaining = Math.max(s.calorieGoal - totals.calories, 0);
        const targetMin = minutesOf(s.calorieReminderTime);
        const marker = `${today}|${s.calorieReminderTime}`;
        const sent = readMarker(CALORIE_REMINDER_SENT_KEY);
        const due =
          s.calorieReminderEnabled &&
          permission === "granted" &&
          nowMin >= targetMin &&
          remaining >= s.calorieReminderThreshold &&
          sent !== marker;
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.debug("[calorie-reminder]", {
            enabled: s.calorieReminderEnabled,
            time: s.calorieReminderTime,
            now: hhmm(now),
            todayCalories: totals.calories,
            remaining,
            threshold: s.calorieReminderThreshold,
            permission,
            lastSent: sent || "—",
            due,
          });
        }
        if (due) {
          writeMarker(CALORIE_REMINDER_SENT_KEY, marker);
          // Small delay so that when both reminders are due in the same tick
          // the OS doesn't visually coalesce them into one banner. The calls
          // are independent and use distinct tags either way.
          window.setTimeout(() => {
            void showNotification(
              "DailyFuel calorie reminder",
              `You still need ${remaining} kcal today.`,
              "dailyfuel-calorie",
            );
          }, 1200);
        }
      }
    };

    check();
    const id = window.setInterval(check, CHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
