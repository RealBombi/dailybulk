"use client";

import { useEffect, useRef } from "react";
import { useAppData } from "@/lib/store";
import { creatineTakenOn } from "@/lib/selectors";
import { todayStr } from "@/lib/utils";
import {
  canUseNotifications,
  showNotification,
  REMINDER_SENT_KEY,
} from "@/lib/notifications";

const CHECK_MS = 15_000;
const DEBUG = process.env.NODE_ENV !== "production";

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
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

    const check = () => {
      const s = dataRef.current.settings;
      const today = todayStr();
      const taken = creatineTakenOn(dataRef.current, today);
      const permission = Notification.permission;
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const targetMin = minutesOf(s.creatineReminderTime);
      // Re-arms when the date OR the chosen time changes.
      const marker = `${today}|${s.creatineReminderTime}`;
      let sent = "";
      try {
        sent = window.localStorage.getItem(REMINDER_SENT_KEY) ?? "";
      } catch {
        /* ignore */
      }

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
          now: `${String(now.getHours()).padStart(2, "0")}:${String(
            now.getMinutes(),
          ).padStart(2, "0")}`,
          takenToday: taken,
          permission,
          lastSent: sent || "—",
          due,
        });
      }

      if (!due) return;

      try {
        window.localStorage.setItem(REMINDER_SENT_KEY, marker);
      } catch {
        /* ignore */
      }
      void showNotification(
        "Creatine reminder",
        `Don't forget your creatine (${s.creatineGoalGrams}g).`,
      );
    };

    check();
    const id = window.setInterval(check, CHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
