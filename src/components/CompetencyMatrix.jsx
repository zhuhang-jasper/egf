import { useEffect, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

import { getClusterSurfaceBg } from "@/lib/constants";
import { COMPETENCY_MATRIX, SENIORITY_LEVEL_DEFINITIONS } from "@/lib/constants/about-data";
import { cn } from "@/lib/utils";

const levelBadgeClass =
  "flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[9px] font-bold leading-none text-white";

function LevelCellContent({ level }) {
  if (!level?.persona) {
    return level?.text ?? "";
  }

  return (
    <>
      <span className="font-semibold text-slate-800">{level.persona}</span> {level.text}
    </>
  );
}

function PillarMatrixLevels({ levels }) {
  return (
    <>
      <div className="divide-y divide-slate-300/50 px-3 py-1 min-[450px]:hidden">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code }) => (
          <div key={code} className="flex items-start gap-2 py-2">
            <span className={levelBadgeClass}>{code}</span>
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-slate-800">
              <LevelCellContent level={levels[code]} />
            </p>
          </div>
        ))}
      </div>

      <div className="hidden grid-cols-5 gap-2 px-3 py-2 min-[450px]:grid">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code }) => (
          <div key={code} className="flex min-w-0 flex-col gap-1.5 border-r border-slate-300/50 px-1 last:border-r-0">
            <span className={levelBadgeClass}>{code}</span>
            <p className="text-[11px] leading-snug text-slate-800">
              <LevelCellContent level={levels[code]} />
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function PillarMatrixCard({
  order,
  pillarId,
  pillarName,
  focusSummary,
  color,
  textColor,
  levels,
  expanded,
  onToggle,
}) {
  const panelId = `competency-matrix-${pillarId}`;
  const cardRef = useRef(null);

  useEffect(() => {
    if (expanded) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [expanded]);

  return (
    <article
      ref={cardRef}
      className="scroll-mt-4 overflow-hidden rounded-xl border border-white/70 border-l-[3px] shadow-md shadow-slate-200/40"
      style={{ backgroundColor: getClusterSurfaceBg(color), borderLeftColor: textColor }}
    >
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 pr-3 text-left transition-colors hover:bg-black/[0.03]",
          expanded && "border-b border-slate-300/60",
        )}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-[13px] font-semibold text-slate-900">
            {order}. {pillarName}
          </h3>
          <p className="text-[11px] leading-snug text-slate-800">{focusSummary}</p>
        </div>
        <ChevronDown
          className={cn("mt-0.5 size-4 shrink-0 text-slate-400 transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div id={panelId} role="region" aria-labelledby={`${panelId}-trigger`}>
          <PillarMatrixLevels levels={levels} />
        </div>
      ) : null}
    </article>
  );
}

export function CompetencyMatrix() {
  const [expandedPillarId, setExpandedPillarId] = useState(null);

  const handleToggle = (pillarId) => {
    setExpandedPillarId((current) => (current === pillarId ? null : pillarId));
  };

  return (
    <div className="space-y-3">
      {COMPETENCY_MATRIX.map((pillar) => (
        <PillarMatrixCard
          key={pillar.pillarId}
          {...pillar}
          expanded={expandedPillarId === pillar.pillarId}
          onToggle={() => handleToggle(pillar.pillarId)}
        />
      ))}
    </div>
  );
}
