import { TOOL_TEXT } from "@/styles/control-typography";
import { cn } from "@/utils";
import { PILLAR_STATE } from "@/utils/profile-stamp";

/** Screen-reader name for what the colour and icon carry visually. */
const STATE_LABEL = {
  [PILLAR_STATE.clear]: "up to date",
  [PILLAR_STATE.raised]: "needs review",
  [PILLAR_STATE.eased]: "needs review",
  [PILLAR_STATE.mixed]: "needs review",
  [PILLAR_STATE.unverified]: "version unknown",
};

/**
 * Green and amber lifted from `SAVE_STATUS_META` (constants/save-status.js) so settled/needs-action match app-wide.
 * `eased` is amber too: a changed level needs review even when the change may qualify the user for more.
 * `mixed` is amber because "may be wrong in some direction" is caution, and must not borrow the grey that
 * means "no information".
 *
 * Bare glyphs, not lucide icons: at this rung a circled mark spends most of its box on the ring. Text also
 * inherits the font and sits on the version's baseline, which an SVG has to be nudged onto.
 */
const STATE_META = {
  [PILLAR_STATE.clear]: {
    mark: "✓",
    className: "border-green-600/40 bg-green-50 text-green-700",
  },
  [PILLAR_STATE.raised]: {
    mark: "!",
    className: "border-amber-500/50 bg-amber-50 text-amber-700",
  },
  [PILLAR_STATE.eased]: {
    mark: "!",
    className: "border-amber-500/50 bg-amber-50 text-amber-700",
  },
  [PILLAR_STATE.mixed]: {
    mark: "!",
    className: "border-amber-500/50 bg-amber-50 text-amber-700",
  },
  [PILLAR_STATE.unverified]: {
    mark: "?",
    className: "border-slate-300 bg-slate-100 text-slate-600",
  },
};

/**
 * The version a profile was rated under, plus whether anything it scored has moved since. A whole-profile
 * roll-up — which pillars is answered in the form after loading. An older version still shows green when
 * nothing it scored moved, which is the point of per-level watermarks over a version comparison.
 */
export function FrameworkVersionChip({ state, version, className }) {
  const meta = STATE_META[state] ?? STATE_META[PILLAR_STATE.unverified];
  // "v???" only when there is no version at all — three marks so it reads as a redacted number rather than
  // a single punctuation mark, and keeps the pill's width close to a real "v4.2".
  const label = version ? `v${version}` : "v???";

  return (
    <span
      className={cn(
        // `em` geometry mirrors TrackBadge so the pills sit level.
        "inline-flex shrink-0 items-center gap-[0.3em] rounded-[0.42em] border px-[0.5em] py-[2px] font-semibold tabular-nums",
        TOOL_TEXT.label,
        meta.className,
        className,
      )}
      // No tooltip: the dropdown is for picking, and the WHY lives in the byline once loaded. The icon still
      // needs a name though — colour and shape reach no screen reader.
      aria-label={`Framework ${label}, ${STATE_LABEL[state] ?? STATE_LABEL[PILLAR_STATE.unverified]}`}
    >
      <span aria-hidden="true">{label}</span>
      {/* The unverified label already ends in "?", so its mark would double it. */}
      {version ? (
        <span aria-hidden="true" className="font-bold">
          {meta.mark}
        </span>
      ) : null}
    </span>
  );
}
