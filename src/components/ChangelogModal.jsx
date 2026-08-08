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
