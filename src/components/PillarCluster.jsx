import { HelpCircle } from "lucide-react";

import { LevelInput } from "@/components/LevelInput";
import { Tooltip } from "@/components/ui/Tooltip";

import { useAppStore } from "@/store/useAppStore";

import { CLUSTERS } from "@/constants";
import { CARD_TINTED, clusterCardStyle } from "@/styles/card";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";

export function PillarCluster({ group, onOpenPillarInMatrix }) {
  const levels = useAppStore((s) => s.levels);
  const setLevel = useAppStore((s) => s.setLevel);
  const cluster = CLUSTERS[group.id];

  return (
    <div
      // `print:break-inside-avoid` keeps a cluster's pillars together on one sheet — a cluster is at most
      // four rows, so it either fits or moves whole. `print:overflow-visible` for the paged-media
      // clipping reason documented in CompetencyMatrix.
      className={cn(CARD_TINTED, "relative w-full overflow-hidden px-4 py-3 print:overflow-visible print:break-inside-avoid")}
      data-cluster={group.id}
      style={clusterCardStyle(cluster.color, cluster.textColor)}
    >
      <div
        className="mb-2 text-[10px] sm:text-[11px] md:text-[12px] font-semibold uppercase leading-tight tracking-[0.06em]"
        style={{ color: cluster.textColor }}
      >
        {group.title}
      </div>
      {group.pillars.map((pillar) => (
        <div
          key={pillar.index}
          className="grid grid-cols-[1fr_auto] items-center w-full gap-1 sm:gap-3 leading-[1.35] text-slate-800 text-[12px] sm:text-[13px] md:text-[14px]"
        >
          <span className="min-w-0">{pillar.label}</span>
          <span className="flex flex-row items-center justify-end shrink-0 gap-3 sm:gap-6">
            {onOpenPillarInMatrix ? (
              <button
                type="button"
                onClick={() => {
                  track("pillar_help_opened", { pillar: pillar.id });
                  onOpenPillarInMatrix(pillar.id);
                }}
                aria-label={`View ${pillar.label} in the competency matrix`}
                // `print:hidden` — a cross-tab jump into the matrix is an action, and the matrix it
                // jumps to isn't on this printed page anyway.
                className="group relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:text-slate-800 active:text-slate-800 print:hidden"
              >
                <HelpCircle className="size-3.5" aria-hidden />
                <Tooltip text="View in matrix" />
              </button>
            ) : null}
            <LevelInput
              value={levels[pillar.index]}
              onChange={(v) => setLevel(pillar.index, v)}
              ariaLabel={`${pillar.label} level`}
              ariaLabelUp="Increase level"
              ariaLabelDown="Decrease level"
            />
          </span>
        </div>
      ))}
    </div>
  );
}
