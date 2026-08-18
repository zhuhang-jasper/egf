import { Info } from "lucide-react";

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
          pinned header: the header is a title-plus-✕ strip, and a note there would never scroll away. */}
      <div className="mb-5 flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] leading-snug text-slate-600">
        <Info className="mt-px size-4 shrink-0 text-slate-400" aria-hidden />
        <p>Major versions change the framework's structure. Minor versions refine the content, so how you use the framework stays the same.</p>
      </div>
      {/* The draft sits OUTSIDE the <ol>, not as its first <li>, because it is not part of the released
          history the list enumerates: it has no date, no version stamp on the tab, and raises no unseen dot.
          A dashed amber card says provisional without competing with the entries below it. */}
      {CHANGELOG_DRAFT ? (
        <div className="mb-5 flex flex-col gap-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-50/60 px-3 py-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-amber-900">v{CHANGELOG_DRAFT.version}</span>
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-700 uppercase">Draft</span>
            <span className="text-xs font-medium text-amber-600">Not published yet</span>
          </div>
          {/* A step down from the released entries' 13px: the draft is provisional, so it should not read
              as loudly as the history below it. `text-xs` is the size the dates already use. */}
          <ChangeList changes={CHANGELOG_DRAFT.changes} className="text-xs text-amber-900/80" bulletClassName="bg-amber-500/60" />
        </div>
      ) : null}

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
