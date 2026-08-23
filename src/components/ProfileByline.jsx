import { useProfileStampState } from "@/hooks/useProfileStamp";

import { useAppStore } from "@/store/useAppStore";

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
 * Renders nothing without a loaded profile: a draft has no provenance to state.
 */
export function ProfileByline({ className }) {
  const profiles = useAppStore((s) => s.profiles);
  const activeSavedProfileId = useAppStore((s) => s.activeSavedProfileId);
  const active = profiles.find((p) => p.id === activeSavedProfileId) ?? null;
  const { state, version } = useProfileStampState(active);

  if (!active) {
    return null;
  }

  const savedAt = formatSavedAt(active.savedAt);
  const isStale = state === PILLAR_STATE.raised || state === PILLAR_STATE.eased || state === PILLAR_STATE.mixed;
  // Capital F: a short form of "9-Pillar Engineer Growth Framework", not the generic noun. Not "EGF" —
  // site.js already rejected a bare acronym nothing on the page spells out. "v?" keeps the same shape as the
  // stamped line; no bound like "< v3.1", which the data cannot support.
  const rated = version ? `Rated using Framework v${version}` : "Rated using Framework v???";

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
