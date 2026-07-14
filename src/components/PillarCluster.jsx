import { HelpCircle } from "lucide-react";

import { LevelInput } from "@/components/LevelInput";
import { Tooltip } from "@/components/ui/Tooltip";

import { useAppStore } from "@/store/useAppStore";

import { CLUSTERS, getClusterSurfaceBg } from "@/constants";
import { track } from "@/utils/analytics";

export function PillarCluster({ group, onOpenPillarInMatrix }) {
  const levels = useAppStore((s) => s.levels);
  const setLevel = useAppStore((s) => s.setLevel);
  const cluster = CLUSTERS[group.id];

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-white/70 border-l-[3px] px-4 py-3 shadow-sm shadow-slate-200/40"
      data-cluster={group.id}
      style={{
        backgroundColor: getClusterSurfaceBg(cluster.color),
        borderLeftColor: cluster.textColor,
      }}
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
                className="group relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors hover:text-slate-800 active:text-slate-800"
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
