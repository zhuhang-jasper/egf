import { useEffect, useState } from "react";

import { Calculator, CircleCheck, FilePlus, Pencil, Save } from "lucide-react";

import { BackupReminderDialog } from "@/components/BackupReminderDialog";
import { ProfileActionsMenu } from "@/components/ProfileActionsMenu";
import { ProfileByline } from "@/components/ProfileByline";
import { ProfileCombobox } from "@/components/ProfileCombobox";
import { SaveButton } from "@/components/SaveButton";
import { SaveCollisionDialog } from "@/components/SaveCollisionDialog";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/Tooltip";
import { UnreviewedWarningsDialog } from "@/components/UnreviewedWarningsDialog";

import { useTouchPrimary } from "@/hooks/useTouchPrimary";

import {
  PROFILE_SAVE_TOAST_KEY,
  selectDraftValuesMatchLink,
  selectHasUnsavedWork,
  selectProfileSaveStatus,
  TOAST_DURATION,
  UNDO_TOAST_KEY,
  useAppStore,
} from "@/store/useAppStore";

import { FRAMEWORK_VERSION } from "@/constants/changelog";
import { fillPillarLevels } from "@/constants/levels";
import { CONTROL_TEXT } from "@/styles/control-typography";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { isStaleProfile, untouchedFlaggedPillars } from "@/utils/profile-stamp-state";
import { buildSaveMessage } from "@/utils/save-message";
import { readProfileCreateCount } from "@/utils/storage";

// The Save button doubles as the save-status indicator. Each status sets the button's icon, label,
// styling, and disabled state. `saved` means the draft matches a saved profile (nothing to save);
// `renaming` means the linked profile's title was changed, so saving renames it in place;
// `modified` means the linked profile's badge/levels changed but the title still matches, so saving
// overwrites it. For linked statuses the caret offers a copy action ("Save new" while renaming,
// else "Save as copy") plus "Undo rename" while renaming. `new` means saving creates a new profile.
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
  // A rename that also changed badge/levels. Not a real store status — the toolbar picks it when `renaming`
  // is accompanied by edits (see renameWithEdits), because "Rename" alone understates what the save does.
  applying: {
    icon: Save,
    label: "Apply",
    title: "Renamed and modified — saving applies both to the linked profile",
    className: "border-amber-500/50 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800",
    disabled: false,
  },
};

