import { useMemo } from "react";

import { useProfileStampState } from "@/hooks/useProfileStamp";

import { useAppStore } from "@/store/useAppStore";

import { FRAMEWORK_VERSION } from "@/constants/changelog";
import { TOOL_TEXT } from "@/styles/control-typography";
import { cn } from "@/utils";
import { PILLAR_STATE } from "@/utils/profile-stamp";

/** "Jan 4, 2026 09:05 AM" — explicit parts, so it cannot silently reformat under another locale. */
function formatSavedAt(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return null;
  }
  const d = new Date(ms);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} ${time}`;
}

/**
 * Provenance for the loaded profile, after the "Tested using Methodology v2.3 / Updated <date>" line review
 * sites carry. NOT a warning — the chip is the alert surface, this is the record that makes it checkable.
 *
 * Three states, and the tense is what separates them: a SAVED profile (or an unsaved clone, which inherited
 * its source's stamp — see duplicateDraft) was "Rated using" the version it holds; a plain DRAFT is "Rating
 * using" the current one, since it is being rated right now and against nothing else. Only the first two can
 * carry an Updated date or a stale warning.
 */
export function ProfileByline({ className }) {
  const profiles = useAppStore((s) => s.profiles);
  const activeSavedProfileId = useAppStore((s) => s.activeSavedProfileId);
  const draftFrameworkVersion = useAppStore((s) => s.draftFrameworkVersion);
  const pillarLevels = useAppStore((s) => s.pillarLevels);
  const active = profiles.find((p) => p.id === activeSavedProfileId) ?? null;
  // A clone stands in as its own subject: the inherited stamp with the LIVE levels, which is what the pillar
  // flags already resolve against, so the two agree.
  // useMemo so the stand-in keeps a stable identity — useProfileStampState memoizes on the object, and a
  // fresh literal every render would defeat it.
  const subject = useMemo(
    () => active ?? (draftFrameworkVersion ? { frameworkVersion: draftFrameworkVersion, pillarLevels, savedAt: 0 } : null),
    [active, draftFrameworkVersion, pillarLevels],
  );
  const { state, version } = useProfileStampState(subject);

  const savedAt = formatSavedAt(subject?.savedAt);
  const isStale = state === PILLAR_STATE.raised || state === PILLAR_STATE.eased || state === PILLAR_STATE.mixed;
  // Capital F: a short form of "9-Pillar Engineer Growth Framework", not the generic noun. Not "EGF" —
  // site.js already rejected a bare acronym nothing on the page spells out. "v?" keeps the same shape as the
  // stamped line; no bound like "< v3.1", which the data cannot support.
  //
  // PRESENT TENSE FOR A DRAFT with nothing to describe yet: it has not been rated against anything, it is
  // being rated now, and against the current framework by definition. Saying "Rated using" there would claim
  // a provenance the numbers do not have.
  let rated = `Rating using Framework v${FRAMEWORK_VERSION}`;
  if (subject) {
    rated = version ? `Rated using Framework v${version}` : "Rated using Framework v???";
  }

  // `label` (10/12) not `annotation`: this is prose meant to be read, and 9px is below comfortable for it.
  return (
    <div className={cn("w-full leading-snug text-slate-500", TOOL_TEXT.label, className)}>
      {/* Version and save time are one thought, so one line, joined by the middot used in the nav. */}
      <p>
        {rated}
        {/* "Updated": savedAt is rewritten by every write, so it is last-modified. No created-at exists. */}
        {savedAt ? <span className="print:hidden"> · Updated {savedAt}</span> : null}
      </p>
      {/* Own line, not a third middot clause: the line above states what IS, this what CHANGED SINCE. It is
          also the only clause that is ever amber. */}
      {isStale ? <p className="text-amber-700">Some levels have changed since you rated this. Check the flagged pillars.</p> : null}
    </div>
  );
}
