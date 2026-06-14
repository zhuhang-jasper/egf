import { getClusterSurfaceBg } from "@/lib/constants";
import { PILLAR_CLUSTER_GROUPS } from "@/lib/constants/about-data";

function PillarCard({ pillar, clusterLabel, color, textColor }) {
  return (
    <article
      className="h-full rounded-xl border border-white/70 p-3 shadow-sm shadow-slate-200/40"
      style={{ backgroundColor: getClusterSurfaceBg(color) }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-slate-900">{pillar.pillar}</p>
        <span
          className="max-w-[45%] shrink-0 text-right text-[10px] font-semibold uppercase leading-snug tracking-wider"
          style={{ color: textColor }}
        >
          {clusterLabel}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-800">{pillar.focusSummary}</p>
      <p className="mt-1.5 text-[11px] italic leading-snug text-slate-800">&ldquo;{pillar.signatureQuestion}&rdquo;</p>
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
