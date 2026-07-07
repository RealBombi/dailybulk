"use client";

import { getSupabase } from "@/lib/supabase/client";
import { getData } from "@/lib/store";

/**
 * Background push reminders (v0.4.0).
 *
 * The device subscribes to Web Push and stores its subscription + a snapshot
 * of the reminder settings in Supabase (own-row RLS). A server-side dispatch
 * job (/api/push/dispatch) walks the subscriptions on a schedule and sends
 * notifications through the push service — so reminders fire with the app
 * closed. Requires being signed in (the row is keyed to the user) and, on
 * iOS, the app installed to the home screen.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function isPushConfigured(): boolean {
  return Boolean(PUBLIC_KEY);
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Reminder settings snapshot the dispatcher needs, taken from local data. */
export function reminderSnapshot() {
  const { settings } = getData();
  return {
    creatineReminderEnabled: settings.creatineReminderEnabled,
    creatineReminderTime: settings.creatineReminderTime,
    calorieReminderEnabled: settings.calorieReminderEnabled,
    calorieReminderTime: settings.calorieReminderTime,
    calorieReminderThreshold: settings.calorieReminderThreshold,
    calorieGoal: settings.calorieGoal,
  };
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) return reg;
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

export type PushResult = { ok: boolean; error?: string };

/** Persist the device's subscription + settings snapshot (upsert by endpoint). */
export async function saveSubscriptionToServer(
  sub: PushSubscription,
): Promise<PushResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Cloud sync isn't configured." };
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) {
    return { ok: false, error: "Sign in (Settings → Cloud sync) to enable background reminders." };
  }
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: "Subscription is missing keys — try again." };
  }
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: uid,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      settings: reminderSnapshot(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Subscribe this device to background reminders. Call from a user gesture. */
export async function enablePush(): Promise<PushResult> {
  if (!isPushConfigured()) {
    return { ok: false, error: "Push isn't configured on this server." };
  }
  if (!isPushSupported()) {
    return {
      ok: false,
      error:
        "This browser doesn't support push. On iPhone, add the app to your Home Screen first.",
    };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "Notifications are blocked for this site." };
  }
  const reg = await getRegistration();
  if (!reg) return { ok: false, error: "Service worker isn't available." };
  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY!) as BufferSource,
      }));
    return await saveSubscriptionToServer(sub);
  } catch {
    return { ok: false, error: "Couldn't subscribe this device to push." };
  }
}

/** Unsubscribe this device and remove it from the server. */
export async function disablePush(): Promise<PushResult> {
  const sub = await getExistingSubscription();
  if (sub) {
    const sb = getSupabase();
    if (sb) {
      await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
    try {
      await sub.unsubscribe();
    } catch {
      // best effort
    }
  }
  return { ok: true };
}

/** Re-upload the settings snapshot if this device is subscribed. */
export async function refreshServerSettings(): Promise<void> {
  const sub = await getExistingSubscription();
  if (sub) await saveSubscriptionToServer(sub);
}
