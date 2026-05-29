import { AI_AUGMENTATION_ENABLED, PILLAR_COUNT } from "@/lib/constants";
import { computeAverages, formatAvgScore } from "@/lib/scores";
import { cn } from "@/lib/utils";

import { useAppStore } from "@/store/useAppStore";

function AvgCard({ label, value, sub, className, title }) {
  return (
    <div title={title} className={cn("flex min-w-0 flex-col items-center justify-center gap-0.3 rounded-lg border px-3 py-2 text-center", className)}>
      <span className="max-w-[11rem] text-[11px] font-semibold tracking-wide">{label}</span>
      <span className="text-lg font-extrabold tabular-nums">{value}</span>
      {sub ? <span className="max-w-[12rem] text-[12px] font-bold opacity-95">{sub}</span> : null}
    </div>
  );
}

export function ChartAverages() {
  const levels = useAppStore((s) => s.levels);
  const aiLevels = useAppStore((s) => s.aiLevels);
  const scoresHidden = useAppStore((s) => s.footerScoresHidden);

  if (scoresHidden) {
    return null;
  }

  const { overall, human, ai, career } = computeAverages(levels, aiLevels);

  return (
    <div
      className={cn("mt-2.5 grid w-full gap-3 px-2 pb-1.5", AI_AUGMENTATION_ENABLED ? "grid-cols-4" : "grid-cols-3")}
      aria-label={
        AI_AUGMENTATION_ENABLED ? "Overall score, AI score, strength index, and career level" : "Overall score, strength index, and career level"
      }
    >
      <AvgCard
        label="Pillar Avg"
        value={formatAvgScore(overall)}
        title={`Mean of all ${PILLAR_COUNT} pillar scores (flat average).`}
        className="border-slate-600 bg-slate-50 text-slate-800 [&_span:nth-child(2)]:text-slate-900"
      />
      {AI_AUGMENTATION_ENABLED && (
        <AvgCard
          label="AI Avg"
          value={formatAvgScore(ai)}
          title="Mean of the three AI scores only: Coding, Architecture, and Process."
          className="border-[var(--color-ai)] bg-indigo-50/80 text-[var(--color-ai)]"
        />
      )}
      <AvgCard
        label="Strength index"
        value={formatAvgScore(human)}
        title={`Mean of your three highest pillar scores (of ${PILLAR_COUNT}).`}
        className="border-amber-600 bg-amber-50 text-amber-900 [&_span:nth-child(2)]:text-amber-700"
      />
      <AvgCard
        label="Career level"
        value={career ? career.code : "—"}
        sub={career ? career.role : ""}
        title="From strength index (mean of three highest pillars)."
        className="border-teal-600 bg-teal-50 text-teal-900 [&_span:nth-child(2)]:text-teal-700"
      />
    </div>
  );
}
