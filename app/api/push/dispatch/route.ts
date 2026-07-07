import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Push dispatch — walks push_subscriptions and sends due reminders.
 *
 * Trigger this every 5–15 minutes from any scheduler (cron-job.org, a host
 * cron after moving off Vercel, ...) with the shared secret:
 *   GET /api/push/dispatch  +  Authorization: Bearer <CRON_SECRET>
 *   (or ?secret=<CRON_SECRET> if the scheduler can't set headers)
 *
 * Idempotent per local day: each reminder is evaluated once per device per
 * day (last_*_sent markers), at or after the device's configured local time.
 * Reads user_data (the synced app payload) with the service-role key —
 * server-side only; the browser never sees that key.
 */

type ReminderSettings = {
  creatineReminderEnabled?: boolean;
  creatineReminderTime?: string; // "HH:MM"
  calorieReminderEnabled?: boolean;
  calorieReminderTime?: string; // "HH:MM"
  calorieReminderThreshold?: number;
  calorieGoal?: number;
};

type SubRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
  settings: ReminderSettings | null;
  last_creatine_sent: string | null;
  last_calorie_sent: string | null;
};

type AppPayload = {
  foodEntries?: { date?: string; calories?: number }[];
  creatineLogs?: { date?: string; taken?: boolean }[];
};

/** Local "YYYY-MM-DD" and "HH:MM" for an IANA timezone. */
function localNow(timezone: string): { date: string; time: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      // Intl can render midnight as "24" — normalize to "00".
      time: `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`,
    };
  } catch {
    const iso = new Date().toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  }
}

const isTime = (s: unknown): s is string =>
  typeof s === "string" && /^\d{2}:\d{2}$/.test(s);

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set." }, { status: 503 });
  }
  const url = new URL(request.url);
  const given =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret") ??
    "";
  if (given !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
    return NextResponse.json(
      { error: "Push dispatch isn't fully configured." },
      { status: 503 },
    );
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    vapidPublic,
    vapidPrivate,
  );

  // Service-role client: bypasses RLS; exists only inside this server route.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("*")
    .returns<SubRow[]>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, checked: 0 });
  }

  // One user_data fetch for all subscribed users.
  const userIds = Array.from(new Set(subs.map((s) => s.user_id)));
  const { data: dataRows } = await admin
    .from("user_data")
    .select("user_id, data")
    .in("user_id", userIds)
    .returns<{ user_id: string; data: AppPayload }[]>();
  const dataByUser = new Map((dataRows ?? []).map((r) => [r.user_id, r.data]));

  let sent = 0;
  const dead: string[] = [];

  const sendTo = async (sub: SubRow, payload: object): Promise<boolean> => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      return true;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // Gone/expired subscription — clean it up.
      if (status === 404 || status === 410) dead.push(sub.id);
      return false;
    }
  };

  for (const sub of subs) {
    const s = sub.settings ?? {};
    const { date, time } = localNow(sub.timezone || "UTC");
    const payload = dataByUser.get(sub.user_id) ?? {};
    const patch: Record<string, string> = {};

    // Creatine reminder: due once per local day, at/after the set time,
    // only if today's creatine isn't already logged as taken.
    if (
      s.creatineReminderEnabled &&
      isTime(s.creatineReminderTime) &&
      time >= s.creatineReminderTime &&
      sub.last_creatine_sent !== date
    ) {
      const taken = (payload.creatineLogs ?? []).some(
        (l) => l.date === date && l.taken,
      );
      if (!taken) {
        const ok = await sendTo(sub, {
          title: "Creatine reminder",
          body: "Not taken yet today — one tap and you're done.",
          tag: "dailyfuel-creatine",
          url: "/creatine",
        });
        if (ok) sent++;
      }
      // Mark handled either way so we don't re-check all evening.
      patch.last_creatine_sent = date;
    }

    // Evening calorie reminder: due once per local day if too much remains.
    if (
      s.calorieReminderEnabled &&
      isTime(s.calorieReminderTime) &&
      time >= s.calorieReminderTime &&
      sub.last_calorie_sent !== date
    ) {
      const eaten = (payload.foodEntries ?? [])
        .filter((e) => e.date === date)
        .reduce((sum, e) => sum + (e.calories ?? 0), 0);
      const goal = s.calorieGoal ?? 0;
      const threshold = s.calorieReminderThreshold ?? 0;
      const remaining = Math.round(goal - eaten);
      if (goal > 0 && remaining > threshold) {
        const ok = await sendTo(sub, {
          title: "Calorie check-in",
          body: `You still have ${remaining} kcal to go today.`,
          tag: "dailyfuel-calories",
          url: "/food",
        });
        if (ok) sent++;
      }
      patch.last_calorie_sent = date;
    }

    if (Object.keys(patch).length > 0) {
      await admin.from("push_subscriptions").update(patch).eq("id", sub.id);
    }
  }

  if (dead.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", dead);
  }

  return NextResponse.json({ sent, checked: subs.length, removed: dead.length });
}
