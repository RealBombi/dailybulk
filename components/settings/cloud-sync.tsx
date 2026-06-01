"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
} from "lucide-react";
import {
  useSyncState,
  signIn,
  signUp,
  signOut,
  syncNow,
  uploadLocalToCloud,
  replaceLocalWithCloud,
  resolveConflict,
  type SyncStatus,
  type DataSummary,
} from "@/lib/sync";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<SyncStatus, string> = {
  local: "Local only",
  syncing: "Syncing…",
  synced: "Synced",
  error: "Sync error",
  offline: "Offline",
};

const STATUS_COLOR: Record<SyncStatus, string> = {
  local: "text-white/50",
  syncing: "text-amber-300",
  synced: "text-emerald-300",
  error: "text-red-300",
  offline: "text-amber-300",
};

const REPLACE_WARNING = "This will replace the data on this device.";

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function CloudSyncCard() {
  const sync = useSyncState();

  // Cloud sync isn't configured for this deployment — keep the app local-only
  // and don't show anything that implies an account is possible.
  if (!sync.configured) {
    return (
      <Card className="flex flex-col gap-3">
        <CardTitle>Cloud sync</CardTitle>
        <p className="text-xs text-white/40">
          Your data is stored on this device. Cloud sync isn&apos;t set up for
          this build — use Export below to back up your data.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <CardTitle>Cloud sync</CardTitle>
        <StatusPill sync={sync} />
      </div>

      {sync.conflict && <ConflictPanel conflict={sync.conflict} />}

      {sync.email ? (
        <SignedIn email={sync.email} sync={sync} />
      ) : (
        <SignedOut />
      )}

      {sync.message && (
        <p className="text-xs text-white/55">{sync.message}</p>
      )}
    </Card>
  );
}

function StatusPill({ sync }: { sync: ReturnType<typeof useSyncState> }) {
  if (!sync.email) {
    return <span className="text-xs text-white/40">Local only</span>;
  }
  return (
    <span className={`text-xs font-medium ${STATUS_COLOR[sync.status]}`}>
      {STATUS_LABEL[sync.status]}
    </span>
  );
}

function SignedOut() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <>
        <p className="text-xs text-white/45">
          Your data is stored on this device. Sign in to back it up and sync
          across your devices. This is optional — the app works fully without
          an account.
        </p>
        <Button onClick={() => setOpen(true)}>
          <LogIn className="h-4 w-4" /> Sign in / Create account
        </Button>
      </>
    );
  }
  return <AuthForm onCancel={() => setOpen(false)} />;
}

function AuthForm({ onCancel }: { onCancel: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const fn = mode === "signin" ? signIn : signUp;
    const res = await fn(email.trim(), password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    if (res.needsConfirmation) {
      setInfo("Check your email to confirm your account, then sign in.");
      setMode("signin");
      setPassword("");
      return;
    }
    // Signed in — the auth listener takes over from here.
    onCancel();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-full bg-white/5 p-0.5">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
            }}
            className={`tap flex-1 rounded-full px-4 py-1.5 text-sm ${
              mode === m ? "bg-white text-bg" : "text-white/50"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
      />
      <input
        type="password"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        required
        minLength={6}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-accent/60"
      />

      {error && <p className="text-xs text-red-300">{error}</p>}
      {info && <p className="text-xs text-emerald-300">{info}</p>}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </Button>
      </div>
    </form>
  );
}

function SignedIn({
  email,
  sync,
}: {
  email: string;
  sync: ReturnType<typeof useSyncState>;
}) {
  const onReplace = async () => {
    if (window.confirm(`${REPLACE_WARNING}\n\nReplace this device's data with the cloud copy? A local backup is kept automatically.`)) {
      await replaceLocalWithCloud();
    }
  };
  const onUpload = async () => {
    if (
      window.confirm(
        "Upload this device's data to the cloud, overwriting the cloud copy?",
      )
    ) {
      await uploadLocalToCloud();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <Cloud className="h-4 w-4 text-white/50" />
        <span className="truncate font-medium text-white">{email}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>Last synced</span>
        <span className="tabular-nums">{relativeTime(sync.lastSyncedAt)}</span>
      </div>

      <Button
        variant="secondary"
        onClick={() => void syncNow()}
        disabled={sync.status === "syncing"}
      >
        <RefreshCw
          className={`h-4 w-4 ${sync.status === "syncing" ? "animate-spin" : ""}`}
        />
        Sync now
      </Button>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onUpload}>
          <UploadCloud className="h-4 w-4" /> Upload
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onReplace}>
          <DownloadCloud className="h-4 w-4" /> Restore
        </Button>
      </div>

      <Button variant="ghost" onClick={() => void signOut()}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}

function ConflictPanel({
  conflict,
}: {
  conflict: NonNullable<ReturnType<typeof useSyncState>["conflict"]>;
}) {
  const [busy, setBusy] = useState(false);
  const choose = async (choice: "keepLocal" | "useCloud") => {
    if (
      choice === "useCloud" &&
      !window.confirm(`${REPLACE_WARNING}\n\nUse the cloud copy and replace this device's data? A local backup is kept automatically.`)
    ) {
      return;
    }
    setBusy(true);
    await resolveConflict(choice);
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
      <div className="flex items-center gap-2 text-amber-200">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-semibold">Sync conflict</span>
      </div>
      <p className="text-xs text-white/70">
        Both this device and the cloud have data. Choose which to keep — the
        other copy will be overwritten. Your current device data is backed up
        either way.
      </p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <SummaryBox title="This device" s={conflict.local} />
        <SummaryBox title="Cloud" s={conflict.cloud} />
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onClick={() => void choose("keepLocal")}
        >
          <Check className="h-4 w-4" /> Keep this device
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onClick={() => void choose("useCloud")}
        >
          <CloudOff className="h-4 w-4" /> Use cloud
        </Button>
      </div>
    </div>
  );
}

function SummaryBox({ title, s }: { title: string; s: DataSummary }) {
  return (
    <div className="rounded-xl bg-black/20 p-3">
      <p className="mb-1 font-medium text-white/80">{title}</p>
      <ul className="space-y-0.5 text-white/55">
        <li>{s.foods} food entries</li>
        <li>{s.saved} saved foods</li>
        <li>{s.weights} weigh-ins</li>
        <li>{s.creatine} creatine logs</li>
      </ul>
    </div>
  );
}
