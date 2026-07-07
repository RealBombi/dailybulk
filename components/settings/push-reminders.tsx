"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import {
  isPushConfigured,
  isPushSupported,
  getExistingSubscription,
  enablePush,
  disablePush,
  refreshServerSettings,
} from "@/lib/push/client";
import { useAppData } from "@/lib/store";
import { useSyncState } from "@/lib/sync";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Background push reminders card. Subscribes this device to Web Push so the
 * creatine / evening-calorie reminders configured above fire even when the
 * app is closed. Requires sign-in (subscriptions are stored per-user) and,
 * on iOS, the app installed to the Home Screen.
 */
export function PushRemindersCard() {
  const { settings } = useAppData();
  const sync = useSyncState();
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = checking
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushConfigured() || !isPushSupported()) {
      setEnabled(false);
      return;
    }
    void getExistingSubscription().then((sub) => setEnabled(Boolean(sub)));
  }, []);

  // Keep the server's snapshot in sync when reminder settings change.
  const settingsKey = JSON.stringify([
    settings.creatineReminderEnabled,
    settings.creatineReminderTime,
    settings.calorieReminderEnabled,
    settings.calorieReminderTime,
    settings.calorieReminderThreshold,
    settings.calorieGoal,
  ]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!enabled) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void refreshServerSettings();
    }, 2000);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey, enabled]);

  if (!isPushConfigured()) return null;

  const toggle = async () => {
    setBusy(true);
    setMessage(null);
    if (enabled) {
      await disablePush();
      setEnabled(false);
      setMessage("Background reminders turned off on this device.");
    } else {
      const res = await enablePush();
      if (res.ok) {
        setEnabled(true);
        setMessage("This device will now get reminders even when the app is closed.");
      } else {
        setMessage(res.error ?? "Couldn't enable push on this device.");
      }
    }
    setBusy(false);
  };

  const signedOut = !sync.email;

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Background reminders</CardTitle>
      <p className="text-xs leading-relaxed text-white/45">
        Get the reminders above as real notifications, even with the app
        closed. Uses the times and thresholds you set in the reminder cards.
      </p>
      {signedOut ? (
        <p className="text-xs text-amber-300/90">
          Sign in (Cloud sync below) to enable background reminders — they're
          delivered per account.
        </p>
      ) : (
        <Button
          variant={enabled ? "secondary" : "primary"}
          onClick={() => void toggle()}
          disabled={busy || enabled === null}
        >
          {enabled ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
          {enabled === null
            ? "Checking…"
            : enabled
              ? "Disable on this device"
              : "Enable on this device"}
        </Button>
      )}
      {message && <p className="text-xs text-white/60">{message}</p>}
      <p className="text-[11px] leading-relaxed text-white/35">
        iPhone: add DailyFuel to your Home Screen first (Share → Add to Home
        Screen), then enable here. Each device is enabled separately.
      </p>
    </Card>
  );
}
