import { useEffect, useRef, useState } from "react";

import { CareerTracks } from "@/components/CareerTracks";
import { CompetencyMatrix } from "@/components/CompetencyMatrix";
import { PillarGrid } from "@/components/PillarGrid";
import { ShareLinkButton } from "@/components/ShareLinkButton";

import { CAREER_TRACKS_SECTION_INTRO, PILLARS_SECTION_INTRO, SENIORITY_LEVEL_DEFINITIONS, SENIORITY_SECTION_INTRO } from "@/constants/theory-data";
import { DOC_SECTION, DOC_TEXT } from "@/styles/doc-typography";
import { cn } from "@/utils";
import { scrollBelowStickyHeader } from "@/utils/scroll";
import { getPersistedExpandedPillar, getPillarCardElementId, THEORY_SECTION_IDS, THEORY_SECTIONS } from "@/utils/theory-url";

const cardClass = "rounded-xl border border-slate-100 bg-white shadow-md shadow-slate-200/40";

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

function TheoryContent({ deepLink, onDeepLinkConsumed }) {
  const consumedRef = useRef(false);

  // Expanded pillar state lives here so the matrix share button can read it.
  const [expandedPillar, setExpandedPillar] = useState(() => {
    const fromDeepLink = deepLink?.section === THEORY_SECTIONS.matrix ? deepLink.pillar : null;
    return fromDeepLink ?? getPersistedExpandedPillar();
  });

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
    const targetId = section === THEORY_SECTIONS.matrix && deepLink.pillar ? getPillarCardElementId(deepLink.pillar) : sectionId;

    // Double rAF: first frame lets the hidden tabpanel become visible,
    // second lets layout settle so getBoundingClientRect is accurate.
    let inner = null;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const el = document.getElementById(targetId) ?? document.getElementById(sectionId);
        if (el) {
          scrollBelowStickyHeader(el, { behavior: "smooth" });
        }
        onDeepLinkConsumed?.();
        consumedRef.current = true;
      });
    });

    return () => {
      cancelAnimationFrame(outer);
      if (inner !== null) {
        cancelAnimationFrame(inner);
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
        <CompetencyMatrix expandedPillar={expandedPillar} onExpandedPillarChange={setExpandedPillar} />
      </section>

      <section id={THEORY_SECTION_IDS[THEORY_SECTIONS.tracks]} className="space-y-3">
        <SectionHeading title="IV. 3 Career Tracks" subtitle={CAREER_TRACKS_SECTION_INTRO} section={THEORY_SECTIONS.tracks} />
        <CareerTracks />
      </section>
    </div>
  );
}

export { TheoryContent };
