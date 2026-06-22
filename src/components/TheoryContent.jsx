import { useEffect, useRef, useState } from "react";

import { CareerTracks } from "@/components/CareerTracks";
import { CompetencyMatrix } from "@/components/CompetencyMatrix";
import { PillarGrid } from "@/components/PillarGrid";
import { ShareLinkButton } from "@/components/ShareLinkButton";

import { CAREER_TRACKS_SECTION_INTRO, PILLARS_SECTION_INTRO, SENIORITY_LEVEL_DEFINITIONS, SENIORITY_SECTION_INTRO } from "@/constants/theory-data";
import { DOC_SECTION, DOC_TEXT } from "@/styles/doc-typography";
import { cn } from "@/utils";
import { scrollBelowStickyHeader } from "@/utils/scroll";
import { getPersistedExpandedPillar, getPillarCardElementId, persistExpandedPillar, THEORY_SECTION_IDS, THEORY_SECTIONS } from "@/utils/theory-url";

const cardClass = "rounded-xl border border-slate-100 bg-white shadow-md shadow-slate-200/40";

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

function SeniorityStepper() {
  return (
    <>
      <div className="space-y-2 min-[470px]:hidden">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code, phase, description, seniority }) => (
          <div key={code} className={cn(cardClass, "flex items-center gap-2.5 p-3")}>
            <span className={cn(levelBadgeClass, "size-7", DOC_TEXT.badgeMd)}>{code}</span>
            <div className="min-w-0 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={cn("min-w-0", DOC_TEXT.bodySemibold)}>{phase}</p>
                <p className={cn("shrink-0", DOC_TEXT.meta)}>{seniority}</p>
              </div>
              <p className={DOC_TEXT.body}>{description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={cn(cardClass, "hidden p-3 min-[470px]:block")}>
        <div className="grid grid-cols-5 grid-rows-[repeat(4,auto)]">
          {SENIORITY_LEVEL_DEFINITIONS.map(({ code, phase, description, seniority }, index) => (
            <div
              key={code}
              className={cn(
                "row-span-4 grid min-w-0 grid-rows-subgrid gap-y-1.5 px-1",
                index < SENIORITY_LEVEL_DEFINITIONS.length - 1 && "border-r border-slate-200/80",
              )}
            >
              <div className="flex justify-start">
                <span className={cn(levelBadgeClass, "size-5", DOC_TEXT.badgeMicro)}>{code}</span>
              </div>
              <p className={DOC_TEXT.bodySemibold}>{phase}</p>
              <p className={DOC_TEXT.body}>{description}</p>
              <p className={DOC_TEXT.meta}>{seniority}</p>
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
    //   3. after the expand animation — the card has stopped moving, so measure it and smooth-glide.
    let settleTimer = null;
    let glideTimer = null;
    let inner = null;
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
              scrollBelowStickyHeader(el, { behavior: "smooth" });
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
    };
    // deepLink and onDeepLinkConsumed are stable boot-time values — intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 print:max-w-none">
      <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.pillars]} className="space-y-3">
        <SectionHeading title="I. 9 Big Pillars" subtitle={PILLARS_SECTION_INTRO} section={THEORY_SECTIONS.pillars} />
        <PillarGrid />
      </section>

      <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.seniority]} className="space-y-3">
        <SectionHeading title="II. 5 Seniority Levels" subtitle={SENIORITY_SECTION_INTRO} section={THEORY_SECTIONS.seniority} />
        <SeniorityStepper />
      </section>

      <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.matrix]} className="space-y-3">
        <SectionHeading
          title="III. The 45-Point Competency Matrix"
          subtitle="The comprehensive behavioral matrix mapping expectations for all 9 pillars. Organized by the Technical, Product, and Operational clusters, and evaluated across the L1-L5 seniority scale."
          section={THEORY_SECTIONS.matrix}
        />
        <CompetencyMatrix expandedPillar={expandedPillar} onExpandedPillarChange={setExpandedPillar} scrollNav={matrixNav} />
      </section>

      <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.tracks]} className="space-y-3">
        <SectionHeading title="IV. 3 Career Tracks" subtitle={CAREER_TRACKS_SECTION_INTRO} section={THEORY_SECTIONS.tracks} />
        <CareerTracks />
      </section>
    </div>
  );
}

export { TheoryContent };
