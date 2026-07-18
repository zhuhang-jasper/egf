import { useEffect, useRef, useState } from "react";

import { ChevronDown, CircleCheck, Copy, Keyboard, Pencil, RotateCcw, Save, Undo2, X } from "lucide-react";

import { BadgePicker } from "@/components/BadgePicker";
import { ProfileActionsMenu } from "@/components/ProfileActionsMenu";
import { ProfilePicker } from "@/components/ProfilePicker";
import { SaveCollisionDialog } from "@/components/SaveCollisionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

// Longest button label — used as an invisible sizer so the Save button reserves a stable width and
// the title input never shifts as the status changes. Derived so it stays correct if edited.
const WIDEST_STATUS_LABEL = Object.values(SAVE_STATUS_META).reduce((a, b) => (b.label.length > a.length ? b.label : a), "");

// Status-aware Save button, sitting on Row 1 next to the title input. Extracted so the invisible
// widest-label sizer (which keeps the row from shifting as the status label changes) lives in one
// place.
//
// For a linked profile (`showMenu` — status "saved", "renaming" or "modified") it becomes a split
// button: the primary action Saves/Renames/Updates the linked profile (disabled when already
// saved), while a caret opens a menu with the copy action (`copyAction` — "Save new" while renaming
// saves a copy under the changed name, else "Save as…" detaches to be renamed) and, while renaming,
// "Undo rename". For an unlinked draft ("new") it renders as a plain single button.
function SaveButton({ statusMeta, showMenu, onSave, copyAction, onUndoRename }) {
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

  // The primary action's visible label, width-locked to the widest status so the row never shifts.
  const primaryLabel = (
    <span className="relative inline-grid">
      <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
        {WIDEST_STATUS_LABEL}
      </span>
      <span className="col-start-1 row-start-1 text-left">{statusMeta.label}</span>
    </span>
  );

  // Plain single button — an unlinked draft has nothing to duplicate or rename.
  if (!showMenu) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        shape="pill"
        disabled={statusMeta.disabled}
        className={cn("shrink-0 gap-1.5", statusMeta.className)}
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
      {/* Primary Save/Update — pill flattened on its right edge to butt against the caret. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        shape="pill"
        disabled={statusMeta.disabled}
        className={cn("gap-1.5 rounded-r-none", statusMeta.className)}
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
        className={cn("-ml-px rounded-l-none px-1.5", statusMeta.className)}
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
          {/* Only offered while renaming — reverts the title to the linked profile's saved name. */}
          {onUndoRename ? (
            <button
              type="button"
              role="menuitem"
              className="flex cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-foreground hover:bg-muted/60"
              onClick={() => {
                setMenuOpen(false);
                onUndoRename();
              }}
            >
              <Undo2 className="h-4 w-4 shrink-0" aria-hidden />
              Undo rename
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function TitleToolbar() {
  const title = useAppStore((s) => s.title);
  const setTitle = useAppStore((s) => s.setTitle);
  const saveProfile = useAppStore((s) => s.saveProfile);
  const saveAsNew = useAppStore((s) => s.saveAsNew);
  const duplicateDraft = useAppStore((s) => s.duplicateDraft);
  const saveOverwriting = useAppStore((s) => s.saveOverwriting);
  const saveFeedback = useAppStore((s) => s.saveFeedback);
  const clearSaveFeedback = useAppStore((s) => s.clearSaveFeedback);
  const createNew = useAppStore((s) => s.createNew);
  const levelKeyboardInputEnabled = useAppStore((s) => s.levelKeyboardInputEnabled);
  const toggleLevelKeyboardInputEnabled = useAppStore((s) => s.toggleLevelKeyboardInputEnabled);
  const touchPrimary = useTouchPrimary();
  const saveStatus = useAppStore(selectProfileSaveStatus); // "saved" | "renaming" | "modified" | "new"
  const statusMeta = SAVE_STATUS_META[saveStatus];

  // The linked profile's saved title, used to offer "Undo rename" while renaming.
  const linkedTitle = useAppStore((s) => s.profiles.find((p) => p.id === s.activeSavedProfileId)?.title ?? null);
  const handleUndoRename = () => {
    setTitle(linkedTitle ?? "");
    document.getElementById("chart-title-input")?.focus();
  };

  // The pending name+badge collision from a save attempt, if any. While set, the confirm dialog is
  // open; it carries the blocked attempt's analytics so they survive to the resolution.
  const [pendingCollision, setPendingCollision] = useState(null);

  const trackSaved = (extra) => track("profile_saved", { attached_badge: useAppStore.getState().attachedBadge, ...extra });

  // Route a writeProfile result: a collision opens the dialog; a real save fires analytics. Blank
  // title / normalize errors fall through silently (the input already flags the empty-title case).
  // `analytics` carries any flags (e.g. overwrite) onto the profile_saved event.
  const handleResult = (result, analytics = {}) => {
    if (result?.status === "collision") {
      setPendingCollision({ ...result, analytics });
      return;
    }
    if (result?.status === "saved") {
      trackSaved(analytics);
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
  const copyAction =
    saveStatus === "renaming" ? { label: "Save new", onSelect: handleSaveAsNew } : { label: "Save as…", onSelect: handleDuplicate };

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
  const showClear = title.length > 0;

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Row 1 — title + Save (Save lives here permanently now that New/Reset merged into Row 2). */}
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <BadgePicker />
          <Input
            id="chart-title-input"
            value={title}
            placeholder="Enter a name"
            aria-invalid={titleError}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const trimmed = title.trim();
              if (trimmed !== title) {
                setTitle(trimmed);
              }
            }}
            className={cn("pl-16 pr-9 shadow-none", titleError && "border-red-500 focus-visible:ring-red-500/40")}
          />
          <button
            type="button"
            aria-label="Clear chart title"
            title="Clear title"
            hidden={!showClear}
            onClick={() => {
              setTitle("");
              document.getElementById("chart-title-input")?.focus();
            }}
            className={cn(
              "absolute right-0 top-0 flex h-full w-7 items-center justify-center text-muted-foreground hover:text-foreground",
              !showClear && "pointer-events-none opacity-0",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SaveButton
          statusMeta={statusMeta}
          showMenu={saveStatus === "saved" || saveStatus === "renaming" || saveStatus === "modified"}
          onSave={handleSave}
          copyAction={copyAction}
          onUndoRename={saveStatus === "renaming" ? handleUndoRename : undefined}
        />
      </div>
      {/* Row 2 — reset + keypad toggle (touch only) on the left, Profiles on the right. Reset
          doubles as "start over": it clears the title, the badge, and resets every pillar to
          the default. */}
      <div className="flex w-full items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          shape="pill"
          className="shrink-0 gap-1.5"
          onClick={() => {
            createNew();
            document.getElementById("chart-title-input")?.focus();
          }}
          aria-label="Reset — clear the title and reset all levels"
          title="Reset — clear the title and reset all levels"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        {/* Keypad toggle is touch-only — the numeric keyboard switch is meaningless with a
            physical keyboard, so it renders only when touch is the primary input. */}
        {touchPrimary ? (
          <button
            type="button"
            role="switch"
            aria-checked={levelKeyboardInputEnabled}
            onClick={toggleLevelKeyboardInputEnabled}
            className="group inline-flex h-[26.5px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 bg-white pl-2.5 pr-1.5 text-xs font-semibold tracking-wide text-slate-600 hover:bg-slate-50 hover:text-slate-800"
          >
            <Keyboard className="size-3.5 shrink-0" aria-hidden />
            Keypad
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
          <ProfilePicker />
          <ProfileActionsMenu />
        </div>
      </div>
      <SaveCollisionDialog collision={pendingCollision} onOverwrite={handleOverwrite} onCancel={() => setPendingCollision(null)} />
    </div>
  );
}
