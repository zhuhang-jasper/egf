import { EmphasizedText } from "@/components/EmphasizedText";

import { getClusterSurfaceBg } from "@/constants";
import { PILLAR_CLUSTER_GROUPS } from "@/constants/theory-data";
import { DOC_TEXT, WHATS_NEW_HIGHLIGHT_CLASS } from "@/styles/doc-typography";
import { cn } from "@/utils";

function PillarCard({ pillar, clusterLabel, color, textColor, showLatestChanges }) {
  return (
    <article
      className="rounded-xl border border-white/70 p-3 shadow-sm shadow-slate-200/40 min-[470px]:row-span-4 min-[470px]:grid min-[470px]:grid-rows-subgrid gap-2.5"
      style={{ backgroundColor: getClusterSurfaceBg(color) }}
    >
      {/* single-col: title left + cluster label right; col: title only */}
      <div className="flex flex-row-reverse items-start justify-between gap-3 min-[470px]:block">
        <span className={cn("shrink-0 text-right min-[470px]:hidden", DOC_TEXT.clusterLabel)} style={{ color: textColor }}>
          {clusterLabel}
        </span>
        <p className={cn("min-w-0 flex-1", DOC_TEXT.cardTitle, "font-bold")}>{pillar.pillar}</p>
      </div>
      <p className={cn("mt-2 min-[470px]:mt-0", DOC_TEXT.body)}>
        <EmphasizedText text={pillar.focusSummary} boldClassName={WHATS_NEW_HIGHLIGHT_CLASS} plain={!showLatestChanges} />
      </p>
      <div className={cn("mt-2 min-[470px]:mt-0", DOC_TEXT.bodyItalic)}>
        <p>&ldquo;{pillar.signatureQuestion}&rdquo;</p>
        {pillar.note ? <p className="mt-2 min-[470px]:mt-2.5 opacity-70">{pillar.note}</p> : null}
      </div>
      {/* col only: cluster label at bottom */}
      <span className={cn("hidden min-[470px]:block text-right", DOC_TEXT.clusterLabel)} style={{ color: textColor }}>
        {clusterLabel}
      </span>
    </article>
  );
}

export function PillarGrid({ showLatestChanges = true }) {
  return (
    <div className="grid grid-cols-1 gap-2 min-[470px]:grid-cols-2 min-[470px]:grid-rows-[repeat(20,auto)] min-[800px]:grid-cols-3 min-[800px]:grid-rows-[repeat(12,auto)]">
      {PILLAR_CLUSTER_GROUPS.flatMap((group) =>
        group.pillars.map((pillar) => (
          <PillarCard
            key={pillar.id}
            pillar={pillar}
            clusterLabel={group.label}
            color={group.color}
            textColor={group.textColor}
            showLatestChanges={showLatestChanges}
          />
        )),
      )}
    </div>
  );
}
