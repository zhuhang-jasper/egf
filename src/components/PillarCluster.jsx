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
      className="form-cluster overflow-hidden rounded-xl border border-white/70 border-l-[3px] shadow-sm shadow-slate-200/40"
      data-cluster={group.id}
      style={{
        "--cluster-text-color": cluster.textColor,
        "backgroundColor": getClusterSurfaceBg(cluster.color),
        "borderLeftColor": cluster.textColor,
      }}
    >
      <div className="form-section-title text-[10px] sm:text-[12px] font-bold">{group.title}</div>
      {group.pillars.map((pillar) => (
        <div key={pillar.index} className="field-row">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="min-w-0">{pillar.label}</span>
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
          </span>
          <LevelInput
            value={levels[pillar.index]}
            onChange={(v) => setLevel(pillar.index, v)}
            ariaLabel={`${pillar.label} level`}
            ariaLabelUp="Increase level"
            ariaLabelDown="Decrease level"
          />
        </div>
      ))}
    </div>
  );
}
