"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Pill } from "lucide-react";
import { useAppData, toggleCreatine } from "@/lib/store";
import { creatineStreak, creatineTakenOn } from "@/lib/selectors";
import { todayStr } from "@/lib/utils";
import { Celebration } from "@/components/celebration";

export function CreatineCard() {
  const data = useAppData();
  const today = todayStr();
  const taken = creatineTakenOn(data, today);
  const streak = creatineStreak(data);
  const [fire, setFire] = useState(false);

  const onTap = () => {
    const willBeTaken = !taken;
    toggleCreatine(today, data.settings.creatineGoalGrams);
    if (willBeTaken && (streak + 1) % 7 === 0) {
      setFire(true);
      window.setTimeout(() => setFire(false), 100);
    }
  };

  return (
    <>
      <Celebration fire={fire} />
      <button
        onClick={onTap}
        className={`glass tap relative w-full overflow-hidden p-5 text-left transition-colors ${
          taken ? "border-emerald-500/30" : ""
        }`}
      >
        {taken && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 to-transparent" />
        )}
        <div className="relative flex items-center gap-4">
          <motion.div
            animate={taken ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: 0.4 }}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
              taken
                ? "bg-emerald-500 text-white shadow-[0_0_24px_-6px_rgba(16,185,129,0.8)]"
                : "bg-white/5 text-white/50"
            }`}
          >
            {taken ? <Check className="h-7 w-7" /> : <Pill className="h-6 w-6" />}
          </motion.div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-white/50">
              Creatine
            </p>
            <p className="text-lg font-bold">
              {taken ? "Taken today" : "Not taken yet"}
            </p>
            <p className="text-sm text-white/50">
              {taken
                ? "Tap to undo"
                : "One tap and you're done"}
            </p>
          </div>
          {streak > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-accent-soft">{streak}</p>
              <p className="text-[10px] uppercase text-white/40">day streak</p>
            </div>
          )}
        </div>
      </button>
    </>
  );
}
