import { BREADTH_TOP_RATIO, FEATURE_SCORES_SETTINGS } from "@/lib/constants";
import { computeAverages, formatAvgScore } from "@/lib/scores";
import { cn } from "@/lib/utils";

import { useAppStore } from "@/store/useAppStore";

function AvgCard({ label, value, sub, className, title }) {
  return (
    <div
      title={title}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-1.5 text-center sm:gap-1 sm:px-4 sm:py-2.5",
        className,
      )}
    >
      <span className="max-w-[11rem] text-[10px] font-semibold tracking-wide sm:text-xs">{label}</span>
      <span className="text-base font-extrabold tabular-nums sm:text-xl">{value}</span>
      {sub ? <span className="max-w-[12rem] text-[10px] font-bold opacity-95 sm:text-sm">{sub}</span> : null}
    </div>
  );
}

export function ChartAverages() {
  const levels = useAppStore((s) => s.levels);
  const trackVariant = useAppStore((s) => s.trackVariant);
  const scoresHidden = useAppStore((s) => s.footerScoresHidden);

  if (!FEATURE_SCORES_SETTINGS || scoresHidden) {
    return null;
  }

  const { breadth, human, career } = computeAverages(levels, trackVariant);
  const pillarCount = levels.length;
  const breadthK = Math.ceil(pillarCount * BREADTH_TOP_RATIO);

  return (
    <div
      data-chart-export="chart-averages"
      className="mb-3 grid w-full grid-cols-3 gap-2 px-2 sm:gap-4"
      aria-label="Breadth score, strength index, and career level"
    >
      <AvgCard
        label="Breadth score"
        value={formatAvgScore(breadth)}
        title={`Mean of your ${breadthK} highest pillar scores (of ${pillarCount}).`}
        className="border-slate-600 bg-slate-50 text-slate-800 [&_span:nth-child(2)]:text-slate-900"
      />
      <AvgCard
        label="Strength index"
        value={formatAvgScore(human)}
        title={`Mean of your 3 highest pillar scores (of ${pillarCount}).`}
        className="border-amber-600 bg-amber-50 text-amber-900 [&_span:nth-child(2)]:text-amber-700"
      />
      <AvgCard
        label="Career level"
        value={career ? career.code : "—"}
        sub={career ? career.role : ""}
        title="L2+ needs peak, breadth, and cluster mins (technical all tracks; product FE only) — see scoring constants."
        className="border-teal-600 bg-teal-50 text-teal-900 [&_span:nth-child(2)]:text-teal-700"
      />
    </div>
  );
}
