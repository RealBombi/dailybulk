"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client.
 *
 * Cloud sync is *optional*. The app is local-first and must keep working with
 * no Supabase project configured, so this module never throws on import: if the
 * public env vars are missing it simply reports "not configured" and the UI
 * hides the cloud-sync features.
 *
 * Only the public anon key is used here. With Row Level Security enabled this
 * is safe to ship in the frontend bundle — never put a service-role key in
 * client code.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when both public env vars are present, so cloud features can show. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

/**
 * Returns the shared browser client, or null when Supabase isn't configured.
 * The client persists the auth session in localStorage and auto-refreshes
 * tokens, so a signed-in user stays signed in across reloads.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (typeof window === "undefined") return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "dailyfuel:auth",
      },
    });
  }
  return client;
}
