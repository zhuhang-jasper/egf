import { LevelInput } from "@/components/LevelInput";

import { CLUSTERS, getClusterSurfaceBg } from "@/constants";

import { useAppStore } from "@/store/useAppStore";

export function PillarCluster({ group }) {
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
      <div className="form-section-title">{group.title}</div>
      {group.pillars.map((pillar) => (
        <label key={pillar.index} className="field-row">
          <span>{pillar.label}</span>
          <LevelInput
            value={levels[pillar.index]}
            onChange={(v) => setLevel(pillar.index, v)}
            ariaLabel={`${pillar.label} level`}
            ariaLabelUp="Increase level"
            ariaLabelDown="Decrease level"
          />
        </label>
      ))}
    </div>
  );
}
