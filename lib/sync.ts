"use client";

import { useSyncExternalStore } from "react";
import type { AppData } from "./types";
import { getData, subscribeData, replaceAllData, STORAGE_KEY } from "./store";
import { getSupabase, isSupabaseConfigured } from "./supabase/client";

/**
 * Cloud-sync engine.
 *
 * Optional layer on top of the local-first store. When the user is signed in
 * (and Supabase is configured) local changes are debounced and pushed to a
 * single per-user JSONB row, and cloud changes can be pulled back. Without a
 * session — or without Supabase configured — this module is inert and the app
 * behaves exactly as before: fully local, no login required.
 *
 * Conflicts are never resolved by silently overwriting: when both sides have
 * diverged we surface a choice to the user and back up local data before any
 * destructive replace.
 */

export type SyncStatus = "local" | "syncing" | "synced" | "error" | "offline";

export type DataSummary = {
  foods: number;
  saved: number;
  weights: number;
  creatine: number;
  onboarded: boolean;
  updatedAt: string | null;
};

export type Conflict = {
  reason: "signin" | "remote-newer";
  local: DataSummary;
  cloud: DataSummary;
} | null;

export type SyncState = {
  /** Supabase env vars present — when false the cloud UI is hidden. */
  configured: boolean;
  /** Signed-in user's email, or null when signed out. */
  email: string | null;
  status: SyncStatus;
  lastSyncedAt: string | null;
  cloudUpdatedAt: string | null;
  /** Pending conflict awaiting a user decision, or null. */
  conflict: Conflict;
  /** Last human-readable error/info message, or null. */
  message: string | null;
};

const TABLE = "user_data";
const META_KEY = "dailyfuel:sync:v1";
const BACKUP_KEY = "dailyfuel:backup:pre-sync";
const DEBOUNCE_MS = 2000;

// ---------------------------------------------------------------------------
// Reactive state
// ---------------------------------------------------------------------------

let state: SyncState = {
  configured: isSupabaseConfigured(),
  email: null,
  status: "local",
  lastSyncedAt: null,
  cloudUpdatedAt: null,
  conflict: null,
  message: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const serverState: SyncState = { ...state };

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

export function getSyncState(): SyncState {
  return state;
}

// ---------------------------------------------------------------------------
// Sync metadata (device-local, kept out of the synced/exported payload)
// ---------------------------------------------------------------------------

type SyncMeta = {
  lastSyncedAt?: string;
  cloudUpdatedAt?: string;
  /** Hash of the data as of the last successful sync — used to detect local
   *  edits that haven't been pushed yet. */
  lastSyncedHash?: string;
};

function loadMeta(): SyncMeta {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as SyncMeta) : {};
  } catch {
    return {};
  }
}

function saveMeta(meta: SyncMeta): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore quota / private mode
  }
  setState({
    lastSyncedAt: meta.lastSyncedAt ?? null,
    cloudUpdatedAt: meta.cloudUpdatedAt ?? null,
  });
}

function clearMeta(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(META_KEY);
    } catch {
      // ignore
    }
  }
  setState({ lastSyncedAt: null, cloudUpdatedAt: null });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cheap, stable string hash for change detection (not cryptographic). */
function hashData(data: AppData): string {
  const json = JSON.stringify(data);
  let h = 5381;
  for (let i = 0; i < json.length; i++) {
    h = (h * 33) ^ json.charCodeAt(i);
  }
  return (h >>> 0).toString(36) + ":" + json.length.toString(36);
}

function hasData(d: AppData): boolean {
  return (
    d.foodEntries.length > 0 ||
    d.savedMeals.length > 0 ||
    d.creatineLogs.length > 0 ||
    d.weightLogs.length > 0 ||
    Boolean(d.settings.onboardingCompleted) ||
    d.settings.targetWeightKg !== undefined
  );
}

function summarize(d: Partial<AppData>, updatedAt: string | null): DataSummary {
  return {
    foods: d.foodEntries?.length ?? 0,
    saved: d.savedMeals?.length ?? 0,
    weights: d.weightLogs?.length ?? 0,
    creatine: d.creatineLogs?.length ?? 0,
    onboarded: Boolean(d.settings?.onboardingCompleted),
    updatedAt,
  };
}

