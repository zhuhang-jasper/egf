import { HelpCircle } from "lucide-react";

import { LevelInput } from "@/components/LevelInput";
import { Tooltip } from "@/components/ui/Tooltip";

import { useAppStore } from "@/store/useAppStore";

import { CLUSTERS, splitPillarLabelParts } from "@/constants";
import { CARD_TINTED, clusterCardStyle } from "@/styles/card";
import { CONTROL_TEXT, TOOL_TEXT } from "@/styles/control-typography";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";

/**
 * Emoji, pillar name in bold, then the "(Organ)" metaphor muted — each spaced on its own.
 *
 * ONE LINE, ALWAYS. `whitespace-nowrap` keeps the three parts together: the longest label
 * ("🗣️ Communication (Voice)") measures ~177px against ~204px of label column at the narrowest chart, so it
 * fits — but only just, and font metrics vary by platform. `truncate` is the safety valve rather than the
 * intent: if a future pillar name or a wider system font overruns, it clips with an ellipsis instead of
 * wrapping to a second line and making one row taller than its siblings. `min-w-0` is what lets the grid's
 * `1fr` column shrink far enough for either to happen.
 *
 * `xs:pr-1` RATHER THAN A GRID GAP on the row, and NOTHING AT BASE. The row was `gap-1 xs:gap-3`, which
 * reserved space beside the controls whether or not the label reached that far — width the longest label needed
 * to stay on one line. As padding inside the label's own column it separates the two only where the text
 * actually arrives, and it travels with the truncation: an ellipsis lands before the pad, not against the help
 * icon.
 *
 * The narrow end gets none of it: that is where the longest label is closest to overrunning, and the controls
 * beside it already carry their own left-hand whitespace (the help icon's box, then the stepper's border). 4px
 * at `xs` is enough once there is room to spare.
 */
function PillarLabel({ pillarId }) {
  const { emoji, name, organ } = splitPillarLabelParts(pillarId);
  return (
    <span className="min-w-0 flex items-baseline whitespace-nowrap xs:pr-1">
      {emoji ? <span className="shrink-0">{emoji}</span> : null}
      <span className="font-semibold mx-1 truncate">{name}</span>
      {/* A RUNG UNDER THE NAME (12/13 against the row's inherited 13/14). The organ is a gloss on the pillar,
          not part of its label — it already reads muted and unbolded, and holding it one size down keeps the
          name the thing the eye lands on when the row got larger to match its LevelInput. */}
      {organ ? <span className={cn("shrink-0 font-normal text-slate-500", CONTROL_TEXT)}>{organ}</span> : null}
    </span>
  );
}

export function PillarCluster({ group, onOpenPillarInMatrix }) {
  const pillarLevels = useAppStore((s) => s.pillarLevels);
  const setLevel = useAppStore((s) => s.setLevel);
  const cluster = CLUSTERS[group.id];

  return (
    <div
      // `print:break-inside-avoid` keeps a cluster's pillars together on one sheet — a cluster is at most
      // four rows, so it either fits or moves whole. `print:overflow-visible` for the paged-media
      // clipping reason documented in CompetencyMatrix.
      className={cn(CARD_TINTED, "relative w-full overflow-hidden px-3 xs:px-4 py-3 print:overflow-visible print:break-inside-avoid")}
      data-cluster={group.id}
      style={clusterCardStyle(cluster.surfaceBg, cluster.bezel)}
    >
      <div
        className={cn("mb-2 font-bold uppercase leading-tight tracking-[0.06em]", TOOL_TEXT.label)}
        style={{ color: cluster.midtone }}
      >
        {group.title}
      </div>
      {group.pillars.map((pillar) => (
        <div
          key={pillar.id}
          className={cn("grid grid-cols-[1fr_auto] items-center w-full gap-0 leading-[1.35] text-slate-800", TOOL_TEXT.field)}
        >
          <PillarLabel pillarId={pillar.id} />
          <span className="flex flex-row items-center justify-end shrink-0 gap-3 xs:gap-6">
            {onOpenPillarInMatrix ? (
              <button
                type="button"
                onClick={() => {
                  track("pillar_help_opened", { pillar: pillar.id });
                  onOpenPillarInMatrix(pillar.id);
                }}
                aria-label={`View ${pillar.label} in the competency matrix`}
                // `print:hidden` — a cross-tab jump into the matrix is an action, and the matrix it
                // jumps to isn't on this printed page anyway.
                className="group relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-700 transition-colors hover:text-slate-900 active:text-slate-900 print:hidden"
              >
                <HelpCircle className="size-3.5" aria-hidden />
                <Tooltip text="View in matrix" />
              </button>
            ) : null}
            <LevelInput
              value={pillarLevels[pillar.id]}
              onChange={(v) => setLevel(pillar.id, v)}
              ariaLabel={`${pillar.label} level`}
              ariaLabelUp="Increase level"
              ariaLabelDown="Decrease level"
            />
          </span>
        </div>
      ))}
    </div>
  );
}
