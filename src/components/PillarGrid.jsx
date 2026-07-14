import { EmphasizedText } from "@/components/EmphasizedText";

import { getClusterSurfaceBg } from "@/constants";
import { PILLAR_CLUSTER_GROUPS } from "@/constants/theory-data";
import { DOC_TEXT, WHATS_NEW_HIGHLIGHT_CLASS } from "@/styles/doc-typography";
import { cn } from "@/utils";

// Titles are stored as "<emoji> Name (Organ)" — pull the leading emoji off so it can be
// sized up independently while staying baseline-aligned with the name.
function splitEmoji(title) {
  const match = title.match(/^(?<emoji>\S+)\s+(?<name>.*)$/);
  return match ? { emoji: match.groups.emoji, name: match.groups.name } : { emoji: "", name: title };
}

function PillarCard({ pillar, clusterLabel, color, textColor, showLatestChanges }) {
  const { emoji, name } = splitEmoji(pillar.pillar);
  return (
    <article
      className="rounded-xl border border-white/70 p-3 shadow-sm shadow-slate-200/40 xs:row-span-4 xs:grid xs:grid-rows-subgrid gap-2.5"
      style={{ backgroundColor: getClusterSurfaceBg(color) }}
    >
      {/* single-col: title left + cluster label right; col: title only */}
      <div className="flex flex-row-reverse items-start justify-between gap-3 xs:block">
        <span className={cn("shrink-0 text-right xs:hidden", DOC_TEXT.clusterLabel)} style={{ color: textColor }}>
          {clusterLabel}
        </span>
        <p className={cn("flex min-w-0 flex-1 items-center gap-1.5", DOC_TEXT.cardTitle, "font-bold")}>
          {emoji && <span className="text-xl leading-none">{emoji}</span>}
          <span className="min-w-0">{name}</span>
        </p>
      </div>
      <p className={cn("mt-2 xs:mt-0", DOC_TEXT.body)}>
        <EmphasizedText text={pillar.focusSummary} boldClassName={WHATS_NEW_HIGHLIGHT_CLASS} plain={!showLatestChanges} />
      </p>
      <div className={cn("mt-2 xs:mt-0", DOC_TEXT.bodyItalic)}>
        <p>&ldquo;{pillar.signatureQuestion}&rdquo;</p>
      </div>
      {/* col only: cluster label at bottom */}
      <span className={cn("hidden xs:block text-right", DOC_TEXT.clusterLabel)} style={{ color: textColor }}>
        {clusterLabel}
      </span>
    </article>
  );
}

export function PillarGrid({ showLatestChanges = true }) {
  return (
    <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 xs:grid-rows-[repeat(20,auto)] md:grid-cols-3 md:grid-rows-[repeat(12,auto)]">
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