export function TitleToolbar() {
  const setTitle = useAppStore((s) => s.setTitle);
  const saveProfile = useAppStore((s) => s.saveProfile);
  const saveAsNew = useAppStore((s) => s.saveAsNew);
  const duplicateDraft = useAppStore((s) => s.duplicateDraft);
  const loadProfile = useAppStore((s) => s.loadProfile);
  const activeSavedProfileId = useAppStore((s) => s.activeSavedProfileId);
  const saveOverwriting = useAppStore((s) => s.saveOverwriting);
  const restampProfile = useAppStore((s) => s.restampProfile);
  const profiles = useAppStore((s) => s.profiles);
  const restoreProfiles = useAppStore((s) => s.restoreProfiles);
  const showToast = useAppStore((s) => s.showToast);
  const saveFeedback = useAppStore((s) => s.saveFeedback);
  const clearSaveFeedback = useAppStore((s) => s.clearSaveFeedback);
  const createNew = useAppStore((s) => s.createNew);
  const showDraftDiscardedToast = useAppStore((s) => s.showDraftDiscardedToast);
  const levelKeyboardInputEnabled = useAppStore((s) => s.levelKeyboardInputEnabled);
  const toggleLevelKeyboardInputEnabled = useAppStore((s) => s.toggleLevelKeyboardInputEnabled);
  const touchPrimary = useTouchPrimary();

  // The switch itself is the only feedback for a setting whose effect isn't visible until the next
  // level-input tap, so confirm the new state in a toast. Keyed so rapid toggles replace in place.
  const handleToggleKeypad = () => {
    toggleLevelKeyboardInputEnabled();
    showToast(useAppStore.getState().levelKeyboardInputEnabled ? "Tap a number to type it in" : "Use the − and + buttons to change a number", {
      key: "keypad-toggle",
      // `long` because this one teaches rather than confirms: it is a full sentence that has to be read,
      // not a couple of words to be recognised. Still short of an Undo — there's nothing to act on.
      duration: TOAST_DURATION.long,
    });
  };

  const saveStatus = useAppStore(selectProfileSaveStatus); // "saved" | "renaming" | "modified" | "new"
  // A rename that ALSO changed badge/levels is neither a plain Rename nor a plain Update, so it gets its own
  // label and offers both undos. `renaming` covers both cases in the store; this is what splits them.
  // The selector runs on its own line, not behind a `&&`: short-circuiting it would call the hook only on
  // some renders.
  const draftValuesMatchLink = useAppStore(selectDraftValuesMatchLink);
  const renameWithEdits = saveStatus === "renaming" && !draftValuesMatchLink;
  const statusMeta = renameWithEdits ? SAVE_STATUS_META.applying : SAVE_STATUS_META[saveStatus];

  // Place the cursor in the name field so the user can type a name (Save as copy / New profile / Undo
  // rename). Skipped on touch — auto-focus there pops the on-screen keyboard unbidden. Touch users
  // tap the field to type. `select` also selects the current text (for a prefilled "Copy of …" name),
  // so the user can immediately overtype the whole thing.
  const focusNameInput = ({ select = false } = {}) => {
    if (touchPrimary) {
      return;
    }
    const el = document.getElementById("chart-title-input");
    el?.focus();
    if (select) {
      // Defer so the controlled input has rendered the prefilled name before we select it.
      requestAnimationFrame(() => document.getElementById("chart-title-input")?.select());
    }
  };

  // "Undo rename" (renaming) — restore just the title to the linked profile's saved name.
  const linkedTitle = useAppStore((s) => s.profiles.find((p) => p.id === s.activeSavedProfileId)?.title ?? null);
  const handleUndoRename = () => {
    setTitle(linkedTitle ?? "");
    focusNameInput();
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

  // The action held back by unreviewed pillar warnings, if any: the count, which wording to use, and the
  // thunk to run if the user confirms.
  const [pendingUnreviewed, setPendingUnreviewed] = useState(null);

  // Open when a save just CREATED the user's 1st, 10th, 20th … profile (the store flags it — see
  // writeProfile). Raised here rather than in the store because it is one more piece of save-result
  // routing, and this is where every save path already lands.
  const [backupReminderOpen, setBackupReminderOpen] = useState(false);

  const trackSaved = (extra) => track("profile_saved", { attached_badge: useAppStore.getState().attachedBadge, ...extra });

  // Route a writeProfile result: a collision opens the dialog; a real save fires analytics. Blank
  // title / normalize errors fall through silently (the input already flags the empty-title case).
  // `analytics` carries any flags (e.g. overwrite) onto the profile_saved event.
  //
  // Every successful save confirms itself in a toast; a destructive one (result.undo present — an
  // existing profile was overwritten and/or merged away) carries an "Undo" with it, so an accidental
  // Update/Rename/Overwrite is recoverable. See the notes at the toast itself.
  const handleResult = (result, analytics = {}) => {
    if (result?.status === "collision") {
      setPendingCollision({ ...result, analytics });
      return;
    }
    if (result?.status === "saved") {
      // `mode` comes from the store (created / updated / renamed) — the caller's flags only say how the
      // save was reached, so without it every path looks like the same event in GA. `profile_state` likewise:
      // the state before this write, readable only there.
      trackSaved({ ...analytics, mode: result.mode, profile_state: result.priorState });
      if (result.backupReminder) {
        setBackupReminderOpen(true);
        track("backup_reminder_shown", { count: readProfileCreateCount() });
      }
      // Only a DESTRUCTIVE save carries the Undo (an existing row was overwritten and/or a merged source
      // removed). A plain create has nothing to reverse, so it takes the short window instead of sitting
      // there for 8s offering an action it does not have.
      const savedMessage = buildSaveMessage(result, { renameWithEdits: analytics.renameWithEdits });
      if (result.undo) {
        showToast(savedMessage, {
          variant: "dark",
          key: UNDO_TOAST_KEY, // only one Undo toast at a time — replaces any live delete/discard/import undo
          action: {
            label: "Undo",
            onAction: () => {
              restoreProfiles(result.undo);
              track("profile_save_undone", { attached_badge: useAppStore.getState().attachedBadge });
            },
          },
        });
      } else {
        // DARK, MATCHING THE UNDO BRANCH ABOVE, though nothing here is undoable: a create and an update
        // are the same act to the user, and colouring them apart would say the app considers them
        // different kinds of event. Green is left to mean "finished, nothing further" — the clipboard
        // and file-export confirmations — which a save, being the start of a profile's life, is not.
        //
        // Keyed so a run of quick saves replaces in place rather than stacking. NOT the undo key: this
        // one has no action, and taking that slot would evict a live Undo the user might still want.
        showToast(savedMessage, { variant: "dark", key: PROFILE_SAVE_TOAST_KEY });
      }
    }
  };

  // The stamp is one field on the profile, so anything that advances it silences EVERY flagged pillar, not
  // just the ones edited. Gate in front of the action: run it only if there is nothing unreviewed, else open
  // the dialog and let its confirm run it. `restamp` only picks the dialog's wording.
  //
  // Only for a write that lands ON THE SOURCE. "Save new" and "Save as copy" create a separate row and leave
  // the source untouched, so its warnings survive the save and there is nothing to confirm.
  const guardUnreviewed = (proceed, { restamp = false } = {}) => {
    const { profiles: rows, activeSavedProfileId: activeId, pillarLevels: levels } = useAppStore.getState();
    const source = activeId != null ? (rows.find((p) => p.id === activeId) ?? null) : null;
    // `requireLevelChange` on the save path: a rename or badge switch carries the old stamp, so its warnings
    // survive and there is nothing to confirm. The restamp button advances the stamp on its own.
    const count = source != null ? untouchedFlaggedPillars(source, fillPillarLevels(levels), { requireLevelChange: !restamp }) : 0;
    if (count > 0) {
      setPendingUnreviewed({ count, restamp, proceed });
      return;
    }
    proceed();
  };

  const handleSave = () => guardUnreviewed(() => handleResult(saveProfile(), { renameWithEdits }));

  // "Save new" (while renaming): the name already differs, so save a copy under it immediately.
  const handleSaveAsNew = () => handleResult(saveAsNew(), { copy: true });

  // "Save as copy" (name still matches the source): detach into a new unsaved draft (same badge +
  // levels) with the name prefilled "Copy of <source>", then focus + select it (desktop) so the user
  // can overtype a name before saving.
  const handleDuplicate = () => {
    duplicateDraft();
    track("profile_duplicated", { attached_badge: useAppStore.getState().attachedBadge });
    focusNameInput({ select: true });
  };

  // The copy action's label + handler depend on whether the name already differs from the source.
  // "Save as copy" prefills "Copy of <source>" and detaches so the user can rename before saving.
  const copyAction =
    saveStatus === "renaming" ? { label: "Save new", onSelect: handleSaveAsNew } : { label: "Save as copy", onSelect: handleDuplicate };

  // Reverts the draft to the linked profile. Both entries when a rename carries edits, so either half can go
  // without undoing the other first.
  const UNDO_ACTIONS = {
    renaming: [{ label: "Undo rename", onSelect: handleUndoRename }],
    modified: [{ label: "Undo changes", onSelect: handleUndoChanges }],
  };
  const undoActions = renameWithEdits
    ? [
        { label: "Undo rename", onSelect: handleUndoRename },
        { label: "Undo changes", onSelect: handleUndoChanges },
      ]
    : (UNDO_ACTIONS[saveStatus] ?? []);

  // Clears the flags on a saved profile whose levels the user re-read and kept. ONLY at status "saved": with
  // a dirty draft the ordinary Save is the right action, and restamping mid-edit would clear flags against
  // numbers that aren't stored yet.
  const activeProfile = profiles.find((p) => p.id === activeSavedProfileId) ?? null;
  const canRestamp = saveStatus === "saved" && activeProfile != null && isStaleProfile(activeProfile);

  const handleRestamp = () => guardUnreviewed(() => doRestamp(), { restamp: true });

  const doRestamp = () => {
    const result = restampProfile();
    if (result?.status !== "restamped") {
      return;
    }
    track("profile_restamped");
    // Undoable: the only visible change is the warnings vanishing, so a mis-click would be silent otherwise.
    showToast(`Marked as rated using Framework v${FRAMEWORK_VERSION}`, {
      variant: "dark",
      key: UNDO_TOAST_KEY,
      action: {
        label: "Undo",
        onAction: () => {
          restoreProfiles(result.undo);
          track("profile_restamped_undone");
        },
      },
    });
  };

  // "New profile" — start a fresh blank draft, wiping the current one. Offer an Undo only when the
  // draft had genuine unsaved work (selectHasUnsavedWork): a clean loaded profile or an already-blank
  // draft loses nothing, so no toast. Routes through the shared "draft discarded" toast so New profile
  // and profile-load behave identically — one coalescing Undo toast (a newer discard replaces the
  // older), recovering the most recent discarded draft.
  const handleNewProfile = () => {
    // Check for unsaved work BEFORE createNew() blanks the draft. Same selector load uses, so both agree.
    const hadUnsavedWork = selectHasUnsavedWork(useAppStore.getState());
    const { undo } = createNew();
    focusNameInput();
    if (hadUnsavedWork) {
      showDraftDiscardedToast(undo, () => track("new_profile_undone"));
    }
  };

  // Runs the thunk the gate held back — the original path, so a Rename stays a rename and can still collide.
  const handleConfirmUnreviewed = () => {
    const { proceed, count } = pendingUnreviewed;
    setPendingUnreviewed(null);
    track("unreviewed_warnings_confirmed", { count });
    proceed();
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
          undoActions={undoActions}
          restampAction={canRestamp ? { label: `Mark as rated using v${FRAMEWORK_VERSION}`, onSelect: () => handleRestamp() } : null}
        />
      </div>
      {/* Row 2 — New profile + keypad toggle (touch only) on the left, the "Manage" profile-actions
          menu (import / export / delete all) on the right.
          "New profile" starts a fresh blank draft: it clears the title, the badge, resets every
          pillar to the default, and unlinks any loaded profile.

          `print:hidden` on THE WHOLE ROW rather than per control, because every single thing in it is
          an action — there is no content here to keep in a read-only render. */}
      <div className="flex w-full items-center gap-2 print:hidden">
        <Button
          type="button"
          variant="outline"
          shape="pill"
          className="shrink-0 gap-1.5"
          onClick={handleNewProfile}
          aria-label="New profile — clear the name, badge and all levels to start fresh"
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
            onClick={handleToggleKeypad}
            className={cn(
              "group relative inline-flex h-[26.5px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 bg-white px-1.5 font-semibold tracking-wide text-slate-600 hover:bg-slate-50 hover:text-slate-800",
              CONTROL_TEXT,
            )}
          >
            <Calculator className="size-3.5 shrink-0" aria-hidden />
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
            <Tooltip text="Keypad — numeric keyboard for level inputs" />
          </button>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          <ProfileActionsMenu />
        </div>
      </div>
      {/* Row 3 — provenance for the loaded profile. Content, not chrome, so it is NOT `print:hidden`:
          a printed chart should carry which framework revision it was rated against. Renders nothing
          when no profile is loaded, so it costs no vertical space on a fresh draft. */}
      <ProfileByline />
      <UnreviewedWarningsDialog
        count={pendingUnreviewed?.count ?? 0}
        restamp={pendingUnreviewed?.restamp ?? false}
        onConfirm={handleConfirmUnreviewed}
        onCancel={() => {
          track("unreviewed_warnings_cancelled", { count: pendingUnreviewed?.count });
          setPendingUnreviewed(null);
        }}
      />
      <SaveCollisionDialog collision={pendingCollision} onOverwrite={handleOverwrite} onCancel={() => setPendingCollision(null)} />
      <BackupReminderDialog open={backupReminderOpen} onClose={() => setBackupReminderOpen(false)} />
    </div>
  );
}
