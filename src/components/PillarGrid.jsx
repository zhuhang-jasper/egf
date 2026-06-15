import { getClusterSurfaceBg } from "@/constants";
import { PILLAR_CLUSTER_GROUPS } from "@/constants/theory-data";
import { DOC_TEXT } from "@/styles/doc-typography";
import { cn } from "@/utils";

function PillarCard({ pillar, clusterLabel, color, textColor }) {
  return (
    <article
      className="h-full rounded-xl border border-white/70 p-3 shadow-sm shadow-slate-200/40"
      style={{ backgroundColor: getClusterSurfaceBg(color) }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={cn("min-w-0 flex-1", DOC_TEXT.cardTitle)}>{pillar.pillar}</p>
        <span className={cn("max-w-[45%] shrink-0 text-right", DOC_TEXT.clusterLabel)} style={{ color: textColor }}>
          {clusterLabel}
        </span>
      </div>
      <p className={cn("mt-1.5", DOC_TEXT.body)}>{pillar.focusSummary}</p>
      <p className={cn("mt-1.5", DOC_TEXT.bodyItalic)}>&ldquo;{pillar.signatureQuestion}&rdquo;</p>
    </article>
  );
}

export function PillarGrid() {
  return (
    <div className="grid grid-cols-1 gap-2 min-[450px]:grid-cols-2">
      {PILLAR_CLUSTER_GROUPS.flatMap((group) =>
        group.pillars.map((pillar) => (
          <PillarCard key={pillar.id} pillar={pillar} clusterLabel={group.label} color={group.color} textColor={group.textColor} />
        )),
      )}
    </div>
  );
}
