"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Cloud,
  CloudOff,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  DownloadCloud,
} from "lucide-react";
import {
  useSyncState,
  signIn,
  signUp,
  signInWithGoogle,
  requestEmailCode,
  verifyEmailCode,
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
import { Sheet } from "@/components/ui/sheet";

const STATUS_LABEL: Record<SyncStatus, string> = {
  local: "Local only",
  syncing: "Syncing…",
  synced: "Synced",
  error: "Sync error",
  offline: "Offline",
};

const STATUS_DOT: Record<SyncStatus, string> = {
  local: "bg-white/40",
  syncing: "bg-amber-400 animate-pulse",
  synced: "bg-emerald-400",
  error: "bg-red-400",
  offline: "bg-amber-400",
};

const STATUS_TEXT: Record<SyncStatus, string> = {
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
        <p className="text-xs leading-relaxed text-white/40">
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
        {sync.email && <StatusBadge status={sync.status} />}
      </div>

      {sync.conflict && <ConflictPanel conflict={sync.conflict} />}

      {sync.email ? (
        <SignedIn email={sync.email} sync={sync} />
      ) : (
        <SignedOut />
      )}

      {sync.message && <p className="text-xs text-white/55">{sync.message}</p>}
    </Card>
  );
}

function StatusBadge({ status }: { status: SyncStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium ${STATUS_TEXT[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Signed-out
// ---------------------------------------------------------------------------

function SignedOut() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5">
          <Cloud className="h-5 w-5 text-white/60" />
        </div>
        <p className="text-xs leading-relaxed text-white/50">
          Your data is stored on this device. Sign in to back it up and sync
          across your devices — completely optional, the app works fully without
          an account.
        </p>
      </div>
      <Button onClick={() => setOpen(true)}>Sign in / Create account</Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Sync your data">
        <AuthPanel onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function AuthPanel({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<
    null | "signin" | "signup" | "google" | "code"
  >(null);
  const [codeMode, setCodeMode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (m: "signin" | "signup") => {
    setMode(m);
    setError(null);
    setInfo(null);
    setConfirm("");
  };

  const run = async () => {
    setError(null);
    setInfo(null);

    // Validate account creation client-side before hitting Supabase.
    if (mode === "signup") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    setBusy(mode);
    const fn = mode === "signin" ? signIn : signUp;
    const res = await fn(email.trim(), password);
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    if (res.needsConfirmation) {
      setInfo("Check your email to confirm your account, then sign in.");
      setPassword("");
      setConfirm("");
      switchMode("signin");
      return;
    }
    onDone(); // signed in — the auth listener takes over
  };

  const google = async () => {
    setBusy("google");
    setError(null);
    setInfo(null);
    const res = await signInWithGoogle();
    if (!res.ok) {
      setBusy(null);
      setError(res.error ?? "Couldn't start Google sign-in.");
    }
    // On success the browser redirects to Google; leave the busy state on.
  };

  const sendCode = async () => {
    setBusy("code");
    setError(null);
    setInfo(null);
    const res = await requestEmailCode(email.trim());
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "Couldn't send the code.");
      return;
    }
    setCodeSent(true);
    setInfo("Check your email for a 6-digit code.");
  };

  const submitCode = async () => {
    setBusy("code");
    setError(null);
    const res = await verifyEmailCode(email.trim(), code);
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "That code didn't work — request a new one.");
      return;
    }
    onDone(); // signed in — the auth listener takes over
  };

  const disabled = busy !== null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-white/55">
        Back up your data and sync across devices.
      </p>

      {codeMode ? (
        <div className="flex flex-col gap-3">
          <Field
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            disabled={disabled || codeSent}
          />
          {codeSent && (
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-lg tracking-[0.3em] tabular-nums outline-none transition-colors focus:border-accent/60 disabled:opacity-50"
              disabled={disabled}
            />
          )}
          {error && <p className="text-xs text-red-300">{error}</p>}
          {info && <p className="text-xs text-emerald-300">{info}</p>}
          {codeSent ? (
            <>
              <Button
                type="button"
                disabled={disabled || code.trim().length < 6}
                onClick={() => void submitCode()}
              >
                {busy === "code" ? "Checking…" : "Sign in"}
              </Button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void sendCode()}
                className="tap text-center text-xs text-white/50 hover:text-white/80 disabled:opacity-50"
              >
                Send a new code
              </button>
            </>
          ) : (
            <Button
              type="button"
              disabled={disabled || !email.trim()}
              onClick={() => void sendCode()}
            >
              {busy === "code" ? "Sending…" : "Email me a code"}
            </Button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCodeMode(false);
              setCodeSent(false);
              setCode("");
              setError(null);
              setInfo(null);
            }}
            className="tap text-center text-xs text-white/50 hover:text-white/80 disabled:opacity-50"
          >
            Use password instead
          </button>
        </div>
      ) : (
      <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
        className="flex flex-col gap-3"
      >
        <Field
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          disabled={disabled}
        />
        <Field
          type="password"
          placeholder="Password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={setPassword}
          disabled={disabled}
          minLength={6}
        />
        {mode === "signup" && (
          <Field
            type="password"
            placeholder="Confirm password"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            disabled={disabled}
            minLength={6}
          />
        )}

        {error && <p className="text-xs text-red-300">{error}</p>}
        {info && <p className="text-xs text-emerald-300">{info}</p>}

        <Button type="submit" disabled={disabled}>
          {mode === "signin"
            ? busy === "signin"
              ? "Signing in…"
              : "Sign in"
            : busy === "signup"
              ? "Creating account…"
              : "Create account"}
        </Button>
      </form>

      <button
        type="button"
        disabled={disabled}
        onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
        className="tap -mt-1 text-center text-xs text-white/50 hover:text-white/80 disabled:opacity-50"
      >
        {mode === "signin"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setCodeMode(true);
          setError(null);
          setInfo(null);
        }}
        className="tap -mt-1 text-center text-xs text-white/50 hover:text-white/80 disabled:opacity-50"
      >
        Sign in with an email code instead (best for the installed app)
      </button>
      </>
      )}

      <div className="flex items-center gap-3 py-0.5">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] uppercase tracking-wider text-white/30">
          or
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        onClick={() => void google()}
        disabled={disabled}
        className="tap inline-flex h-11 items-center justify-center gap-2.5 rounded-2xl bg-white px-4 text-sm font-semibold text-[#1f1f1f] disabled:opacity-50"
      >
        <GoogleIcon />
        {busy === "google" ? "Redirecting…" : "Continue with Google"}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-white/35">
        Your data stays on this device too. Sign-in only adds a private,
        encrypted-in-transit cloud backup.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signed-in
