import { useEffect, useRef, useState } from "react";

import { ScrollText } from "lucide-react";

import { CareerTracks } from "@/components/CareerTracks";
import { ChangelogModal } from "@/components/ChangelogModal";
import { CompetencyMatrix } from "@/components/CompetencyMatrix";
import { PillarGrid } from "@/components/PillarGrid";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { StaticCompetencyChart } from "@/components/StaticCompetencyChart";

import { CAREER_TRACKS_SECTION_INTRO, PILLARS_SECTION_INTRO, SENIORITY_LEVEL_DEFINITIONS, SENIORITY_SECTION_INTRO } from "@/constants/theory-data";
import { DOC_SECTION, DOC_TEXT } from "@/styles/doc-typography";
import { cn } from "@/utils";
import { scrollBelowStickyHeaderUntilSettled } from "@/utils/scroll";
import { getPersistedExpandedPillar, getPillarCardElementId, persistExpandedPillar, THEORY_SECTION_IDS, THEORY_SECTIONS } from "@/utils/theory-url";

const cardClass = "rounded-xl border border-slate-300 bg-white shadow-md shadow-slate-200/40";

// Hero radar pillar-label sizing: scale linearly with the chart, from 12px at its small-mobile width
// up to 14px at its desktop max width (the wrapper's max-w-[520px]). Module-level constant so its
// identity is stable across renders (StaticCompetencyChart memoizes on this object).
const HERO_POINT_LABEL_PX_RANGE = { minPx: 12, maxPx: 15, minWidthPx: 300, maxWidthPx: 520 };

// On a deep-link boot, how long to let the scroll-restore loop settle at the remembered position
// before we switch the expanded pillar. Long enough to clear restore's initial frames; short enough
// that the transition still feels prompt.
const DEEPLINK_RESTORE_SETTLE_MS = 350;
// Expand/collapse animation length — matches the `duration-300` on the matrix panel. After switching
// to the deep-link pillar we wait this out so the card has stopped moving before we measure & glide.
const DEEPLINK_EXPAND_ANIM_MS = 300;

function SectionHeading({ title, subtitle, section }) {
  return (
    <header className="space-y-1">
      <div className="flex items-center gap-2">
        <h2 className={DOC_SECTION.title}>{title}</h2>
        <ShareLinkButton section={section} ariaLabel="Copy link to this content" />
      </div>
      {subtitle ? <p className={DOC_SECTION.intro}>{subtitle}</p> : null}
    </header>
  );
}

const levelBadgeClass = "flex shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-white";

/**
 * Renders a "Quality / Identity" phase title. When `breakAfterSlash` is set, a line break is
 * forced after the slash — used in the cramped 5-column grid. In the mobile stacked view the
 * levels sit in vertical cards with ample horizontal room, so the break is left off there.
 */
function SeniorityPhaseTitle({ phase, className, breakAfterSlash = false }) {
  const [quality, identity] = phase.split(" / ");
  return (
    <p className={className}>
      {identity && breakAfterSlash ? (
        <>
          {quality} /<br />
          {identity}
        </>
      ) : (
        phase
      )}
    </p>
  );
}

