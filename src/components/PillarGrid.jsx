import { EmphasizedText } from "@/components/EmphasizedText";

import { PILLAR_CLUSTER_GROUPS } from "@/constants/theory-data";
import { CARD_TINTED, clusterCardStyle } from "@/styles/card";
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
      // Surface and left bezel both from CARD_TINTED + clusterCardStyle, the same pair the tool form's cluster
      // cards and the matrix cards use, so every cluster-tinted card in the app stays one look.
      className={cn(CARD_TINTED, "overflow-hidden p-3 xs:row-span-4 xs:grid xs:grid-rows-subgrid gap-2 print:overflow-visible")}
      style={clusterCardStyle(color, textColor)}
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
      {/* `mt-2` below `xs` / `gap-2` from `xs` up: the card is display:block on the narrowest layout,
          where `gap` does nothing, so margins carry the rhythm there and are zeroed once it becomes a
          subgrid. Both express the same 8px step. */}
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

export function PillarGrid({ showLatestChanges = false }) {
  return (
    /* THE COLUMN COUNT AND THE ROW TEMPLATE MOVE TOGETHER, because each card is a 4-row subgrid (see
       PillarCard's `xs:row-span-4 … xs:grid-rows-subgrid`): 9 cards over 2 columns is 5 card-rows × 4 = 20,
       over 3 columns 3 × 4 = 12. Never change one without the other.

       `data-print-pillar-grid` is the hook for the print override in index.css. These `xs:`/`md:` queries are
       plain `min-width`, so in paged media they resolve against the PAGE BOX — the printed grid is already
       paper-size responsive, it just reached 3 columns too late (at `md`, 768px, which most portrait paper
       falls under). The override lowers that one threshold; the 2-column and 1-column steps here still do the
       work for smaller paper. */
    <div
      data-print-pillar-grid
      className="grid grid-cols-1 gap-2 xs:grid-cols-2 xs:grid-rows-[repeat(20,auto)] md:grid-cols-3 md:grid-rows-[repeat(12,auto)]"
    >
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
