import { useRef, useState } from "react";

import { BadgeCheck, Copy, MoreVertical, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MenuItem } from "@/components/ui/menu-item";
import { MenuPanel } from "@/components/ui/menu-panel";

import { useMenuPosition } from "@/hooks/useMenuPosition";

import { cn } from "@/utils";

// Status-aware Save button, sitting on Row 1 next to the title input.
//
// For a linked profile (`showMenu` — status "saved", "renaming" or "modified") it becomes a split
// button: the primary action Saves/Renames/Updates the linked profile (disabled when already
// saved), while a caret opens a menu with the copy action (`copyAction` — "Save new" while renaming
// saves a copy under the changed name, else "Save as copy" detaches with a "Copy of …" name), an optional
// `restampAction` ("Mark as rated using v<current>" — only for a clean, flagged profile), and an optional undo
// action list (`undoActions` — "Undo rename" while renaming, "Undo changes" while modified, BOTH when a
// rename also carries edits) that reverts the draft to the linked profile. For an unlinked draft ("new") it
// renders as a plain single button.
export function SaveButton({ statusMeta, showMenu, onSave, copyAction, undoActions = [], restampAction }) {
  const StatusIcon = statusMeta.icon;
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Either optional item appearing/disappearing changes the panel's height, so both drive a re-measure.
  const { openUp } = useMenuPosition({
    open: menuOpen,
    onClose: () => setMenuOpen(false),
    rootRef,
    menuRef,
    remeasureKey: `${undoActions.length}|${Boolean(restampAction)}`,
  });

  // The label sizes to its own text — the row is allowed to shift as the status changes so the
  // control stays as narrow as possible, leaving more room for the title input.
  const primaryLabel = <span className="whitespace-nowrap">{statusMeta.label}</span>;

  // `print:hidden` on both branches below — saving is an action, and the status it reports ("Saved",
  // "Modified") describes the draft's relationship to localStorage, which means nothing on paper.
  // Plain single button — an unlinked draft has nothing to duplicate or rename.
  if (!showMenu) {
    return (
      <Button
        type="button"
        variant="outline"
        shape="pill"
        disabled={statusMeta.disabled}
        className={cn("shrink-0 gap-1 px-2.5 print:hidden", statusMeta.className)}
        onClick={onSave}
        aria-label={statusMeta.title}
        title={statusMeta.title}
      >
        <StatusIcon className="h-4 w-4 shrink-0" aria-hidden />
        {primaryLabel}
      </Button>
    );
  }

  return (
    <div ref={rootRef} className="relative flex shrink-0 print:hidden">
      {/* Primary Save/Update — pill flattened on its right edge to butt against the caret. Tighter
          right padding since the divider (not empty space) closes off this side. */}
      <Button
        type="button"
        variant="outline"
        shape="pill"
        disabled={statusMeta.disabled}
        className={cn("gap-1 rounded-r-none pl-2.5 pr-2", statusMeta.className)}
        onClick={onSave}
        aria-label={statusMeta.title}
        title={statusMeta.title}
      >
        <StatusIcon className="h-4 w-4 shrink-0" aria-hidden />
        {primaryLabel}
      </Button>
      {/* Caret — opens the copy / Undo-rename menu. Kept enabled even when the primary is disabled
          ("saved"), since forking an already-saved profile is still useful. */}
      <Button
        type="button"
        variant="outline"
        shape="pill"
        aria-label="More save options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={cn("-ml-px min-w-9 justify-center rounded-l-none px-2", statusMeta.className)}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <MoreVertical className="h-4 w-4 shrink-0" aria-hidden />
      </Button>
      {menuOpen && (
        <MenuPanel ref={menuRef} openUp={openUp} align="right" role="menu" aria-label="Save options" className="min-w-[100px]">
          <MenuItem
            icon={Copy}
            onClick={() => {
              setMenuOpen(false);
              copyAction.onSelect();
            }}
          >
            {copyAction.label}
          </MenuItem>
          {/* Present only when there are flags to clear, so it never reads as an action with no effect. Above
              the undo divider because it acts on the SAVED profile, not the draft. */}
          {restampAction ? (
            <MenuItem
              icon={BadgeCheck}
              onClick={() => {
                setMenuOpen(false);
                restampAction.onSelect();
              }}
            >
              {restampAction.label}
            </MenuItem>
          ) : null}
          {/* Reverts the draft to the linked profile. Empty when there's nothing to revert (e.g. "saved");
              two entries when a rename also carries edits, so either half can go independently. Only the
              first is `divided` — a rule between the two undos would read as separate groups. */}
          {undoActions.map((action, i) => (
            <MenuItem
              key={action.label}
              icon={Undo2}
              divided={i === 0}
              onClick={() => {
                setMenuOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </MenuItem>
          ))}
        </MenuPanel>
      )}
    </div>
  );
}

