import { Info } from "lucide-react";

import { FullModal } from "@/components/ui/Modal";

import { CHANGELOG } from "@/constants";
import { cn } from "@/utils";

/**
 * The Theory tab's changelog: version + date + change bullets, newest first, from {@link CHANGELOG}.
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
      <ol className="flex flex-col gap-5">
        {CHANGELOG.map((entry) => (
          <li key={entry.version} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-slate-900">v{entry.version}</span>
              <span className="text-xs font-medium text-slate-400">{entry.date}</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {entry.changes.map((change, index) => (
                <li key={index} className={cn("flex gap-2 text-[13px] leading-snug text-slate-700")}>
                  <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </FullModal>
  );
}