/** Best-effort local backup of the current data before a destructive replace. */
function backupLocal(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) window.localStorage.setItem(BACKUP_KEY, raw);
  } catch {
    // ignore
  }
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

// ---------------------------------------------------------------------------
// Engine internals
// ---------------------------------------------------------------------------

let initialized = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
/** Set while we're writing cloud data into the store, to avoid echo-uploads. */
let applyingRemote = false;
/** An upload was deferred because we're offline; retry when back online. */
let pendingUpload = false;
/** Raw cloud row stashed while a conflict awaits the user's decision. */
let pendingCloud: { data: Partial<AppData>; updatedAt: string } | null = null;

type CloudRow = { data: Partial<AppData>; updated_at: string } | null;

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

async function fetchCloud(): Promise<CloudRow> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from(TABLE)
    .select("data, updated_at")
    .maybeSingle();
  if (error) throw error;
  return (data as CloudRow) ?? null;
}

/** Push the current local data to the cloud (upsert one row per user). */
export async function uploadLocalToCloud(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const uid = await currentUserId();
  if (!uid) return;

  if (isOffline()) {
    pendingUpload = true;
    setState({ status: "offline", message: "Offline — will sync when online." });
    return;
  }

  setState({ status: "syncing", message: null });
  const data = getData();
  const updatedAt = new Date().toISOString();
  try {
    const { error } = await sb
      .from(TABLE)
      .upsert(
        { user_id: uid, data, updated_at: updatedAt },
        { onConflict: "user_id" },
      );
    if (error) throw error;
    pendingUpload = false;
    saveMeta({
      lastSyncedAt: updatedAt,
      cloudUpdatedAt: updatedAt,
      lastSyncedHash: hashData(data),
    });
    setState({ status: "synced", message: null });
  } catch (err) {
    if (isOffline()) {
      pendingUpload = true;
      setState({ status: "offline", message: "Offline — will sync when online." });
    } else {
      setState({ status: "error", message: errMsg(err) });
    }
  }
}

/** Replace local data with the given cloud row, backing up local first. */
function applyCloud(row: { data: Partial<AppData>; updated_at: string }): void {
  applyingRemote = true;
  backupLocal();
  replaceAllData(row.data);
  saveMeta({
    lastSyncedAt: row.updated_at,
    cloudUpdatedAt: row.updated_at,
    lastSyncedHash: hashData(getData()),
  });
  setState({ status: "synced", message: null, conflict: null });
  // Release the guard after the store has emitted to its listeners.
  setTimeout(() => {
    applyingRemote = false;
  }, 0);
}

/** Pull cloud data and overwrite local (used by the explicit "Replace" button
 *  and the "Use cloud" conflict choice). */
export async function replaceLocalWithCloud(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  setState({ status: "syncing", message: null });
  try {
    const row = await fetchCloud();
    if (!row) {
      setState({ status: "synced", message: "No cloud data to restore." });
      return;
    }
    applyCloud(row);
  } catch (err) {
    setState({ status: "error", message: errMsg(err) });
  }
}

/** Reconcile local and cloud after sign-in or on app load. */
async function reconcile(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  setState({ status: "syncing", message: null });
  try {
    const row = await fetchCloud();
    const local = getData();
    const localHash = hashData(local);
    const meta = loadMeta();

    // No cloud data yet → seed it from local.
    if (!row) {
      await uploadLocalToCloud();
      return;
    }

    // Cloud has data but this device is empty → safe to restore silently.
    if (!hasData(local)) {
      applyCloud(row);
      return;
    }

    const cloudNewer =
      !meta.lastSyncedAt || row.updated_at > meta.lastSyncedAt;
    const localDirty = localHash !== meta.lastSyncedHash;

    if (!cloudNewer) {
      // Local is at least as new. Push local edits if any, else we're in sync.
      if (localDirty) {
        await uploadLocalToCloud();
      } else {
        saveMeta({ ...meta, cloudUpdatedAt: row.updated_at });
        setState({ status: "synced", message: null });
      }
      return;
    }

    // Cloud is newer.
    if (!localDirty) {
      // No unsynced local edits → safe to pull.
      applyCloud(row);
      return;
    }

    // Both sides changed → ask the user. Never overwrite silently.
    pendingCloud = { data: row.data, updatedAt: row.updated_at };
    setState({
      status: "synced",
      message: null,
      conflict: {
        reason: meta.lastSyncedAt ? "remote-newer" : "signin",
        local: summarize(local, meta.lastSyncedAt ?? null),
        cloud: summarize(row.data, row.updated_at),
      },
    });
  } catch (err) {
    if (isOffline()) {
      setState({ status: "offline", message: "Offline — using local data." });
    } else {
      setState({ status: "error", message: errMsg(err) });
    }
  }
}

