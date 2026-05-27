"use client";

import { useEffect, useRef } from "react";
import { useAppData } from "@/lib/store";
import { creatineTakenOn } from "@/lib/selectors";
import { todayStr } from "@/lib/utils";
import { canUseNotifications, showNotification } from "@/lib/notifications";

const LAST_KEY = "dailybulk:lastCreatineReminder";

/**
 * Best-effort local creatine reminder. While the app is open, once the chosen
 * time has passed and creatine isn't taken yet, it fires a single notification
 * for the day. Without server push it can't fire when the app is fully closed
 * — that's the documented limitation.
 */
export function ReminderScheduler() {
  const data = useAppData();
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!canUseNotifications()) return;

    const check = () => {
      const d = dataRef.current;
      const s = d.settings;
      if (!s.creatineReminderEnabled) return;
      if (Notification.permission !== "granted") return;

      const today = todayStr();
      if (creatineTakenOn(d, today)) return;

      let last = "";
      try {
        last = window.localStorage.getItem(LAST_KEY) ?? "";
      } catch {
        /* ignore */
      }
      if (last === today) return;

      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
      ).padStart(2, "0")}`;
      if (current < s.creatineReminderTime) return;

      try {
        window.localStorage.setItem(LAST_KEY, today);
      } catch {
        /* ignore */
      }
      void showNotification(
        "Creatine reminder",
        `Don't forget your creatine (${s.creatineGoalGrams}g).`,
      );
    };

    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
