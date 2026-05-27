"use client";

export type PermissionState = NotificationPermission | "unsupported";

/** localStorage key holding the last-sent marker ("YYYY-MM-DD|HH:MM"). */
export const REMINDER_SENT_KEY = "dailybulk:lastCreatineReminder";

export function canUseNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): PermissionState {
  if (!canUseNotifications()) return "unsupported";
  return Notification.permission;
}

/** Request permission. Only ever call this from a user gesture (a click). */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!canUseNotifications()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Show a notification. Prefers the service worker registration (required for
 * notifications in an installed iOS PWA) and falls back to the Notification
 * constructor on desktop/Android.
 */
export async function showNotification(
  title: string,
  body?: string,
): Promise<boolean> {
  if (!canUseNotifications() || Notification.permission !== "granted") {
    return false;
  }
  const options: NotificationOptions = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "dailybulk-creatine-reminder",
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return true;
      }
    }
  } catch {
    // fall through to the constructor
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

export function showTestNotification(): Promise<boolean> {
  return showNotification(
    "DailyBulk reminder test",
    "Notifications are working.",
  );
}