function SeniorityStepper() {
  return (
    <>
      <div className="space-y-2 sm:hidden">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code, phase, description, seniority }) => (
          <div key={code} className={cn(cardClass, "flex items-center gap-2.5 p-3")}>
            <span className={cn(levelBadgeClass, "size-7", DOC_TEXT.badgeMd)}>{code}</span>
            <div className="min-w-0 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <SeniorityPhaseTitle
                  phase={phase}
                  className={cn("min-w-0", DOC_TEXT.bodySemibold, "font-bold text-[13px] sm:text-[14px] md:text-[15px]")}
                />
                <p className={cn("shrink-0", DOC_TEXT.meta)}>{seniority}</p>
              </div>
              <p className={DOC_TEXT.body}>{description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block">
        {/* Cards stretch to equal height (grid default). Inside each, flex-col pushes the seniority
            footer to the bottom (mt-auto) so JUNIOR/MID/SENIOR… align across columns regardless of
            how tall each description runs. */}
        <div className="grid grid-cols-5 items-stretch gap-2">
          {SENIORITY_LEVEL_DEFINITIONS.map(({ code, phase, description, seniority }) => (
            <div key={code} className={cn(cardClass, "flex min-w-0 flex-col gap-y-2.5 p-3")}>
              <div className="flex justify-start">
                <span className={cn(levelBadgeClass, "size-7 shrink-0", DOC_TEXT.badgeMd)}>{code}</span>
              </div>
              <SeniorityPhaseTitle
                phase={phase}
                className={cn("min-w-0", DOC_TEXT.bodySemibold, "font-bold text-[13px] sm:text-[14px] md:text-[15px]")}
              />
              <p className={DOC_TEXT.body}>{description}</p>
              <p className={cn("mt-auto", DOC_TEXT.meta)}>{seniority}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TheoryContent({ deepLink, onDeepLinkConsumed, matrixNav, cancelRestoreRef }) {
  const consumedRef = useRef(false);

  // Expanded pillar state lives here so the matrix share button can read it. On a deep-link boot we
  // intentionally start from the *persisted* pillar, NOT the deep-link's — so the page first restores
  // its previous scroll against the layout it was saved with (old pillar A still open). The deep-link
  // effect below then switches to pillar B (collapse A, expand B) once restore has settled, and only
  // then glides to B. Expanding B immediately here would shift layout under the restore and land it
  // at the wrong spot.
  const [expandedPillar, setExpandedPillar] = useState(getPersistedExpandedPillar);

  // The "What's New" highlighter is permanently OFF: the `**…**` markers still exist in the copy
  // (kept for future use) but the amber fill never renders, so elevated text always reads as plain
  // text. The page-level toggle has been replaced by the "Show changelog" button below; sections
  // receive a hardcoded `false`.
  const [changelogOpen, setChangelogOpen] = useState(false);

  // In-app jump from a tool-form pillar's help icon. Expanding the pillar makes CompetencyMatrix
  // scroll to it; persist so the choice survives like a normal expand. Keyed on `seq` so clicking
  // the same pillar again re-runs (a no-op state change wouldn't re-trigger the matrix scroll).
  const matrixNavSeq = matrixNav?.seq;
  useEffect(() => {
    const pillarId = matrixNav?.pillarId;
    if (!pillarId) {
      return;
    }
    persistExpandedPillar(pillarId);
    setExpandedPillar(pillarId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixNavSeq]);

  useEffect(() => {
    if (!deepLink || consumedRef.current) {
      return undefined;
    }

    const { section } = deepLink;
    if (!section) {
      onDeepLinkConsumed?.();
      consumedRef.current = true;
      return undefined;
    }

    const sectionId = THEORY_SECTION_IDS[section];
    if (!sectionId) {
      onDeepLinkConsumed?.();
      consumedRef.current = true;
      return undefined;
    }

    // For a matrix pillar deep-link, scroll to the (expanded) pillar card itself, not the
    // section heading. Falls back to the section when no pillar is targeted.
    const targetPillar = section === THEORY_SECTIONS.matrix ? deepLink.pillar : null;
    const targetId = targetPillar ? getPillarCardElementId(targetPillar) : sectionId;

    // Staged so a shared link feels like a real navigation, not a teleport:
    //   1. double rAF — let the hidden tabpanel lay out so the restore loop can land at the remembered
    //      scroll (against the OLD expanded pillar, the layout that scroll was saved with).
    //   2. after DEEPLINK_RESTORE_SETTLE_MS — restore has settled; NOW switch to the deep-link pillar
    //      (collapse the old one, expand the target). cancelRestoreRef is flipped here because this
    //      expand changes layout and we no longer want restore re-asserting the old position.
    //   3. after the expand animation — re-aim until the card stops moving (the old pillar may be
    //      collapsing above the target, sliding it up), then smooth-glide. A single scroll would land
    //      a below-the-old-pillar target gapless under the bar.
    let settleTimer = null;
    let glideTimer = null;
    let inner = null;
    let cancelSettled = null;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        settleTimer = setTimeout(() => {
          if (cancelRestoreRef) {
            cancelRestoreRef.current = true; // restore done — stop it before the expand shifts layout
          }
          if (targetPillar) {
            persistExpandedPillar(targetPillar);
            setExpandedPillar(targetPillar);
          }
          glideTimer = setTimeout(() => {
            const el = document.getElementById(targetId) ?? document.getElementById(sectionId);
            if (el) {
              cancelSettled = scrollBelowStickyHeaderUntilSettled(el);
            }
            onDeepLinkConsumed?.();
            consumedRef.current = true;
          }, DEEPLINK_EXPAND_ANIM_MS);
        }, DEEPLINK_RESTORE_SETTLE_MS);
      });
    });

    return () => {
      cancelAnimationFrame(outer);
      if (inner !== null) {
        cancelAnimationFrame(inner);
      }
      if (settleTimer !== null) {
        clearTimeout(settleTimer);
      }
      if (glideTimer !== null) {
        clearTimeout(glideTimer);
      }
      cancelSettled?.();
    };
    // deepLink and onDeepLinkConsumed are stable boot-time values — intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 print:max-w-none">
      <div className="space-y-2">
        <div className="flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => setChangelogOpen(true)}
            className="group inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 bg-white py-1 pl-2.5 pr-3 text-[11px] font-semibold tracking-wide text-slate-600 hover:bg-slate-50 hover:text-slate-800 sm:text-[12px]"
          >
            <ScrollText className="size-3.5 shrink-0" aria-hidden />
            Show Changelog
          </button>
        </div>

        <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />

        <div className="mx-auto w-full max-w-[520px] mb-4">
          <StaticCompetencyChart
            levels={[]}
            plainLabels={false}
            pointLabelPxRange={HERO_POINT_LABEL_PX_RANGE}
            clusterLabelColors
            heroLabelNudge
            hidePolygon
            showLevelTicks
            fullWidth
            aria-label="Empty 9-pillar competency radar"
          />
        </div>

        <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.pillars]} className="space-y-3">
          <SectionHeading title="I. 9 Big Pillars" subtitle={PILLARS_SECTION_INTRO} section={THEORY_SECTIONS.pillars} />
          <PillarGrid showLatestChanges={false} />
        </section>
      </div>

      <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.seniority]} className="space-y-3">
        <SectionHeading title="II. 5 Seniority Levels" subtitle={SENIORITY_SECTION_INTRO} section={THEORY_SECTIONS.seniority} />
        <SeniorityStepper />
      </section>

      <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.matrix]} className="space-y-3">
        <SectionHeading
          title="III. The 45-Point Competency Matrix"
          subtitle="The full behavioral matrix: 9 pillars × 5 levels. Expand any pillar to reveal its 5 cells — each describes the observable behaviors expected at that level, organized by the three clusters."
          section={THEORY_SECTIONS.matrix}
        />
        <CompetencyMatrix
          expandedPillar={expandedPillar}
          onExpandedPillarChange={setExpandedPillar}
          scrollNav={matrixNav}
          showLatestChanges={false}
        />
      </section>

      <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.tracks]} className="space-y-3">
        <SectionHeading title="IV. Career Growth Roadmap" subtitle={CAREER_TRACKS_SECTION_INTRO} section={THEORY_SECTIONS.tracks} />
        <CareerTracks />
      </section>
    </div>
  );
}

export { TheoryContent };
