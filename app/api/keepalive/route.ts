import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Without this, Next prerenders the route at build time and the cron would hit
// a cached response instead of actually pinging Supabase.
export const dynamic = "force-dynamic";

/**
 * Supabase keep-alive, hit daily by Vercel Cron (see vercel.json). Free-tier
 * Supabase projects pause after ~a week without traffic; one authenticated
 * request a day keeps the project awake so login/sync don't go down.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, reason: "supabase not configured" });
  }
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok, status: res.status });
  } catch {
    return NextResponse.json({ ok: false, reason: "unreachable" }, { status: 502 });
  }
}
