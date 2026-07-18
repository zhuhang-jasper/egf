import { useEffect, useRef, useState } from "react";

import { ChevronDown, CircleCheck, Copy, FilePlus, Keyboard, Pencil, Save, Undo2 } from "lucide-react";

import { ProfileActionsMenu } from "@/components/ProfileActionsMenu";
import { ProfileCombobox } from "@/components/ProfileCombobox";
import { SaveCollisionDialog } from "@/components/SaveCollisionDialog";
import { Button } from "@/components/ui/button";

import { useTouchPrimary } from "@/hooks/useTouchPrimary";

import { selectProfileSaveStatus, useAppStore } from "@/store/useAppStore";

import { cn } from "@/utils";
import { track } from "@/utils/analytics";

// The Save button doubles as the save-status indicator. Each status sets the button's icon, label,
// styling, and disabled state. `saved` means the draft matches a saved profile (nothing to save);
// `renaming` means the linked profile's title was changed, so saving renames it in place;
// `modified` means the linked profile's badge/levels changed but the title still matches, so saving
// overwrites it. For linked statuses the caret offers a copy action ("Save new" while renaming,
// else "Save as…") plus "Undo rename" while renaming. `new` means saving creates a new profile.
const SAVE_STATUS_META = {
  saved: {
    icon: CircleCheck,
    label: "Saved",
    title: "Saved — matches a saved profile",
    className: "border-green-600/40 bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700 disabled:opacity-100",
    disabled: true,
  },
  renaming: {
    icon: Pencil,
    label: "Rename",
    title: "Rename — saving renames the linked profile in place",
    className: "border-amber-500/50 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800",
    disabled: false,
  },
  modified: {
    icon: Save,
    label: "Update",
    title: "Modified — saving overwrites the linked profile",
    className: "border-amber-500/50 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800",
    disabled: false,
  },
  new: {
    icon: Save,
    label: "Save",
    title: "Unsaved — saving will create a new profile",
    className: "",
    disabled: false,
  },
};

