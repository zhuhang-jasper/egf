import { StaticCompetencyChart } from "@/components/StaticCompetencyChart";

import { CAREER_TRACK_PROFILES, FOUNDATIONAL_PHASE, sortKeyFocusPillars } from "@/lib/constants/about-data";
import { cn } from "@/lib/utils";

const cardClass = "rounded-xl border border-slate-100 bg-white shadow-md shadow-slate-200/40";
const levelBadgeClass =
  "inline-flex h-[1.125rem] min-w-[1.75rem] shrink-0 items-center justify-center rounded px-1 text-[9px] font-bold leading-none tabular-nums";

function LevelBadge({ level, backgroundColor, color }) {
  return (
    <span className={levelBadgeClass} style={{ backgroundColor, color }}>
      {level}
    </span>
  );
}

const TRACK_STYLE = {
  "deep-technical": {
    accent: "#756085",
    chipBg: "#cdbdd866",
    textColor: "#756085",
    levelBadgeBg: "#c4b5d0",
    levelBadgeText: "#3f3549",
  },
  "product-focused": {
    accent: "#b8653a",
    chipBg: "#f5b39d66",
    textColor: "#b8653a",
    levelBadgeBg: "#e8b09a",
    levelBadgeText: "#5c2e14",
  },
  "people-delivery": {
    accent: "#4d7356",
    chipBg: "#bddbb566",
    textColor: "#4d7356",
    levelBadgeBg: "#b0cdb0",
    levelBadgeText: "#1f3d28",
  },
};

const FOUNDATION_STYLE = {
  accent: "#0f172a",
};

function RoleCellContent({ title, subtitle, note }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-medium leading-snug text-slate-800">{title}</p>
      {subtitle ? <p className="text-[11px] font-medium leading-snug text-slate-800">{subtitle}</p> : null}
      {note ? <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{note}</p> : null}
    </div>
  );
}

function TrackRoleSequence({ roleLevels, badgeBg, badgeColor, desktopGridColumns, centerDesktop }) {
  const gridColumns = desktopGridColumns ?? roleLevels.length;

  const desktopTile = ({ level, title, subtitle, note }) => (
    <li key={`${level}-${title}`} className="flex min-w-0 flex-col rounded-md border border-slate-200/90 bg-white px-1.5 py-1.5 shadow-sm">
      <LevelBadge level={level} backgroundColor={badgeBg} color={badgeColor} />
      <div className="mt-1.5 min-w-0 flex-1">
        <RoleCellContent title={title} subtitle={subtitle} note={note} />
      </div>
    </li>
  );

  return (
    <>
      <ol className="flex flex-col gap-1 min-[450px]:hidden">
        {roleLevels.map(({ level, title, subtitle, note }) => (
          <li
            key={`${level}-${title}-mobile`}
            className="flex items-center gap-2 rounded-md border border-slate-200/90 bg-white px-2 py-1.5 shadow-sm"
          >
            <LevelBadge level={level} backgroundColor={badgeBg} color={badgeColor} />
            <RoleCellContent title={title} subtitle={subtitle} note={note} />
          </li>
        ))}
      </ol>

      {centerDesktop ? (
        <div className="hidden min-[450px]:flex min-[450px]:justify-center">
          <ol className="w-2/5 min-w-0 list-none">{roleLevels.map((role) => desktopTile(role))}</ol>
        </div>
      ) : (
        <ol
          className="hidden w-full list-none items-stretch gap-1 min-[450px]:grid"
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
        <span
          key={pillar}
          className="rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none"
          style={{ backgroundColor: chipBg, color: textColor }}
        >
          {pillar}
        </span>
      ))}
    </div>
  );
}

function FoundationalPhase() {
  const { chipBg, textColor } = TRACK_STYLE["deep-technical"];

  return (
    <article className={cn(cardClass, "overflow-hidden border-l-[3px] p-3")} style={{ borderLeftColor: FOUNDATION_STYLE.accent }}>
      <div className="space-y-2.5">
        <h3 className="text-[13px] font-semibold text-slate-900">{FOUNDATIONAL_PHASE.title}</h3>

        <div className="space-y-2">
          <p className="text-[11px] leading-snug text-slate-800">{FOUNDATIONAL_PHASE.intro}</p>

          <ul className="list-disc space-y-2 pl-4">
            {FOUNDATIONAL_PHASE.domains.map(({ label, body }) => (
              <li key={label} className="text-[11px] leading-snug text-slate-800">
                <span className="font-bold">{label}:</span> {body}
              </li>
            ))}
          </ul>

          <KeyPillarChips pillars={FOUNDATIONAL_PHASE.technicalPillars} chipBg={chipBg} textColor={textColor} />
        </div>

        <TrackRoleSequence roleLevels={FOUNDATIONAL_PHASE.roleLevels} badgeBg={FOUNDATION_STYLE.accent} badgeColor="#ffffff" centerDesktop />
      </div>
    </article>
  );
}

function CareerTrackCard({ track }) {
  const style = TRACK_STYLE[track.id] ?? TRACK_STYLE["deep-technical"];

  return (
    <article className={cn(cardClass, "overflow-hidden border-l-[3px]")} style={{ borderLeftColor: style.accent }}>
      <div className="space-y-2.5 p-3">
        <h3 className="text-[13px] font-semibold" style={{ color: style.accent }}>
          {track.name}
        </h3>

        <div className="grid grid-cols-1 gap-3 min-[450px]:grid-cols-2 min-[450px]:items-start min-[450px]:gap-x-4">
          <div className="order-2 w-full min-[450px]:order-1">
            <div className="rounded-lg p-2" style={{ backgroundColor: style.chipBg }}>
              <StaticCompetencyChart levels={track.levels} title={track.name} trackVariant="fe" aria-label={`${track.name} competency profile`} />
            </div>
          </div>

          <div className="order-1 space-y-1.5 min-[450px]:order-2">
            <p className="text-[11px] leading-snug text-slate-800">{track.summary}</p>
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
      {CAREER_TRACK_PROFILES.map((track) => (
        <CareerTrackCard key={track.id} track={track} />
      ))}
    </div>
  );
}
