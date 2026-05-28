"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { PageHeader, PageShell, EmptyState } from "@/components/page-shell";
import { CardTitle } from "@/components/ui/card";
import { SearchTab } from "@/components/food/search-tab";
import { BarcodeTab } from "@/components/food/barcode-tab";
import { SavedMealsTab } from "@/components/food/saved-meals-tab";
import { ManualAddTab } from "@/components/food/manual-add-tab";
import { QuickAddTab } from "@/components/food/quick-add-tab";
import { TodayList } from "@/components/food/today-list";
import { QuickAddList } from "@/components/food/quick-add-list";
import { CopyFromYesterday } from "@/components/food/copy-from-yesterday";
import { useAppData } from "@/lib/store";
import { entriesForDate, totalsForDate } from "@/lib/selectors";
import { addDays, parseDateStr, round, todayStr } from "@/lib/utils";

type Mode = "search" | "barcode" | "saved" | "manual" | "quick";

const TABS: { id: Mode; label: string }[] = [
  { id: "search", label: "Search" },
  { id: "barcode", label: "Barcode" },
  { id: "saved", label: "Saved" },
  { id: "manual", label: "Manual" },
  { id: "quick", label: "Quick" },
];

function dateLabel(date: string): string {
  const today = todayStr();
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return parseDateStr(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function FoodContent() {
  const params = useSearchParams();
  const initial = (params.get("mode") as Mode) || "search";
  const [mode, setMode] = useState<Mode>(
    TABS.some((t) => t.id === initial) ? initial : "search",
  );
  const [justAdded, setJustAdded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const data = useAppData();
  const entries = entriesForDate(data, selectedDate);
  const totals = totalsForDate(data, selectedDate);
  const isToday = selectedDate === todayStr();

  const onAdded = () => {
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <PageShell>
      <PageHeader title="Food" subtitle="Log a meal in a couple of taps" />

      {/* Date selector */}
      <div className="glass flex items-center justify-between gap-2 p-2">
        <button
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
          className="tap rounded-2xl p-2.5 text-white/60 hover:bg-white/5"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="relative flex flex-1 flex-col items-center">
          <span className="text-sm font-semibold">{dateLabel(selectedDate)}</span>
          <span className="text-[11px] text-white/40">
            {round(totals.calories)} kcal · {round(totals.protein)}g protein
          </span>
          <input
            type="date"
            value={selectedDate}
            max={todayStr()}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Pick a date"
          />
        </div>
        <button
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          disabled={isToday}
          className="tap rounded-2xl p-2.5 text-white/60 hover:bg-white/5 disabled:opacity-30"
          aria-label="Next day"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <QuickAddList date={selectedDate} onAdded={onAdded} />
      <CopyFromYesterday
        date={selectedDate}
        onCopied={(n) => {
          if (n > 0) onAdded();
        }}
      />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`tap shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              mode === t.id ? "bg-white text-bg" : "bg-white/5 text-white/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass p-5">
        {mode === "search" && <SearchTab onAdded={onAdded} date={selectedDate} />}
        {mode === "barcode" && <BarcodeTab onAdded={onAdded} date={selectedDate} />}
        {mode === "saved" && <SavedMealsTab onAdded={onAdded} date={selectedDate} />}
        {mode === "manual" && <ManualAddTab onAdded={onAdded} date={selectedDate} />}
        {mode === "quick" && <QuickAddTab onAdded={onAdded} date={selectedDate} />}
      </div>

      <AnimatePresence>
        {justAdded && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed inset-x-0 bottom-24 z-50 mx-auto flex w-fit items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-glow"
          >
            <Check className="h-4 w-4" /> Added to {dateLabel(selectedDate).toLowerCase()}
          </motion.div>
        )}
      </AnimatePresence>

      <section className="flex flex-col gap-3">
        <CardTitle>{isToday ? "Today's food" : `${dateLabel(selectedDate)}'s food`}</CardTitle>
        {entries.length === 0 ? (
          <EmptyState message="Nothing logged yet. Add your first meal." />
        ) : (
          <TodayList entries={entries} />
        )}
      </section>
    </PageShell>
  );
}

export default function FoodPage() {
  return (
    <Suspense>
      <FoodContent />
    </Suspense>
  );
}
