import { useLayoutEffect, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

import { getClusterSurfaceBg } from "@/lib/constants";
import { COMPETENCY_MATRIX, SENIORITY_LEVEL_DEFINITIONS } from "@/lib/constants/about-data";
import { DOC_TEXT } from "@/lib/doc-typography";
import { scrollBelowStickyHeader } from "@/lib/scroll";
import { cn } from "@/lib/utils";

const levelBadgeClass = cn("flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white", DOC_TEXT.badgeMicro);

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
            <p className={cn("min-w-0 flex-1", DOC_TEXT.body)}>
              <LevelCellContent level={levels[code]} />
            </p>
          </div>
        ))}
      </div>

      <div className="hidden grid-cols-5 gap-2 px-3 py-2 min-[450px]:grid">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code }) => (
          <div key={code} className="flex min-w-0 flex-col gap-1.5 border-r border-slate-300/50 px-1 last:border-r-0">
            <span className={levelBadgeClass}>{code}</span>
            <p className={DOC_TEXT.body}>
              <LevelCellContent level={levels[code]} />
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function PillarMatrixCard({ order, pillarId, pillarName, focusSummary, color, textColor, levels, expanded, onToggle, cardRef }) {
  const panelId = `competency-matrix-${pillarId}`;

  return (
    <article
      ref={cardRef}
      className="overflow-hidden rounded-xl border border-white/70 border-l-[3px] shadow-md shadow-slate-200/40"
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
          <h3 className={DOC_TEXT.cardTitlePlain}>
            {order}. {pillarName}
          </h3>
          <p className={DOC_TEXT.body}>{focusSummary}</p>
        </div>
        <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-slate-800 transition-transform", expanded && "rotate-180")} aria-hidden />
      </button>

      {expanded ? (
        <section id={panelId} aria-labelledby={`${panelId}-trigger`}>
          <PillarMatrixLevels levels={levels} />
        </section>
      ) : null}
    </article>
  );
}

export function CompetencyMatrix() {
  const [expandedPillarId, setExpandedPillarId] = useState(null);
  const cardRefs = useRef({});

  const handleToggle = (pillarId) => {
    setExpandedPillarId((current) => (current === pillarId ? null : pillarId));
  };

  useLayoutEffect(() => {
    if (!expandedPillarId) {
      return undefined;
    }

    const card = cardRefs.current[expandedPillarId];
    if (!card) {
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      scrollBelowStickyHeader(card);
    });

    return () => cancelAnimationFrame(frame);
  }, [expandedPillarId]);

  return (
    <div className="space-y-3">
      {COMPETENCY_MATRIX.map((pillar) => (
        <PillarMatrixCard
          key={pillar.pillarId}
          {...pillar}
          expanded={expandedPillarId === pillar.pillarId}
          onToggle={() => handleToggle(pillar.pillarId)}
          cardRef={(node) => {
            if (node) {
              cardRefs.current[pillar.pillarId] = node;
            } else {
              delete cardRefs.current[pillar.pillarId];
            }
          }}
        />
      ))}
    </div>
  );
}