// Status-aware Save button, sitting on Row 1 next to the title input.
//
// For a linked profile (`showMenu` — status "saved", "renaming" or "modified") it becomes a split
// button: the primary action Saves/Renames/Updates the linked profile (disabled when already
// saved), while a caret opens a menu with the copy action (`copyAction` — "Save new" while renaming
// saves a copy under the changed name, else "Save as…" detaches to be renamed) and an optional undo
// action (`undoAction` — "Undo rename" while renaming, "Undo changes" while modified) that reverts
// the draft to the linked profile. For an unlinked draft ("new") it renders as a plain single button.
function SaveButton({ statusMeta, showMenu, onSave, copyAction, undoAction }) {
  const StatusIcon = statusMeta.icon;
  const rootRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    const onMouse = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouse);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouse);
    };
  }, [menuOpen]);

  // The label sizes to its own text — the row is allowed to shift as the status changes so the
  // control stays as narrow as possible, leaving more room for the title input.
  const primaryLabel = <span className="whitespace-nowrap">{statusMeta.label}</span>;

  // Plain single button — an unlinked draft has nothing to duplicate or rename.
  if (!showMenu) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        shape="pill"
        disabled={statusMeta.disabled}
        className={cn("shrink-0 gap-1 px-2.5", statusMeta.className)}
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
    <div ref={rootRef} className="relative flex shrink-0">
      {/* Primary Save/Update — pill flattened on its right edge to butt against the caret. Tighter
          right padding since the divider (not empty space) closes off this side. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
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
        size="sm"
        shape="pill"
        aria-label="More save options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={cn("-ml-px rounded-l-none px-1", statusMeta.className)}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
      </Button>
      {menuOpen && (
        <div
          role="menu"
          aria-label="Save options"
          className="absolute right-0 top-[calc(100%+4px)] z-30 flex w-max min-w-[100px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted/60"
            onClick={() => {
              setMenuOpen(false);
              copyAction.onSelect();
            }}
          >
            <Copy className="h-4 w-4 shrink-0" aria-hidden />
            {copyAction.label}
          </button>
          {/* Reverts the draft to the linked profile — "Undo rename" (renaming) or "Undo changes"
              (modified). Absent when there's nothing to revert (e.g. "saved"). */}
          {undoAction ? (
            <button
              type="button"
              role="menuitem"
              className="flex cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-foreground hover:bg-muted/60"
              onClick={() => {
                setMenuOpen(false);
                undoAction.onSelect();
              }}
            >
              <Undo2 className="h-4 w-4 shrink-0" aria-hidden />
              {undoAction.label}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function TitleToolbar() {
  const setTitle = useAppStore((s) => s.setTitle);
  const saveProfile = useAppStore((s) => s.saveProfile);
  const saveAsNew = useAppStore((s) => s.saveAsNew);
  const duplicateDraft = useAppStore((s) => s.duplicateDraft);
  const loadProfile = useAppStore((s) => s.loadProfile);
  const activeSavedProfileId = useAppStore((s) => s.activeSavedProfileId);
  const saveOverwriting = useAppStore((s) => s.saveOverwriting);
  const restoreProfiles = useAppStore((s) => s.restoreProfiles);
  const showToast = useAppStore((s) => s.showToast);
  const saveFeedback = useAppStore((s) => s.saveFeedback);
  const clearSaveFeedback = useAppStore((s) => s.clearSaveFeedback);
  const createNew = useAppStore((s) => s.createNew);
  const showDraftDiscardedToast = useAppStore((s) => s.showDraftDiscardedToast);
  const levelKeyboardInputEnabled = useAppStore((s) => s.levelKeyboardInputEnabled);
  const toggleLevelKeyboardInputEnabled = useAppStore((s) => s.toggleLevelKeyboardInputEnabled);
  const touchPrimary = useTouchPrimary();
  const saveStatus = useAppStore(selectProfileSaveStatus); // "saved" | "renaming" | "modified" | "new"
  const statusMeta = SAVE_STATUS_META[saveStatus];

  // "Undo rename" (renaming) — restore just the title to the linked profile's saved name.
  const linkedTitle = useAppStore((s) => s.profiles.find((p) => p.id === s.activeSavedProfileId)?.title ?? null);
  const handleUndoRename = () => {
    setTitle(linkedTitle ?? "");
    document.getElementById("chart-title-input")?.focus();
  };

  // "Undo changes" (modified) — reload the linked profile, reverting the edited badge/levels to its
  // saved state (the title already matches, so reloading only restores the values).
  const handleUndoChanges = () => {
    if (activeSavedProfileId != null) {
      loadProfile(activeSavedProfileId);
    }
  };

  // The pending name+badge collision from a save attempt, if any. While set, the confirm dialog is
  // open; it carries the blocked attempt's analytics so they survive to the resolution.
  const [pendingCollision, setPendingCollision] = useState(null);

  const trackSaved = (extra) => track("profile_saved", { attached_badge: useAppStore.getState().attachedBadge, ...extra });

  // Route a writeProfile result: a collision opens the dialog; a real save fires analytics. Blank
  // title / normalize errors fall through silently (the input already flags the empty-title case).
  // `analytics` carries any flags (e.g. overwrite) onto the profile_saved event.
  //
  // A destructive save (result.undo present — an existing profile was overwritten and/or merged
  // away) shows an "Undo" toast so an accidental Update/Rename/Overwrite is recoverable.
  const handleResult = (result, analytics = {}) => {
    if (result?.status === "collision") {
      setPendingCollision({ ...result, analytics });
      return;
    }
    if (result?.status === "saved") {
      trackSaved(analytics);
      if (result.undo) {
        showToast(`Updated “${result.savedTitle}”`, {
          variant: "dark",
          duration: 10000,
          action: {
            label: "Undo",
            onAction: () => {
              restoreProfiles(result.undo);
              track("profile_save_undone", { attached_badge: useAppStore.getState().attachedBadge });
            },
          },
        });
      }
    }
  };

  const handleSave = () => handleResult(saveProfile());

  // "Save new" (while renaming): the name already differs, so save a copy under it immediately.
  const handleSaveAsNew = () => handleResult(saveAsNew(), { copy: true });

  // "Save as…" (name still matches the source): detach into a new unsaved draft (same badge +
  // levels, blank name) and focus the name field so the user names it before saving.
  const handleDuplicate = () => {
    duplicateDraft();
    track("profile_duplicated", { attached_badge: useAppStore.getState().attachedBadge });
    document.getElementById("chart-title-input")?.focus();
  };

  // The copy action's label + handler depend on whether the name already differs from the source.
  const copyAction = saveStatus === "renaming" ? { label: "Save new", onSelect: handleSaveAsNew } : { label: "Save as…", onSelect: handleDuplicate };

  // The undo action reverts the draft to the linked profile: title while renaming, values while
  // modified. No undo for "saved" (nothing changed) or "new" (no link).
  const UNDO_ACTIONS = {
    renaming: { label: "Undo rename", onSelect: handleUndoRename },
    modified: { label: "Undo changes", onSelect: handleUndoChanges },
  };
  const undoAction = UNDO_ACTIONS[saveStatus];

  // "New profile" — start a fresh blank draft, wiping the current one. Offer an Undo only when there
  // are genuinely unsaved edits to lose: an in-flight rename/update ("renaming"/"modified"), or an
  // unsaved draft with content ("new" + hadContent). A clean loaded profile ("saved") or an already
  // blank draft loses nothing, so no toast. Routes through the shared "draft discarded" toast so New
  // profile and profile-load behave identically — one coalescing Undo toast (a newer discard replaces
  // the older), recovering the most recent discarded draft.
  const handleNewProfile = () => {
    const wasEditing = saveStatus === "renaming" || saveStatus === "modified";
    const { undo, hadContent } = createNew();
    document.getElementById("chart-title-input")?.focus();
    if (wasEditing || (saveStatus === "new" && hadContent)) {
      showDraftDiscardedToast(undo, () => track("new_profile_undone"));
    }
  };

  // The collision dialog's "Overwrite it" carries the blocked attempt's analytics forward.
  const handleOverwrite = () => {
    const { id, analytics } = pendingCollision;
    setPendingCollision(null);
    handleResult(saveOverwriting(id), { ...analytics, overwrite: true });
  };

  // Auto-clear transient save feedback (e.g. the empty-title error border) after a short delay.
  useEffect(() => {
    if (!saveFeedback) {
      return undefined;
    }
    const t = setTimeout(clearSaveFeedback, 1400);
    return () => clearTimeout(t);
  }, [saveFeedback, clearSaveFeedback]);

  // A save attempt with no title flags the input with a red error border (auto-cleared above).
  const titleError = saveFeedback === "add-title";

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Row 1 — title + Save (Save lives here permanently now that New/Reset merged into Row 2). */}
      <div className="flex w-full min-w-0 items-center gap-2">
        <ProfileCombobox titleError={titleError} />
        <SaveButton
          statusMeta={statusMeta}
          showMenu={saveStatus === "saved" || saveStatus === "renaming" || saveStatus === "modified"}
          onSave={handleSave}
          copyAction={copyAction}
          undoAction={undoAction}
        />
      </div>
      {/* Row 2 — New profile + keypad toggle (touch only) on the left, the "Manage" profile-actions
          menu (import / export / delete all) on the right.
          "New profile" starts a fresh blank draft: it clears the title, the badge, resets every
          pillar to the default, and unlinks any loaded profile. */}
      <div className="flex w-full items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          shape="pill"
          className="shrink-0 gap-1.5"
          onClick={handleNewProfile}
          aria-label="New profile — clear the name, badge and all levels to start fresh"
          title="New profile — clear the name, badge and all levels to start fresh"
        >
          <FilePlus className="h-4 w-4" />
          New profile
        </Button>
        {/* Keypad toggle is touch-only — the numeric keyboard switch is meaningless with a physical
            keyboard, so it renders only when touch is the primary input. Icon + switch only (no text
            label) to keep this row from overflowing on narrow mobile widths. */}
        {touchPrimary ? (
          <button
            type="button"
            role="switch"
            aria-checked={levelKeyboardInputEnabled}
            aria-label="Keypad — numeric keyboard for level inputs"
            title="Keypad — numeric keyboard for level inputs"
            onClick={toggleLevelKeyboardInputEnabled}
            className="group inline-flex h-[26.5px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 bg-white px-1.5 text-xs font-semibold tracking-wide text-slate-600 hover:bg-slate-50 hover:text-slate-800"
          >
            <Keyboard className="size-3.5 shrink-0" aria-hidden />
            {/* Mini switch: black track when on, slate when off; knob slides right when on. */}
            <span
              aria-hidden
              className={cn(
                "relative ml-0.5 inline-flex h-4 w-7 shrink-0 rounded-full transition-colors",
                levelKeyboardInputEnabled ? "bg-slate-900" : "bg-slate-300 group-hover:bg-slate-400/70",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out",
                  levelKeyboardInputEnabled && "translate-x-3",
                )}
              />
            </span>
          </button>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          <ProfileActionsMenu />
        </div>
      </div>
      <SaveCollisionDialog collision={pendingCollision} onOverwrite={handleOverwrite} onCancel={() => setPendingCollision(null)} />
    </div>
  );
}
