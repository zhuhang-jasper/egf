import { StaticCompetencyChart } from "@/components/StaticCompetencyChart";

import { CLUSTERS, getClusterSurfaceBg } from "@/constants";
import { CAREER_TRACK_PROFILES, FOUNDATIONAL_PHASE, SENIOR_FORK, sortKeyFocusPillars } from "@/constants/theory-data";
import { DOC_TEXT } from "@/styles/doc-typography";
import { cn } from "@/utils";

const cardClass = "rounded-xl border border-slate-100 bg-white shadow-md shadow-slate-200/40";
const levelBadgeClass = cn("inline-flex min-w-[1.75rem] shrink-0 items-center justify-center rounded px-1 py-1", DOC_TEXT.badgeSm);

function LevelBadge({ level, backgroundColor, color, fullWidth = false }) {
  return (
    <span className={cn(levelBadgeClass, fullWidth && "w-full")} style={{ backgroundColor, color }}>
      {level}
    </span>
  );
}

const TRACK_STYLE = {
  "foundation": {
    accent: "#0f172a",
    chipBg: getClusterSurfaceBg(CLUSTERS.technical.color),
    textColor: CLUSTERS.technical.textColor,
    levelBadgeBg: CLUSTERS.technical.badgeBg,
    levelBadgeText: CLUSTERS.technical.badgeText,
  },
  "deep-technical": {
    accent: CLUSTERS.technical.textColor,
    chipBg: getClusterSurfaceBg(CLUSTERS.technical.color),
    textColor: CLUSTERS.technical.textColor,
    levelBadgeBg: CLUSTERS.technical.badgeBg,
    levelBadgeText: CLUSTERS.technical.badgeText,
  },
  "product-focused": {
    accent: CLUSTERS.product.textColor,
    chipBg: getClusterSurfaceBg(CLUSTERS.product.color),
    textColor: CLUSTERS.product.textColor,
    levelBadgeBg: CLUSTERS.product.badgeBg,
    levelBadgeText: CLUSTERS.product.badgeText,
  },
  "people-delivery": {
    accent: CLUSTERS.operational.textColor,
    chipBg: getClusterSurfaceBg(CLUSTERS.operational.color),
    textColor: CLUSTERS.operational.textColor,
    levelBadgeBg: CLUSTERS.operational.badgeBg,
    levelBadgeText: CLUSTERS.operational.badgeText,
  },
};

function RoleCellContent({ title }) {
  return (
    <div className="min-w-0 flex-1">
      <p className={DOC_TEXT.bodyMedium}>{title}</p>
    </div>
  );
}

function TrackRoleSequence({ roleLevels, badgeBg, badgeColor, desktopGridColumns, centerDesktop }) {
  const gridColumns = desktopGridColumns ?? roleLevels.length;

  const desktopTile = ({ level, title }, fullWidthBadge = false) => (
    <li key={`${level}-${title}`} className="flex min-w-0 flex-col rounded-md border border-slate-200/90 bg-white px-1.5 py-1.5 shadow-sm">
      <LevelBadge level={level} backgroundColor={badgeBg} color={badgeColor} fullWidth={fullWidthBadge} />
      <div className="mt-1.5 min-w-0 flex-1">
        <RoleCellContent title={title} />
      </div>
    </li>
  );

  return (
    <>
      <ol className="flex flex-col gap-1 min-[470px]:hidden">
        {roleLevels.map(({ level, title }) => (
          <li
            key={`${level}-${title}-mobile`}
            className="flex items-center gap-2 rounded-md border border-slate-200/90 bg-white px-2 py-1.5 shadow-sm"
          >
            <LevelBadge level={level} backgroundColor={badgeBg} color={badgeColor} />
            <RoleCellContent title={title} />
          </li>
        ))}
      </ol>

      {centerDesktop ? (
        <ol className="hidden w-full list-none text-center min-[470px]:block">{roleLevels.map((role) => desktopTile(role, true))}</ol>
      ) : (
        <ol
          className="hidden w-full list-none items-stretch gap-1 min-[470px]:grid"
          style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
        >
          {roleLevels.map((role) => desktopTile(role))}
        </ol>
      )}
    </>
  );
}

