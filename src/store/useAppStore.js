import { create } from "zustand";

import { getPillarIdByIndex, MAX_PROFILE_NAME_LENGTH, normalizeAttachedBadge } from "@/constants";
import {
  fillPillarLevels,
  getDefaultChartState,
  mergeViewIntoCanonical,
  newSavedProfileId,
  normalizeSavedState,
  parseToCanonicalState,
  syncLevelsArrayFromMap,
} from "@/constants/levels";
import { track } from "@/utils/analytics";
import { exportProfilesToFile, parseImportedProfiles } from "@/utils/profile-transfer";
import {
  bumpProfileCreateCount,
  getDefaultChartDisplay,
  isBackupReminderMilestone,
  loadDraftFromStorage,
  loadProfilesFromStorage,
  saveDraftToStorage,
  writeProfilesToStorage,
} from "@/utils/storage";

const initialDraft = loadDraftFromStorage() ?? { ...getDefaultChartState(), ...getDefaultChartDisplay() };
const initialProfiles = loadProfilesFromStorage();

// Monotonic id source for toasts (module-scoped so ids stay unique across the store's lifetime).
let toastSeq = 0;
// Per-toast auto-dismiss timers, so a coalescing toast can reset its own countdown.
const toastTimers = new Map();
// Shared by every undoable action so a newer one REPLACES the older: only one Undo toast is ever on
// screen, and a stale one must never sit beside the undo the user is actually looking for.
export const UNDO_TOAST_KEY = "undo";

// How long an undo toast stays up. Longer than the default toast duration — undoing is a decision,
// and the user needs time to notice the toast and react. The dismiss button's countdown ring
// animates over exactly this window (see src/components/ui/Toaster.jsx).
const UNDO_TOAST_DURATION = 8000;

// Accumulator for the batched single-delete Undo toast, reset when that toast is gone or replaced.
// `deleteBatchLive` is what the coalescing check keys off, since the shared key no longer implies a
// delete. `deleteBatchReloadRow` is the removed row that was LOADED at delete time (at most one), which
// Undo must reload because deleting the active profile blanks the draft.
let deleteBatch = [];
let deleteBatchReloadRow = null;
let deleteBatchLive = false;

// Drop the single-delete batch state. Called when the undo toast is dismissed, and whenever a
// non-delete undo action takes over the shared toast (so its Undo never re-inserts stale rows).
function resetDeleteBatch() {
  deleteBatch = [];
  deleteBatchReloadRow = null;
  deleteBatchLive = false;
}

/** Keep a restored link only if the referenced profile still exists — else the draft is unlinked. */
function validateActiveId(activeSavedProfileId, profiles) {
  return activeSavedProfileId != null && profiles.some((p) => p.id === activeSavedProfileId) ? activeSavedProfileId : null;
}

function withSyncedLevels(state) {
  const { levels } = syncLevelsArrayFromMap({
    pillarLevels: state.pillarLevels,
  });
  return { ...state, levels };
}

