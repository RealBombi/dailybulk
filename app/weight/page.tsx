"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  useAppData,
  logWeight,
  deleteWeightLog,
} from "@/lib/store";
import {
  latestWeightKg,
  weeklyAverageWeightKg,
  weightSeries,
  weightTrend,
} from "@/lib/selectors";
import {
  formatWeight,
  kgToLb,
  normalizeWeightToKg,
  parseDateStr,
  round,
  todayStr,
  unitLabel,
} from "@/lib/utils";
import { PageHeader, PageShell, EmptyState } from "@/components/page-shell";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

export default function WeightPage() {
  const data = useAppData();
  const series = weightSeries(data);
  const latestKg = latestWeightKg(data);
  const avgKg = weeklyAverageWeightKg(data);
  const trend = weightTrend(data);
  const unit = data.settings.weightUnit;
  const toDisplay = (kg: number) => (unit === "lbs" ? kgToLb(kg) : kg);

  const [range, setRange] = useState<7 | 30>(30);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const save = () => {
    const w = Number(value);
    if (!w || w <= 0) return;
    logWeight(todayStr(), w, unit);
    setValue("");
    setOpen(false);
  };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - range);
  // Convert every chart point to kg first, then to the user's display unit,
  // so mixed kg/lbs logs plot consistently on one axis.
  const chartData = series
    .filter((l) => parseDateStr(l.date) >= cutoff)
    .map((l) => ({
      date: parseDateStr(l.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      weight: round(toDisplay(normalizeWeightToKg(l.weight, l.unit)), 1),
    }));

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <PageShell>
      <PageHeader
        title="Weight"
        subtitle="Watch the trend, not the day"
        right={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Log
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Latest"
          value={latestKg !== undefined ? formatWeight(latestKg, unit) : "–"}
        />
        <Stat
          label="7-day avg"
          value={avgKg !== undefined ? formatWeight(avgKg, unit) : "–"}
        />
        <Card className="flex flex-col justify-center">
          <p className="text-xs uppercase tracking-wider text-white/50">
            Trend
          </p>
          <div className="mt-1 flex items-center gap-1">
            <TrendIcon
              className={`h-5 w-5 ${
                trend === "up"
                  ? "text-emerald-400"
                  : trend === "down"
                    ? "text-sky-400"
                    : "text-white/40"
              }`}
            />
            <span className="text-sm capitalize">{trend ?? "–"}</span>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <CardTitle>Progress</CardTitle>
          <div className="flex gap-1 rounded-full bg-white/5 p-0.5">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-full px-3 py-1 text-xs ${
                  range === r ? "bg-white text-bg" : "text-white/50"
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        {chartData.length < 2 ? (
          <EmptyState
            message={
              series.length === 0
                ? "Log your first weight to start seeing your trend."
                : "Log another weight to see your trend."
            }
          />
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  domain={["dataMin - 1", "dataMax + 1"]}
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0c111d",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  fill="url(#wfill)"
                  dot={{ r: 2.5, fill: "#818cf8" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {series.length > 0 && (
        <Card>
          <CardTitle>History</CardTitle>
          <div className="mt-3 flex flex-col gap-1">
            {[...series].reverse().map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between py-1.5"
              >
                <span className="text-sm text-white/60">
                  {parseDateStr(l.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">
                    {formatWeight(
                      normalizeWeightToKg(l.weight, l.unit),
                      unit,
                    )}
                  </span>
                  <button
                    onClick={() => deleteWeightLog(l.id)}
                    className="tap text-white/25 hover:text-red-300"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Log weight">
        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              className="w-40 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-4xl font-bold outline-none focus:border-accent/60"
            />
            <span className="pb-4 text-xl text-white/50">{unitLabel(unit)}</span>
          </div>
          <Button size="lg" onClick={save}>
            Save weight
          </Button>
        </div>
      </Sheet>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  // Render "176 lb" / "80 kg" with a smaller unit suffix so it stays on one
  // line in the narrow stat card.
  const m = value.match(/^(.+?)\s+(kg|lb)$/);
  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">
        {m ? (
          <>
            {m[1]}
            <span className="ml-1 text-sm font-normal text-white/50">{m[2]}</span>
          </>
        ) : (
          value
        )}
      </p>
    </Card>
  );
}