// ---------------------------------------------------------------------------

function SignedIn({
  email,
  sync,
}: {
  email: string;
  sync: ReturnType<typeof useSyncState>;
}) {
  const onReplace = async () => {
    if (
      window.confirm(
        `${REPLACE_WARNING}\n\nReplace this device's data with the cloud copy? A local backup is kept automatically.`,
      )
    ) {
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
          <ShieldCheck className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{email}</p>
          <p className="text-xs text-white/45">
            Last synced {relativeTime(sync.lastSyncedAt)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Button
          onClick={() => void syncNow()}
          disabled={sync.status === "syncing"}
        >
          <RefreshCw
            className={`h-4 w-4 ${sync.status === "syncing" ? "animate-spin" : ""}`}
          />
          Sync now
        </Button>
        <p className="px-1 text-[11px] text-white/35">
          Push the latest changes from this device to the cloud.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">
          Advanced
        </p>
        <div className="flex flex-col gap-1">
          <button
            onClick={onUpload}
            className="tap flex items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm text-white/75 hover:bg-white/5"
          >
            <UploadCloud className="h-4 w-4 shrink-0 text-white/45" />
            <span className="flex-1">
              Upload
              <span className="block text-[11px] text-white/35">
                Overwrite the cloud with this device&apos;s data.
              </span>
            </span>
          </button>
          <button
            onClick={onReplace}
            className="tap flex items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm text-white/75 hover:bg-white/5"
          >
            <DownloadCloud className="h-4 w-4 shrink-0 text-white/45" />
            <span className="flex-1">
              Restore
              <span className="block text-[11px] text-white/35">
                Replace this device with the cloud copy.
              </span>
            </span>
          </button>
        </div>
      </div>

      <button
        onClick={() => void signOut()}
        className="tap inline-flex items-center justify-center gap-2 py-1 text-sm text-white/45 hover:text-white/70"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conflict
// ---------------------------------------------------------------------------

function ConflictPanel({
  conflict,
}: {
  conflict: NonNullable<ReturnType<typeof useSyncState>["conflict"]>;
}) {
  const [busy, setBusy] = useState(false);
  const choose = async (choice: "keepLocal" | "useCloud") => {
    if (
      choice === "useCloud" &&
      !window.confirm(
        `${REPLACE_WARNING}\n\nUse the cloud copy and replace this device's data? A local backup is kept automatically.`,
      )
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
      <p className="text-xs leading-relaxed text-white/70">
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

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Field({
  type,
  placeholder,
  autoComplete,
  value,
  onChange,
  disabled,
  minLength,
}: {
  type: string;
  placeholder: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  minLength?: number;
}) {
  return (
    <input
      type={type}
      inputMode={type === "email" ? "email" : undefined}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required
      minLength={minLength}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none transition-colors focus:border-accent/60 disabled:opacity-50"
    />
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
