import { PILLAR_CLUSTER_GROUPS } from "@/lib/constants/about-data";

function PillarCard({ pillar, clusterLabel, color, textColor }) {
  const clusterBg = `${color}75`;
  return (
    <article className="relative h-full rounded-xl border border-white/70 p-3 shadow-sm shadow-slate-200/40" style={{ backgroundColor: clusterBg }}>
      <span className="absolute right-2 top-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: textColor }}>
        {clusterLabel}
      </span>
      <p className="pr-14 text-[13px] font-semibold text-slate-900">{pillar.pillar}</p>
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