function errMsg(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Sync failed.";
}

// ---------------------------------------------------------------------------
// Auto-sync on local changes (debounced)
// ---------------------------------------------------------------------------

function scheduleAutoSync(): void {
  if (applyingRemote) return; // change came from a cloud pull, don't echo it
  if (!state.email) return; // not signed in
  if (state.conflict) return; // wait for the user to resolve first

  const meta = loadMeta();
  if (hashData(getData()) === meta.lastSyncedHash) return; // nothing changed

  if (debounceTimer) clearTimeout(debounceTimer);
  setState({ status: "syncing", message: null });
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void uploadLocalToCloud();
  }, DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Public auth API
// ---------------------------------------------------------------------------

export type AuthResult = {
  ok: boolean;
  error?: string;
  /** True when sign-up succeeded but email confirmation is required. */
  needsConfirmation?: boolean;
};

export async function signUp(
  email: string,
  password: string,
): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Cloud sync is not configured." };
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };
  // When email confirmation is on, there's no session until the user confirms.
  if (!data.session) {
    return { ok: true, needsConfirmation: true };
  }
  return { ok: true };
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Cloud sync is not configured." };
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingCloud = null;
  pendingUpload = false;
  await sb.auth.signOut();
  clearMeta();
  setState({
    email: null,
    status: "local",
    conflict: null,
    message: null,
  });
}

/** Force an immediate upload (the "Sync now" button). */
export async function syncNow(): Promise<void> {
  if (!state.email) return;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  await uploadLocalToCloud();
}

/** Resolve a pending conflict. */
export async function resolveConflict(
  choice: "keepLocal" | "useCloud",
): Promise<void> {
  const cloud = pendingCloud;
  pendingCloud = null;
  setState({ conflict: null });
  if (choice === "keepLocal") {
    await uploadLocalToCloud();
  } else if (cloud) {
    applyCloud({ data: cloud.data, updated_at: cloud.updatedAt });
  } else {
    await replaceLocalWithCloud();
  }
}

export function dismissMessage(): void {
  setState({ message: null });
}

// ---------------------------------------------------------------------------
// Initialization (called once from a client component on mount)
// ---------------------------------------------------------------------------

export function initSync(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  setState({ configured: isSupabaseConfigured() });
  const meta = loadMeta();
  setState({
    lastSyncedAt: meta.lastSyncedAt ?? null,
    cloudUpdatedAt: meta.cloudUpdatedAt ?? null,
  });

  const sb = getSupabase();
  if (!sb) return; // not configured — stay fully local

  // React to local data changes → debounced auto-sync.
  subscribeData(scheduleAutoSync);

  // Retry deferred uploads when connectivity returns.
  window.addEventListener("online", () => {
    if (state.email && pendingUpload) void uploadLocalToCloud();
  });
  window.addEventListener("offline", () => {
    if (state.email) setState({ status: "offline" });
  });

  // Restore an existing session and reconcile.
  void sb.auth.getSession().then(({ data }) => {
    const session = data.session;
    if (session?.user) {
      setState({ email: session.user.email ?? null });
      void reconcile();
    }
  });

  // Handle sign-in / sign-out happening after load.
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      // Avoid double-reconcile: only run when the email actually changes.
      if (state.email !== (session.user.email ?? null)) {
        setState({ email: session.user.email ?? null });
        void reconcile();
      }
    } else if (event === "SIGNED_OUT") {
      setState({ email: null, status: "local", conflict: null });
    }
  });
}
