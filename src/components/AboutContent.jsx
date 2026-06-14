import { CareerTracks } from "@/components/CareerTracks";
import { CompetencyMatrix } from "@/components/CompetencyMatrix";
import { PillarGrid } from "@/components/PillarGrid";

import { CAREER_TRACKS_SECTION_INTRO, PILLARS_SECTION_INTRO, SENIORITY_LEVEL_DEFINITIONS, SENIORITY_SECTION_INTRO } from "@/lib/constants/about-data";
import { cn } from "@/lib/utils";

const cardClass = "rounded-xl border border-slate-100 bg-white shadow-md shadow-slate-200/40";

function SectionHeading({ title, subtitle }) {
  return (
    <header className="space-y-1">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
      {subtitle ? <p className="text-xs leading-snug text-slate-800">{subtitle}</p> : null}
    </header>
  );
}

const levelBadgeClass = "flex shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-white";

function seniorityColumnClass(columnIndex) {
  return cn("min-w-0 px-1", columnIndex < SENIORITY_LEVEL_DEFINITIONS.length - 1 && "border-r border-slate-200/80");
}

function SeniorityStepper() {
  return (
    <>
      <div className="space-y-2 min-[450px]:hidden">
        {SENIORITY_LEVEL_DEFINITIONS.map(({ code, phase, description, seniority }) => (
          <div key={code} className={cn(cardClass, "flex items-center gap-2.5 p-3")}>
            <span className={cn(levelBadgeClass, "size-7 text-[12px]")}>{code}</span>
            <div className="min-w-0 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 text-[12px] font-semibold text-slate-800">{phase}</p>
                <p className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">{seniority}</p>
              </div>
              <p className="text-[11px] leading-snug text-slate-800">{description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={cn(cardClass, "hidden p-3 min-[450px]:block")}>
        <div className="grid grid-cols-5 gap-y-1.5">
          {SENIORITY_LEVEL_DEFINITIONS.map(({ code }, index) => (
            <div key={`${code}-badge`} className={cn(seniorityColumnClass(index), "flex justify-start")}>
              <span className={cn(levelBadgeClass, "size-5 text-[9px]")}>{code}</span>
            </div>
          ))}

          {SENIORITY_LEVEL_DEFINITIONS.map(({ code, phase }, index) => (
            <div key={`${code}-phase`} className={seniorityColumnClass(index)}>
              <p className="text-[11px] font-semibold leading-snug text-slate-800">{phase}</p>
            </div>
          ))}

          {SENIORITY_LEVEL_DEFINITIONS.map(({ code, seniority }, index) => (
            <div key={`${code}-seniority`} className={seniorityColumnClass(index)}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{seniority}</p>
            </div>
          ))}

          {SENIORITY_LEVEL_DEFINITIONS.map(({ code, description }, index) => (
            <div key={`${code}-description`} className={seniorityColumnClass(index)}>
              <p className="text-[11px] leading-snug text-slate-800">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function AboutContent() {
  return (
    <div className="space-y-6 print:max-w-none">
      <section className="space-y-3">
        <SectionHeading title="9 Big Pillars" subtitle={PILLARS_SECTION_INTRO} />
        <PillarGrid />
      </section>

      <section className="space-y-3">
        <SectionHeading title="5 Seniority Levels" subtitle={SENIORITY_SECTION_INTRO} />
        <SeniorityStepper />
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="The 45-Point Competency Matrix"
          subtitle="The comprehensive behavioral matrix mapping expectations for all 9 pillars. Organized by the Technical, Product, and Operational clusters, and evaluated across the L1-L5 seniority scale."
        />
        <CompetencyMatrix />
      </section>

      <section className="space-y-3">
        <SectionHeading title="3 Career Tracks" subtitle={CAREER_TRACKS_SECTION_INTRO} />
        <CareerTracks />
      </section>
    </div>
  );
}
