import { LevelInput } from "@/components/LevelInput";

import { CLUSTERS } from "@/lib/constants";
import { AI_FEATURE_ENABLED } from "@/lib/flags";

import { useAppStore } from "@/store/useAppStore";

export function PillarCluster({ group }) {
  const levels = useAppStore((s) => s.levels);
  const aiLevels = useAppStore((s) => s.aiLevels);
  const setLevel = useAppStore((s) => s.setLevel);
  const cluster = CLUSTERS[group.id];

  return (
    <div className="form-cluster" data-cluster={group.id} style={{ "--cluster-color": cluster.color }}>
      <div className="form-section-title">{group.title}</div>
      {group.pillars.map((pillar) => (
        <label key={pillar.index} className="field-row">
          <span>{pillar.label}</span>
          {pillar.hasAi && AI_FEATURE_ENABLED ? (
            <span className="field-row__nums">
              <LevelInput
                value={levels[pillar.index]}
                onChange={(v) => setLevel(pillar.index, v)}
                ariaLabel={`${pillar.label} level`}
                ariaLabelUp="Increase level"
                ariaLabelDown="Decrease level"
              />
              <span className="field-row__ai">
                <span className="field-row__ai-label">AI:</span>
                <LevelInput
                  value={aiLevels[pillar.index]}
                  onChange={(v) => setLevel(pillar.index, v, { isAi: true })}
                  isAi
                  ariaLabel={`${pillar.label} AI level`}
                  ariaLabelUp="Increase AI level"
                  ariaLabelDown="Decrease AI level"
                />
              </span>
            </span>
          ) : (
            <LevelInput
              value={levels[pillar.index]}
              onChange={(v) => setLevel(pillar.index, v)}
              ariaLabel={`${pillar.label} level`}
              ariaLabelUp="Increase level"
              ariaLabelDown="Decrease level"
            />
          )}
        </label>
      ))}
    </div>
  );
}
