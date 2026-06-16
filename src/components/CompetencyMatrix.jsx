import { useLayoutEffect, useRef } from "react";

import { ChevronDown } from "lucide-react";

import { ShareLinkButton } from "@/components/ShareLinkButton";

import { getClusterSurfaceBg } from "@/constants";
import { COMPETENCY_MATRIX, SENIORITY_LEVEL_DEFINITIONS } from "@/constants/theory-data";
import { DOC_TEXT } from "@/styles/doc-typography";
import { cn } from "@/utils";
import { scrollBelowStickyHeader } from "@/utils/scroll";
import { getPillarCardElementId, persistExpandedPillar, THEORY_SECTIONS } from "@/utils/theory-url";

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
      <div className="divide-y divide-slate-300/50 px-3 py-1 min-[650px]:hidden">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code }) => (
          <div key={code} className="flex items-start gap-2 py-2">
            <span className={levelBadgeClass}>{code}</span>
            <p className={cn("min-w-0 flex-1", DOC_TEXT.bodyMedium)}>
              <LevelCellContent level={levels[code]} />
            </p>
          </div>
        ))}
      </div>

      <div className="hidden grid-cols-5 gap-2 px-3 py-2 min-[650px]:grid">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code }) => (
          <div key={code} className="flex min-w-0 flex-col gap-1.5 border-r border-slate-300/50 px-1 last:border-r-0">
            <span className={levelBadgeClass}>{code}</span>
            <p className={DOC_TEXT.bodyMedium}>
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
      id={getPillarCardElementId(pillarId)}
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
          "flex w-full cursor-pointer items-start gap-2 px-3 pt-2.5 text-left transition-colors hover:bg-black/[0.04]",
          expanded ? "pb-1.5 border-b border-slate-300/60" : "pb-2.5",
        )}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className={cn("min-w-0", DOC_TEXT.cardTitlePlain)}>
            {order}. {pillarName}
          </h3>
          <p className={cn("min-w-0", DOC_TEXT.body)}>{focusSummary}</p>
        </div>
        <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-slate-800 transition-transform", expanded && "rotate-180")} aria-hidden />
      </button>

      {expanded ? (
        <section id={panelId} aria-labelledby={`${panelId}-trigger`}>
          <PillarMatrixLevels levels={levels} />
          <div className="flex justify-center border-t border-slate-300/60 py-2">
            <ShareLinkButton section={THEORY_SECTIONS.matrix} pillar={pillarId} label="Copy link to this pillar" ariaLabel="Copy link to this pillar" />
          </div>
        </section>
      ) : null}
    </article>
  );
}

function CompetencyMatrix({ expandedPillar, onExpandedPillarChange }) {
  const cardRefs = useRef({});
  const isFirstMountRef = useRef(true);

  const handleToggle = (pillarId) => {
    const next = pillarId === expandedPillar ? null : pillarId;
    persistExpandedPillar(next);
    onExpandedPillarChange(next);
  };

  useLayoutEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return undefined;
    }

    if (!expandedPillar) {
      return undefined;
    }

    const card = cardRefs.current[expandedPillar];
    if (!card) {
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      scrollBelowStickyHeader(card);
    });

    return () => cancelAnimationFrame(frame);
  }, [expandedPillar]);

  return (
    <div className="space-y-3">
      {COMPETENCY_MATRIX.map((pillar) => (
        <PillarMatrixCard
          key={pillar.pillarId}
          {...pillar}
          expanded={expandedPillar === pillar.pillarId}
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

export { CompetencyMatrix };
