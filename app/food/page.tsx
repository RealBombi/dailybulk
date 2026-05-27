"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { PageHeader, PageShell, EmptyState } from "@/components/page-shell";
import { CardTitle } from "@/components/ui/card";
import { SearchTab } from "@/components/food/search-tab";
import { BarcodeTab } from "@/components/food/barcode-tab";
import { SavedMealsTab } from "@/components/food/saved-meals-tab";
import { ManualAddTab } from "@/components/food/manual-add-tab";
import { QuickAddTab } from "@/components/food/quick-add-tab";
import { TodayList } from "@/components/food/today-list";
import { useAppData } from "@/lib/store";
import { entriesForDate } from "@/lib/selectors";
import { todayStr } from "@/lib/utils";

type Mode = "search" | "barcode" | "saved" | "manual" | "quick";

const TABS: { id: Mode; label: string }[] = [
  { id: "search", label: "Search" },
  { id: "barcode", label: "Barcode" },
  { id: "saved", label: "Saved" },
  { id: "manual", label: "Manual" },
  { id: "quick", label: "Quick" },
];

function FoodContent() {
  const params = useSearchParams();
  const initial = (params.get("mode") as Mode) || "search";
  const [mode, setMode] = useState<Mode>(
    TABS.some((t) => t.id === initial) ? initial : "search",
  );
  const [justAdded, setJustAdded] = useState(false);

  const data = useAppData();
  const today = entriesForDate(data, todayStr());

  const onAdded = () => {
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <PageShell>
      <PageHeader title="Food" subtitle="Log a meal in a couple of taps" />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`tap shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              mode === t.id
                ? "bg-white text-bg"
                : "bg-white/5 text-white/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass p-5">
        {mode === "search" && <SearchTab onAdded={onAdded} />}
        {mode === "barcode" && <BarcodeTab onAdded={onAdded} />}
        {mode === "saved" && <SavedMealsTab onAdded={onAdded} />}
        {mode === "manual" && <ManualAddTab onAdded={onAdded} />}
        {mode === "quick" && <QuickAddTab onAdded={onAdded} />}
      </div>

      <AnimatePresence>
        {justAdded && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed inset-x-0 bottom-24 z-50 mx-auto flex w-fit items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-glow"
          >
            <Check className="h-4 w-4" /> Added to today
          </motion.div>
        )}
      </AnimatePresence>

      <section className="flex flex-col gap-3">
        <CardTitle>Today&apos;s food</CardTitle>
        {today.length === 0 ? (
          <EmptyState message="Nothing logged yet. Add your first meal." />
        ) : (
          <TodayList entries={today} />
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