function KeyPillarChips({ pillars, chipBg, textColor }) {
  return (
    <div className="flex flex-wrap gap-1">
      {pillars.map((pillar) => (
        <span key={pillar} className={cn("rounded-md px-1.5 py-0.5", DOC_TEXT.chip)} style={{ backgroundColor: chipBg, color: textColor }}>
          {pillar}
        </span>
      ))}
    </div>
  );
}

function FoundationalPhase() {
  const style = TRACK_STYLE.foundation;

  return (
    <article className={cn(cardClass, "overflow-hidden border-l-[3px] p-3")} style={{ borderLeftColor: style.accent }}>
      <div className="space-y-2.5">
        <h3 className={cn(DOC_TEXT.cardTitlePlain, "font-bold")}>{FOUNDATIONAL_PHASE.title}</h3>

        <div className="space-y-2">
          <p className={DOC_TEXT.bodyMedium}>{FOUNDATIONAL_PHASE.intro}</p>

          <KeyPillarChips pillars={FOUNDATIONAL_PHASE.technicalPillars} chipBg={style.chipBg} textColor={style.textColor} />
        </div>

        <TrackRoleSequence roleLevels={FOUNDATIONAL_PHASE.roleLevels} badgeBg={style.levelBadgeBg} badgeColor={style.levelBadgeText} centerDesktop />
      </div>
    </article>
  );
}

function CareerTrackCard({ track, number }) {
  const style = TRACK_STYLE[track.id] ?? TRACK_STYLE["deep-technical"];

  return (
    <article className={cn(cardClass, "overflow-hidden border-l-[3px]")} style={{ borderLeftColor: style.accent }}>
      <div className="space-y-2.5 p-3">
        <h3 className={cn(DOC_TEXT.cardTitlePlain, "font-bold")} style={{ color: style.accent }}>
          Track {number}: {track.name}
        </h3>

        <div className="grid grid-cols-1 gap-3 min-[470px]:grid-cols-2 min-[470px]:items-start min-[470px]:gap-x-4">
          <div className="order-2 w-full min-[470px]:order-1">
            <div className="rounded-lg p-2" style={{ backgroundColor: style.chipBg }}>
              <StaticCompetencyChart
                levels={track.levels}
                title={track.name}
                focusedPillars={track.keyFocusPillars}
                maxHeightPx={180}
                aria-label={`${track.name} competency profile`}
              />
            </div>
          </div>

          <div className="order-1 space-y-1.5 min-[470px]:order-2">
            <p className={DOC_TEXT.bodyMedium}>{track.summary}</p>
            <KeyPillarChips pillars={sortKeyFocusPillars(track.keyFocusPillars)} chipBg={style.chipBg} textColor={style.textColor} />
          </div>
        </div>

        <TrackRoleSequence roleLevels={track.roleLevels} badgeBg={style.levelBadgeBg} badgeColor={style.levelBadgeText} />
      </div>
    </article>
  );
}

export function CareerTracks() {
  return (
    <div className="space-y-3">
      <FoundationalPhase />

      <div className="space-y-1 pt-1">
        <h3 className={cn(DOC_TEXT.cardTitlePlain, "font-bold")}>{SENIOR_FORK.title}</h3>
        <p className={DOC_TEXT.bodyMedium}>{SENIOR_FORK.intro}</p>
      </div>

      {CAREER_TRACK_PROFILES.map((track, index) => (
        <CareerTrackCard key={track.id} track={track} number={index + 1} />
      ))}

      <p className={cn("pt-1 pb-2", DOC_TEXT.bodyItalic)}>{SENIOR_FORK.outro}</p>
    </div>
  );
}