export const useAppStore = create((set, get) => ({
  title: initialDraft.title,
  pillarLevels: { ...initialDraft.pillarLevels },
  levels: [...initialDraft.levels],
  attachedBadge: normalizeAttachedBadge(initialDraft.attachedBadge),
  levelsPolygonHidden: initialDraft.levelsPolygonHidden,
  chartLevelTicksHidden: initialDraft.chartLevelTicksHidden,
  chartLegendHidden: initialDraft.chartLegendHidden,
  chartAttributionHidden: initialDraft.chartAttributionHidden,
  chartUhdExport: initialDraft.chartUhdExport === true,
  chartBadgeHidden: initialDraft.chartBadgeHidden,
  chartTitleHidden: initialDraft.chartTitleHidden,
  footerScoresHidden: initialDraft.footerScoresHidden,
  footerScoresHiddenUserSet: initialDraft.footerScoresHiddenUserSet === true,
  clusterLabelColors: initialDraft.clusterLabelColors === true,
  pillarEmojiHidden: initialDraft.pillarEmojiHidden === true,
  activeSavedProfileId: validateActiveId(initialDraft.activeSavedProfileId, initialProfiles),
  profiles: initialProfiles,
  saveFeedback: null,
  levelKeyboardInputEnabled: initialDraft.levelKeyboardInputEnabled === true,
  toasts: [],

  /**
   * Show a transient toast. `variant` is "default" | "success" | "error" | "dark". `action`, if
   * given, is `{ label, onAction }` and renders a button (e.g. "Undo") that fires `onAction` then
   * dismisses. `duration` ms until auto-dismiss (0 = sticky).
   *
   * `key` coalesces: a live toast with the same key has its content replaced and countdown reset in
   * place, rather than a second toast stacking (see {@link UNDO_TOAST_KEY}).
   *
   * `keepDeleteBatch` (internal) — only deleteProfileWithUndo passes true, to keep the running batch
   * alive while it coalesces; any other producer taking the toast ends the batch so its Undo cannot
   * re-insert stale rows. Returns the toast id (the existing one when coalescing).
   */
  showToast: (message, { variant = "default", duration = 2600, action = null, key = null, keepDeleteBatch = false } = {}) => {
    const text = String(message ?? "").trim();
    if (!text) {
      return null;
    }
    if (key === UNDO_TOAST_KEY && !keepDeleteBatch) {
      resetDeleteBatch();
    }
    const existing = key != null ? get().toasts.find((t) => t.key === key) : null;
    const id = existing ? existing.id : ++toastSeq;
    // `cycle` bumps every time a coalescing toast is refreshed, so the dismiss button's countdown
    // ring can key off it and restart its animation in lockstep with the re-armed timer below.
    const cycle = existing ? existing.cycle + 1 : 0;
    if (existing) {
      set((state) => ({ toasts: state.toasts.map((t) => (t.id === id ? { ...t, message: text, variant, action, key, duration, cycle } : t)) }));
    } else {
      set((state) => ({ toasts: [...state.toasts, { id, message: text, variant, action, key, duration, cycle }] }));
    }
    // (Re)arm the auto-dismiss timer — clearing any prior one so a coalesced toast restarts its clock.
    const prevTimer = toastTimers.get(id);
    if (prevTimer) {
      clearTimeout(prevTimer);
      toastTimers.delete(id);
    }
    if (duration > 0) {
      toastTimers.set(
        id,
        setTimeout(() => get().dismissToast(id), duration),
      );
    }
    return id;
  },

  dismissToast: (id) => {
    const timer = toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.delete(id);
    }
    // Once the undo toast is gone, drop any accumulated delete rows so the "gone" profiles aren't
    // held in memory. (Undo already clears the batch itself before dismissing.)
    if (get().toasts.find((t) => t.id === id)?.key === UNDO_TOAST_KEY) {
      resetDeleteBatch();
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  hydrate: () => {
    const draft = loadDraftFromStorage() ?? { ...getDefaultChartState(), ...getDefaultChartDisplay() };
    const profiles = loadProfilesFromStorage();
    set(
      withSyncedLevels({
        title: draft.title,
        pillarLevels: { ...draft.pillarLevels },
        attachedBadge: normalizeAttachedBadge(draft.attachedBadge),
        levelsPolygonHidden: draft.levelsPolygonHidden,
        chartLevelTicksHidden: draft.chartLevelTicksHidden,
        chartLegendHidden: draft.chartLegendHidden,
        chartAttributionHidden: draft.chartAttributionHidden,
        chartUhdExport: draft.chartUhdExport === true,
        chartBadgeHidden: draft.chartBadgeHidden,
        chartTitleHidden: draft.chartTitleHidden,
        footerScoresHidden: draft.footerScoresHidden,
        footerScoresHiddenUserSet: draft.footerScoresHiddenUserSet === true,
        levelKeyboardInputEnabled: draft.levelKeyboardInputEnabled === true,
        clusterLabelColors: draft.clusterLabelColors === true,
        pillarEmojiHidden: draft.pillarEmojiHidden === true,
      }),
    );
    set({ profiles, activeSavedProfileId: validateActiveId(draft.activeSavedProfileId, profiles) });
  },

  persistDraft: () => {
    saveDraftToStorage(get());
  },

  setAttachedBadge: (attachedBadge) => {
    set({ attachedBadge: normalizeAttachedBadge(attachedBadge) });
    get().persistDraft();
  },

  setTitle: (title) => {
    // Keeps `activeSavedProfileId` even when the title is edited, so a renamed draft reads as "renaming"
    // and Save can offer Rename vs. Save new. Use saveAsNew/duplicateDraft/createNew/Reset to detach.
    set({ title });
    get().persistDraft();
  },

  setLevel: (index, value) => {
    const pillarId = getPillarIdByIndex(index);
    if (!pillarId) {
      return;
    }
    const pillarLevels = fillPillarLevels({ ...get().pillarLevels, [pillarId]: value });
    const levels = [...get().levels];
    levels[index] = value;
    set({ pillarLevels, levels });
    get().persistDraft();
  },

  applyState: (state, { profileId = null } = {}) => {
    set(
      withSyncedLevels({
        title: state.title,
        pillarLevels: { ...state.pillarLevels },
        attachedBadge: normalizeAttachedBadge(state.attachedBadge),
        levelsPolygonHidden: get().levelsPolygonHidden,
        chartLevelTicksHidden: get().chartLevelTicksHidden,
        chartLegendHidden: get().chartLegendHidden,
        chartAttributionHidden: get().chartAttributionHidden,
        chartUhdExport: get().chartUhdExport,
        chartBadgeHidden: get().chartBadgeHidden,
        chartTitleHidden: get().chartTitleHidden,
        footerScoresHidden: get().footerScoresHidden,
        clusterLabelColors: get().clusterLabelColors,
        pillarEmojiHidden: get().pillarEmojiHidden,
      }),
    );
    set({ activeSavedProfileId: profileId });
    get().persistDraft();
  },

  setLevelsPolygonHidden: (hidden) => {
    set({ levelsPolygonHidden: hidden });
    get().persistDraft();
  },

  setChartLevelTicksHidden: (hidden) => {
    set({ chartLevelTicksHidden: hidden });
    get().persistDraft();
  },

  setChartLegendHidden: (hidden) => {
    set({ chartLegendHidden: hidden });
    get().persistDraft();
  },

  setChartAttributionHidden: (hidden) => {
    set({ chartAttributionHidden: hidden });
    get().persistDraft();
  },

  setChartUhdExport: (enabled) => {
    set({ chartUhdExport: enabled });
    get().persistDraft();
  },

  setChartBadgeHidden: (hidden) => {
    set({ chartBadgeHidden: hidden });
    get().persistDraft();
  },

  setChartTitleHidden: (hidden) => {
    set({ chartTitleHidden: hidden });
    get().persistDraft();
  },

  setClusterLabelColors: (enabled) => {
    set({ clusterLabelColors: enabled });
    get().persistDraft();
  },

  setPillarEmojiHidden: (hidden) => {
    set({ pillarEmojiHidden: hidden });
    get().persistDraft();
  },

  setFooterScoresHidden: (hidden) => {
    set({ footerScoresHidden: hidden, footerScoresHiddenUserSet: true });
    get().persistDraft();
  },

  setLevelKeyboardInputEnabled: (enabled) => {
    set({ levelKeyboardInputEnabled: enabled });
    get().persistDraft();
  },

  toggleLevelKeyboardInputEnabled: () => {
    set({ levelKeyboardInputEnabled: !get().levelKeyboardInputEnabled });
    get().persistDraft();
  },

  // Delete one profile. Returns the removed row (or null if the id was gone).
  removeProfile: (id) => {
    const existing = loadProfilesFromStorage();
    const target = existing.find((p) => p.id === id);
    if (!target) {
      return null;
    }
    const activeId = get().activeSavedProfileId;
    const next = existing.filter((p) => p.id !== id);
    writeProfilesToStorage(next);
    set({ profiles: next, activeSavedProfileId: activeId === id ? null : activeId });
    return target;
  },

  // (Re)render the batched-delete Undo toast from the current `deleteBatch`. Single deletes and "Delete
  // all" feed the same batch, so removals combine into one "Deleted N profiles" toast whose Undo reverses
  // all of them. Assumes the caller has populated the batch and set `deleteBatchLive`.
  showDeleteBatchToast: () => {
    const rows = deleteBatch; // capture for the Undo closure
    const reloadRow = deleteBatchReloadRow;
    const count = rows.length;
    if (count === 0) {
      return;
    }
    const message = count === 1 ? `Deleted “${rows[0].title}”` : `Deleted ${count} profiles`;
    get().showToast(message, {
      variant: "dark",
      duration: UNDO_TOAST_DURATION,
      key: UNDO_TOAST_KEY,
      keepDeleteBatch: true,
      action: {
        label: "Undo",
        onAction: () => {
          get().restoreDeletedProfiles(rows);
          // If the loaded profile was among the deleted, reload it so the draft is fully restored.
          if (reloadRow) {
            const state = normalizeSavedState(reloadRow);
            if (state) {
              get().applyState(state, { profileId: reloadRow.id });
            }
          }
          resetDeleteBatch();
          track("profiles_delete_undone", { count });
        },
      },
    });
  },

  // Delete one profile with a batched Undo toast: rapid deletes coalesce into the running batch and reset
  // its countdown, and the batch clears once the toast is gone so the next delete starts fresh.
  deleteProfileWithUndo: (id) => {
    // Was this the currently-loaded profile? If so the app resets to a blank draft after removal.
    const wasActive = get().activeSavedProfileId === id;
    const removed = get().removeProfile(id);
    if (!removed) {
      return;
    }
    // Deleting the loaded profile resets everything to a fresh blank draft (no name-field focus).
    if (wasActive) {
      get().resetDraftToBlank();
    }
    // Coalesce into the current batch only if the live undo toast is still a delete batch (a different
    // undo action — draft-discard, import, save — takes over the shared toast and ends the batch).
    if (deleteBatchLive) {
      deleteBatch = [...deleteBatch, removed];
    } else {
      deleteBatch = [removed];
      deleteBatchReloadRow = null; // fresh batch — clear any prior reload target
      deleteBatchLive = true;
    }
    // Remember the removed row that was loaded, so Undo reloads it (only one can be active).
    if (wasActive) {
      deleteBatchReloadRow = removed;
    }
    get().showDeleteBatchToast();
  },

  // Delete every saved profile, appended (deduped) into the running batch as one more delete, so a
  // preceding single delete and this combine into one toast whose Undo restores everything.
  clearAllProfiles: () => {
    const existing = loadProfilesFromStorage();
    const prev = get();
    // Is the currently-loaded profile still linked to a saved row that's about to be deleted?
    const linkedActive = validateActiveId(prev.activeSavedProfileId, existing) != null;

    // Continue the live batch, or start a fresh one for this wipe.
    if (!deleteBatchLive) {
      deleteBatch = [];
      deleteBatchReloadRow = null;
      deleteBatchLive = true;
    }
    // Append every wiped row not already in the batch (a preceding single delete already banked its row).
    const batchedIds = new Set(deleteBatch.map((r) => r.id));
    deleteBatch = [...deleteBatch, ...existing.filter((r) => !batchedIds.has(r.id))];
    // If the loaded profile is being wiped now, it's the row Undo should reload.
    if (linkedActive) {
      deleteBatchReloadRow = existing.find((r) => r.id === prev.activeSavedProfileId) ?? deleteBatchReloadRow;
    }

    writeProfilesToStorage([]);
    set({ profiles: [], activeSavedProfileId: null });
    if (linkedActive) {
      get().resetDraftToBlank();
    }
    get().showDeleteBatchToast();
    return { removed: deleteBatch.length };
  },

  /**
   * Export all saved profiles to a JSON file. Async: on browsers with the File System Access API
   * this resolves only after the file is written (or the user cancels). Returns
   * `{ count, outcome }` where outcome is "saved" | "cancelled" | "started" | "empty" | "error".
   */
  exportProfiles: async () => {
    const profiles = loadProfilesFromStorage();
    if (profiles.length === 0) {
      return { count: 0, outcome: "empty" };
    }
    try {
      const outcome = await exportProfilesToFile(profiles);
      return { count: profiles.length, outcome };
    } catch (e) {
      console.error(e);
      return { count: profiles.length, outcome: "error" };
    }
  },

  /**
   * Merge profiles parsed from an exported JSON file into the saved list.
   * Rows with an id that already exists get a fresh id (import never overwrites existing profiles).
   * Returns `{ added, addedIds }` — the count and the ids assigned to the newly imported rows (so
   * the caller can offer an "Undo" via removeProfilesByIds). `added` is 0 if the file had none.
   */
  importProfiles: (text) => {
    const incoming = parseImportedProfiles(text);
    if (incoming.length === 0) {
      return { added: 0, addedIds: [] };
    }
    const existing = loadProfilesFromStorage();
    const usedIds = new Set(existing.map((p) => p.id));
    const added = incoming.map((p) => {
      let { id } = p;
      if (usedIds.has(id)) {
        id = newSavedProfileId();
      }
      usedIds.add(id);
      return { ...p, id };
    });
    const next = [...existing, ...added];
    writeProfilesToStorage(next);
    set({ profiles: loadProfilesFromStorage() });
    return { added: added.length, addedIds: added.map((p) => p.id) };
  },

  // Remove profiles by id (used to undo an import). Also unlinks the draft if its active profile was
  // among them. No-op for ids that no longer exist.
  removeProfilesByIds: (ids) => {
    const drop = new Set(ids);
    const next = loadProfilesFromStorage().filter((p) => !drop.has(p.id));
    writeProfilesToStorage(next);
    const activeId = get().activeSavedProfileId;
    set({ profiles: next, activeSavedProfileId: activeId != null && drop.has(activeId) ? null : activeId });
  },

  // Load a saved profile into the draft. Returns `{ undo, hadUnsavedChanges }` — a restoreDraft-shaped
  // snapshot of the replaced state, plus whether it held unsaved work, so the caller offers Undo only when
  // there is something to recover. Null if the id is gone or the payload cannot be normalized.
  loadProfile: (id) => {
    const pr = loadProfilesFromStorage().find((p) => p.id === id);
    if (!pr) {
      return null;
    }
    const state = normalizeSavedState(pr);
    if (!state) {
      return null;
    }
    const prev = get();
    const undo = {
      title: prev.title,
      pillarLevels: { ...prev.pillarLevels },
      attachedBadge: normalizeAttachedBadge(prev.attachedBadge),
      activeSavedProfileId: prev.activeSavedProfileId,
    };
    // Warn only if the replaced draft actually had unsaved work (a blank all-default new draft loses
    // nothing), and never for a no-op reload of the already-active profile. Same dirty-test as
    // "New profile" (selectHasUnsavedWork), so the two agree.
    const hadUnsavedChanges = prev.activeSavedProfileId !== id && selectHasUnsavedWork(prev);
    get().applyState(state, { profileId: id });
    return { undo, hadUnsavedChanges };
  },

  // Shared writer for the save paths. Identity is by uuid, never by name, so name collisions surface as an
  // explicit confirm rather than a silent overwrite.
  //
  // Target: `overwriteId` writes into that exact profile; `forceNew` always inserts; otherwise it updates
  // the linked profile or inserts. `removeId` drops another row in the same write, which is how overwriting
  // resolves a rename collision.
  //
  // Returns { status: "saved" | "add-title" | "error" | "collision" }. "saved" carries `mode` for analytics
  // and `backupReminder` when this write CREATED a profile and hit a milestone (see storage.js).
  writeProfile: ({ overwriteId = null, forceNew = false, removeId = null } = {}) => {
    const trimmed = String(get().title).trim();
    if (!trimmed) {
      set({ saveFeedback: "add-title" });
      return { status: "add-title" };
    }

    const merged = mergeViewIntoCanonical({
      levels: get().levels,
      pillarLevels: get().pillarLevels,
    });

    const state = parseToCanonicalState({
      title: trimmed,
      pillarLevels: merged.pillarLevels,
      attachedBadge: get().attachedBadge,
    });
    if (!state) {
      return { status: "error" };
    }

    const existing = loadProfilesFromStorage();

    // Resolve the profile id we intend to write into (null → a brand-new row).
    let id = null;
    if (overwriteId != null) {
      id = overwriteId;
    } else if (!forceNew) {
      const activeId = get().activeSavedProfileId;
      if (activeId != null && existing.some((p) => p.id === activeId)) {
        id = activeId;
      }
    }

    // Name+badge collision guard: block only when the clashing profile is a *different* row than the
    // one we're about to write into. Skipped when the caller already resolved the collision.
    if (overwriteId == null) {
      const clash = findNameBadgeCollision(existing, state.title, state.attachedBadge, id);
      if (clash) {
        return { status: "collision", id: clash.id, name: state.title, badge: state.attachedBadge };
      }
    }

    if (id == null) {
      id = newSavedProfileId();
    }
    const replaceIdx = existing.findIndex((p) => p.id === id);

    const row = {
      id,
      title: state.title,
      pillarLevels: state.pillarLevels,
      attachedBadge: state.attachedBadge,
      savedAt: Date.now(),
    };
    let next = replaceIdx >= 0 ? existing.map((p, i) => (i === replaceIdx ? row : p)) : [...existing, row];
    const removedSource = removeId != null && removeId !== id;
    // Drop the merged-away source row (never the one we just wrote into).
    if (removedSource) {
      next = next.filter((p) => p.id !== removeId);
    }

    // A destructive write replaces an existing row and/or removes the merged source. Snapshot the
    // whole prior list + link so the UI can offer an "Undo" that restores the exact previous state.
    const overwrote = replaceIdx >= 0 ? existing[replaceIdx] : null;
    const undo = overwrote || removedSource ? { profiles: existing, activeSavedProfileId: get().activeSavedProfileId } : null;

    // Which KIND of save this was, for analytics only — the single `profile_saved` event cannot otherwise
    // tell a first save from an in-place edit. The caller's `overwrite`/`copy` flags stay separate: they
    // describe how the save was REACHED, not what it did.
    const mode = replaceIdx < 0 ? "created" : overwrote.title !== state.title ? "renamed" : "updated";

    // Count only writes that ADD a row, so the reminder tracks profiles accumulated rather than saves made.
    // Deliberately NOT undone by restoreProfiles: an undo cannot un-show a modal the user has read, and
    // re-counting a re-created profile would replay the 1st-profile reminder.
    const backupReminder = replaceIdx < 0 && isBackupReminderMilestone(bumpProfileCreateCount());

    writeProfilesToStorage(next);
    set({
      profiles: next,
      activeSavedProfileId: id,
      pillarLevels: { ...state.pillarLevels },
      saveFeedback: "saved",
    });
    get().persistDraft();
    return { status: "saved", savedTitle: state.title, overwroteTitle: overwrote?.title ?? null, undo, backupReminder, mode };
  },

  // Save/Update the current draft. Updates the linked profile in place (renaming it if the title
  // changed), or creates a new one when unlinked. May return a `collision` result — see writeProfile.
  saveProfile: () => get().writeProfile(),

  // "Save new" (offered while renaming): the title already differs from the linked profile, so save
  // a copy under that new name right away, leaving the source untouched. The new copy becomes the
  // active profile. May still return a `collision` if the new name clashes with a *third* profile.
  saveAsNew: () => get().writeProfile({ forceNew: true }),

  // "Save as…" (offered when the title still matches the source): detach from the linked profile
  // (new, unsaved draft keeping the same badge + levels) and prefill the name with "Copy of <source>"
  // so the draft clearly reads as a duplicate to name — not a blank new draft — even without the
  // autofocus we skip on touch. Nothing is written yet; the user edits the name then Saves.
  duplicateDraft: () => {
    const source = get().profiles.find((p) => p.id === get().activeSavedProfileId);
    const sourceName = String(source?.title ?? "").trim();
    const title = sourceName ? `Copy of ${sourceName}`.slice(0, MAX_PROFILE_NAME_LENGTH) : "";
    set({ title, activeSavedProfileId: null });
    get().persistDraft();
  },

  // Resolve a pending collision from the dialog's "Overwrite it": write into the clashing profile.
  // If the draft was a rename of a *different* linked profile, that source is merged away (removed)
  // so the two collapse into one. A plain new-save (unlinked draft) has no source to remove.
  saveOverwriting: (overwriteId) => {
    const activeId = get().activeSavedProfileId;
    const removeId = activeId != null && activeId !== overwriteId ? activeId : null;
    return get().writeProfile({ overwriteId, removeId });
  },

  // Undo a destructive save: restore the profile list + link captured in a writeProfile `undo`
  // snapshot, then re-sync the draft to the restored active profile (if it still exists) so the
  // chart/form reflect the reverted state.
  restoreProfiles: ({ profiles, activeSavedProfileId }) => {
    writeProfilesToStorage(profiles);
    const restored = activeSavedProfileId != null ? profiles.find((p) => p.id === activeSavedProfileId) : null;
    if (restored) {
      const state = normalizeSavedState(restored);
      if (state) {
        get().applyState(state, { profileId: restored.id });
      }
    }
    set({ profiles: loadProfilesFromStorage() });
  },

  // Undo one or more deletes by re-inserting the removed rows into the *current* list (deduped by id
  // in case one already came back). Unlike restoreProfiles this merges rather than replaces, so any
  // saves/edits made after the deletes survive. Used by the batched delete-Undo toast.
  restoreDeletedProfiles: (rows) => {
    const current = loadProfilesFromStorage();
    const have = new Set(current.map((p) => p.id));
    const merged = [...current, ...rows.filter((r) => !have.has(r.id))];
    writeProfilesToStorage(merged);
    set({ profiles: loadProfilesFromStorage() });
  },

  clearSaveFeedback: () => set({ saveFeedback: null }),

  // Wipe the draft to a fresh blank all-default state, unlinked. Does NOT snapshot, focus, or toast —
  // callers layer those on. Used by "New profile" and by deleting the currently-loaded profile.
  resetDraftToBlank: () => {
    const defaults = getDefaultChartState();
    set(
      withSyncedLevels({
        ...get(),
        title: "",
        pillarLevels: { ...defaults.pillarLevels },
        levels: [...defaults.levels],
        attachedBadge: normalizeAttachedBadge(defaults.attachedBadge),
        activeSavedProfileId: null,
      }),
    );
    get().persistDraft();
  },

  // Start a fresh blank draft (the "New profile" button). Returns `{ undo }` — a snapshot of the
  // draft it replaced — so the UI can offer an "Undo" that restores those in-flight, unsaved edits.
  // The snapshot is draft-only (title/levels/badge/link); it does not touch saved profiles.
  createNew: () => {
    const prev = get();
    const undo = {
      title: prev.title,
      pillarLevels: { ...prev.pillarLevels },
      attachedBadge: normalizeAttachedBadge(prev.attachedBadge),
      activeSavedProfileId: prev.activeSavedProfileId,
    };
    // Whether the caller offers an Undo is decided by selectHasUnsavedWork on the pre-blank draft.
    get().resetDraftToBlank();
    return { undo };
  },

  // Restore a draft snapshot captured by createNew — undo of "New profile". Re-links to the saved
  // profile only if it still exists (it may have been deleted meanwhile); otherwise stays unlinked.
  restoreDraft: ({ title, pillarLevels, attachedBadge, activeSavedProfileId }) => {
    set(
      withSyncedLevels({
        ...get(),
        title,
        pillarLevels: { ...pillarLevels },
        attachedBadge: normalizeAttachedBadge(attachedBadge),
        activeSavedProfileId: validateActiveId(activeSavedProfileId, get().profiles),
      }),
    );
    get().persistDraft();
  },

  // The "unsaved draft discarded" Undo toast, shared by loadProfile's caller and handleNewProfile so both
  // behave identically. `undo` is the pre-discard snapshot (restoreDraft shape); `onUndone` fires the
  // analytics for whichever path got here.
  showDraftDiscardedToast: (undo, onUndone) => {
    const name = String(undo.title).trim();
    const message = name ? `Unsaved changes to “${name}” were discarded` : "Unsaved changes to your draft were discarded";
    get().showToast(message, {
      variant: "dark",
      duration: UNDO_TOAST_DURATION,
      key: UNDO_TOAST_KEY,
      action: {
        label: "Undo",
        onAction: () => {
          get().restoreDraft(undo);
          onUndone?.();
        },
      },
    });
  },
}));

/**
 * Find a stored profile that clashes with the draft on name+badge, excluding `selfId` (the row we
 * are about to write into — updating a profile in place is never a "collision" with itself).
 * Comparison is case-insensitive on the trimmed title, matching how a user perceives duplicates.
 */
function findNameBadgeCollision(profiles, title, badge, selfId) {
  const name = String(title).trim().toLowerCase();
  const b = normalizeAttachedBadge(badge);
  return (
    profiles.find((p) => p.id !== selfId && String(p.title).trim().toLowerCase() === name && normalizeAttachedBadge(p.attachedBadge) === b) ?? null
  );
}

/** True when the stored profile's badge + canonical pillar levels equal the current draft's. */
function profileLevelsMatch(saved, s) {
  if (normalizeAttachedBadge(saved.attachedBadge) !== normalizeAttachedBadge(s.attachedBadge)) {
    return false;
  }
  const current = mergeViewIntoCanonical({
    levels: s.levels,
    pillarLevels: s.pillarLevels,
  }).pillarLevels;
  const savedLevels = saved.pillarLevels ?? {};
  const keys = new Set([...Object.keys(current), ...Object.keys(savedLevels)]);
  for (const k of keys) {
    if (current[k] !== savedLevels[k]) {
      return false;
    }
  }
  return true;
}

/**
 * The save status of the current draft. Identity is tracked purely by uuid — a draft is "linked"
 * only when it was loaded from a saved profile (`activeSavedProfileId`). A same-named profile that
 * the draft was NOT loaded from is not a target; typing an existing name reads as "new" (the
 * name+badge clash is instead surfaced as a confirm at save time — see {@link writeProfile}).
 *
 * - `"saved"`    — the linked profile exists and its title, badge and levels match exactly (no-op).
 * - `"renaming"` — the linked profile exists but the draft's title differs (including a blank title);
 *                  saving renames it in place (badge/levels may also differ). Distinguished from
 *                  "modified" so the button can read "Rename" instead of "Update". A blank title
 *                  can't actually be saved — the save attempt just flags the input (see saveProfile).
 * - `"modified"` — the linked profile exists, the title matches, but the badge/levels differ; saving
 *                  overwrites it.
 * - `"new"`      — no linked profile; saving creates a new one.
 */
export function selectProfileSaveStatus(s) {
  const trimmed = String(s.title).trim();
  const activeId = s.activeSavedProfileId;
  const target = activeId != null ? s.profiles.find((p) => p.id === activeId) : null;

  // A linked profile keeps the draft linked even with a cleared name — that's a rename-to-empty in
  // progress, not a detach. Only a genuinely unlinked draft is "new".
  if (!target) {
    return "new";
  }
  const titleMatches = String(target.title).trim() === trimmed;
  if (!titleMatches) {
    return "renaming";
  }
  return profileLevelsMatch(target, s) ? "saved" : "modified";
}

/**
 * Whether the current draft holds unsaved work that replacing it (loading a profile, "New profile")
 * would lose. True when the draft is a linked-but-edited profile ("renaming"/"modified"), OR an
 * unlinked "new" draft that actually has content (a title, badge, or off-default level). A clean
 * "saved" draft, or a blank all-default new draft, has nothing to recover → false.
 *
 * Single source of truth so load and "New profile" agree on when to offer an Undo.
 */
export function selectHasUnsavedWork(s) {
  const status = selectProfileSaveStatus(s);
  if (status === "renaming" || status === "modified") {
    return true;
  }
  if (status !== "new") {
    return false; // "saved" — nothing unsaved
  }
  // "new": only counts if the draft differs from a blank all-default draft.
  const defaults = getDefaultChartState();
  return (
    String(s.title).trim() !== "" ||
    normalizeAttachedBadge(s.attachedBadge) !== normalizeAttachedBadge(defaults.attachedBadge) ||
    Object.keys({ ...s.pillarLevels, ...defaults.pillarLevels }).some((k) => s.pillarLevels[k] !== defaults.pillarLevels[k])
  );
}
