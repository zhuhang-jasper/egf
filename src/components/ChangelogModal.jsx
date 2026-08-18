import { useId, useState } from "react";

import { ChevronDown, Info } from "lucide-react";

import { FullModal } from "@/components/ui/Modal";

import { CHANGELOG, CHANGELOG_DRAFT } from "@/constants";
import { cn } from "@/utils";

/** The bullets of one entry, shared so the draft card and a released entry cannot drift apart. */
function ChangeList({ changes, className, bulletClassName }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {changes.map((change, index) => (
        <li key={index} className={cn("flex gap-2 text-[13px] leading-snug text-slate-700", className)}>
          <span aria-hidden className={cn("mt-1.5 size-1 shrink-0 rounded-full bg-slate-400", bulletClassName)} />
          <span>{change}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The unreleased entry, OPEN BY DEFAULT and collapsible.
 *
 * It sits OUTSIDE the released <ol> because it is not part of the history that list enumerates: no date, no
 * version stamp on the tab, no unseen dot. It goes FIRST because it is the freshest signal.
 *
 * OPEN, because a draft hidden behind a caret is a draft nobody reads, and "here is what is coming" is the
 * one thing in this dialog a reader cannot get anywhere else. It was briefly collapsed to stop it pushing the
 * newest released entry off the fold, but the space it was competing for belonged to the version note above,
 * not to the draft — that note now runs to one line and there is room for both.
 *
 * Still COLLAPSIBLE, since the draft grows a bullet at a time and a long one should not be a wall the reader
 * has to scroll past to reach released history. WHEN IT GETS THERE, flip the initial state to false — collapse
 * the whole card, do NOT truncate to a few teaser lines. The bullets are heterogeneous (additions, renames, a
 * split, matrix rework), so a first slice hides whole categories of change rather than sampling them, it costs
 * the same one click as a collapse, and a list clipped mid-bullet reads as a layout bug rather than a summary.
 */
function DraftEntry({ draft }) {
  const [expanded, setExpanded] = useState(true);
  const panelId = useId();

  return (
    <div className="mb-5 rounded-lg border border-dashed border-amber-500/50 bg-amber-50/60">
      {/* The whole row is the trigger, not just the chevron: it is a wide target for a small glyph, and the
          version and badge are what a reader reaches for anyway. */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full cursor-pointer items-baseline gap-2 rounded-lg px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <span className="text-sm font-bold text-amber-900">v{draft.version}</span>
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-700 uppercase">Draft</span>
        <span className="text-xs font-medium text-amber-600">In progress</span>
        {/* `ml-auto` pins the caret right while the label group stays left. `self-center` because the row is
            baseline-aligned for the text, which would otherwise hang the glyph off the same baseline. */}
        <ChevronDown
          className={cn("ml-auto size-4 shrink-0 self-center text-amber-600 transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>
      {expanded ? (
        // `pt-0` so expanding does not double the gap the button's own padding already set.
        <div id={panelId} className="px-3 pt-0 pb-2.5">
          {/* A step down from the released entries' 13px: the draft is provisional, so it should not read
              as loudly as the history below it. `text-xs` is the size the dates already use. */}
          <ChangeList changes={draft.changes} className="text-xs text-amber-900/80" bulletClassName="bg-amber-500/60" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The Theory tab's changelog: version + date + change bullets, newest first, from {@link CHANGELOG}, with
 * {@link CHANGELOG_DRAFT} above it as an unreleased card when one is in flight.
 *
 * Everything that makes it a dialog — portal, scrim, Escape, focus, scroll lock, the header and its ✕,
 * the scrolling body — comes from {@link FullModal}. This file is the list and nothing else. It used to
 * hand-roll all of that, which is how it ended up with its own copy of a body-scroll-lock bug.
 */
export function ChangelogModal({ open, onClose }) {
  return (
    <FullModal open={open} onClose={onClose} title="Changelog" titleId="changelog-modal-title" closeLabel="Close changelog">
      {/* Reads the version numbers below for you, so it sits at the top of the scroll port rather than in the
          pinned header: the header is a title-plus-✕ strip, and a note there would never scroll away.

          KEPT TO ONE LINE ON PURPOSE. It teaches a thing a reader needs once, ever, then pays rent at the top
          of every visit — as a four-line block it outweighed the entries it exists to explain and pushed the
          newest released version off the fold. The entries below demonstrate the distinction anyway; this only
          has to name it. `text-xs` is the size the entry dates use, so the note reads as an aside. */}
      <div className="mb-4 flex items-center gap-2 text-xs leading-snug text-slate-500">
        <Info className="size-3.5 shrink-0 text-slate-400" aria-hidden />
        <p>
          <span className="font-semibold text-slate-600">Major</span> versions change the structure.{" "}
          <span className="font-semibold text-slate-600">Minor</span> versions refine the content.
        </p>
      </div>
      {CHANGELOG_DRAFT ? <DraftEntry draft={CHANGELOG_DRAFT} /> : null}

      <ol className="flex flex-col gap-5">
        {CHANGELOG.map((entry) => (
          <li key={entry.version} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-slate-900">v{entry.version}</span>
              <span className="text-xs font-medium text-slate-400">{entry.date}</span>
            </div>
            <ChangeList changes={entry.changes} />
          </li>
        ))}
      </ol>
    </FullModal>
  );
}
