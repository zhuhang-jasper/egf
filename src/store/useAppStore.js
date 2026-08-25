import { create } from "zustand";

import { MAX_PROFILE_NAME_LENGTH, normalizeAttachedBadge } from "@/constants";
import { FRAMEWORK_VERSION } from "@/constants/changelog";
import { fillPillarLevels, getDefaultChartState, newSavedProfileId, normalizeSavedState, parseToCanonicalState } from "@/constants/levels";
import { track } from "@/utils/analytics";
import { resolveProfileStamp } from "@/utils/profile-stamp";
import { isStaleProfile, profileStampState } from "@/utils/profile-stamp-state";
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

/**
 * (Re)arm one toast's auto-dismiss timer, clearing any prior one so a coalesced or restarted toast
 * begins a fresh window rather than inheriting a part-spent one. `duration` of 0 leaves it sticky.
 */
function armToastTimer(id, duration, onExpire) {
  const prev = toastTimers.get(id);
  if (prev) {
    clearTimeout(prev);
    toastTimers.delete(id);
  }
  if (duration > 0) {
    toastTimers.set(id, setTimeout(onExpire, duration));
  }
}

// Shared by every undoable action so a newer one REPLACES the older: only one Undo toast is ever on
// screen, and a stale one must never sit beside the undo the user is actually looking for.
export const UNDO_TOAST_KEY = "undo";

// One key per action family, so a re-tap of the same control replaces its notice instead of piling a
// second card on the first. Every outcome of a family shares its key — success, fallback and error are
// mutually exclusive answers to one press, so the newest is the only true one.
export const CHART_EXPORT_TOAST_KEY = "chart-export"; // Copy + Share on the chart
export const PROFILE_IO_TOAST_KEY = "profile-io"; // Export / Import failures in the profiles menu
// Non-destructive save confirmations (create / rename / update). A DESTRUCTIVE save takes
// UNDO_TOAST_KEY instead, since it carries an Undo and must contend for that single slot.
export const PROFILE_SAVE_TOAST_KEY = "profile-save";
// Copy / Download on the standalone share pages (Poster, Social). One key covers both pages: only one of
// them is ever mounted, since each is its own route.
export const SHARE_EXPORT_TOAST_KEY = "share-export";

/**
 * THE THREE TOAST WINDOWS. Every toast in the app takes one of these — there are no other durations, and
 * a call site should reach for {@link TOAST_DURATION} rather than inventing a number, so the set stays
 * three and the countdown rings all read at comparable speeds.
 *
 * The split is by what the toast ASKS OF THE READER, not by severity or by who raised it:
 *   short  — a few words confirming something already done ("Copied to clipboard"). Recognised, not read.
 *   long   — a full sentence that has to be read to be useful, with nothing to act on.
 *   undo   — carries an action. Long enough to notice the toast AND decide, which is a slower thing again.
 *
 * `undo` is applied automatically to any toast with an `action` (see showToast), so that bucket is never
 * chosen by hand. The dismiss button's countdown ring animates over exactly the chosen window (see
 * components/ui/Toaster.jsx).
 */
export const TOAST_DURATION = {
  short: 2000,
  long: 4000,
  undo: 8000,
};

const DEFAULT_TOAST_DURATION = TOAST_DURATION.short;
const UNDO_TOAST_DURATION = TOAST_DURATION.undo;

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

// Which KIND of save this was, for analytics only: the single `profile_saved` event cannot otherwise
// tell a first save from an in-place edit. The caller's `overwrite`/`copy` flags stay separate, since
// they describe how the save was REACHED, not what it did.
function saveMode(replaceIdx, overwrote, title) {
  if (replaceIdx < 0) {
    return "created";
  }
  return overwrote.title !== title ? "renamed" : "updated";
}

export const useAppStore = create((set, get) => ({
  title: initialDraft.title,
  pillarLevels: { ...initialDraft.pillarLevels },
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
  draftFrameworkVersion: initialDraft.draftFrameworkVersion ?? null,
  profiles: initialProfiles,
  saveFeedback: null,
  levelKeyboardInputEnabled: initialDraft.levelKeyboardInputEnabled === true,
  toasts: [],

  /**
   * Show a transient toast. `variant` is "default" (dark neutral; "dark" is an alias) | "success" |
   * "error". `action`, if
   * given, is `{ label, onAction }` and renders a button (e.g. "Undo") that fires `onAction` then
   * dismisses — and lengthens the toast to {@link TOAST_DURATION}.undo, so an actionable toast never
   * has to ask for that. `duration` ms until auto-dismiss (0 = sticky), overriding the above.
   *
   * LEAVE `duration` UNSET unless the message is a full sentence that has to be READ rather than
   * recognised — the default already covers a short confirmation, and an action already covers itself.
   * When you do pass one, pass a {@link TOAST_DURATION} member (`long` is the case this exists for) so
   * the app keeps exactly three windows. Note the buckets go by what the message asks of the reader,
   * NOT by variant: a brief error is still short.
   *
   * `key` coalesces: a live toast with the same key has its content replaced and countdown reset in
   * place, rather than a second toast stacking (see {@link UNDO_TOAST_KEY}).
   *
   * PASS A KEY whenever one control can produce the toast repeatedly — a second tap should replace
   * the notice, not pile on it. Share the key across a family's outcomes (success / fallback / error),
   * since they answer the same press and only the newest is true. Stacking is for unrelated notices
   * that happen to overlap, which is why the stack exists at all.
   *
   * `keepDeleteBatch` (internal) — only deleteProfileWithUndo passes true, to keep the running batch
   * alive while it coalesces; any other producer taking the toast ends the batch so its Undo cannot
   * re-insert stale rows. Returns the toast id (the existing one when coalescing).
   */
  showToast: (message, { variant = "default", duration, action = null, key = null, keepDeleteBatch = false } = {}) => {
    // A toast with an action defaults to the longer undo window: acting on it is a decision, so it
    // outlives one that only reports. Call sites pass `duration` only to override that.
    duration ??= action ? UNDO_TOAST_DURATION : DEFAULT_TOAST_DURATION;
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
    // WHEN the dismiss clock below starts. The ring animates from the toast's first PAINT, which lands
    // an unpredictable amount later — the producing handler may have just blocked the main thread (the
    // chart export rasterizes a high-res canvas before it toasts). Publishing the arm time lets the ring
    // seek to where it already should be, so the arc empties as the toast leaves rather than before it.
    const armedAt = performance.now();
    const fields = { message: text, variant, action, key, duration, cycle, armedAt };
    if (existing) {
      set((state) => ({ toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...fields } : t)) }));
    } else {
      set((state) => ({ toasts: [...state.toasts, { id, ...fields }] }));
    }
    armToastTimer(id, duration, () => get().dismissToast(id));
    return id;
  },

  /**
   * Restart every live toast's dismiss window. Called when the page becomes visible again, from the
   * resume listener in components/ui/Toaster.jsx (which owns it, being mounted exactly once).
   *
   * A toast's duration is meant to be time the user could have READ it, and a backgrounded tab paints
   * nothing while its timers keep running. So a notice raised just before the page was suspended (a
   * file picker or a share/save sheet is the usual cause) would otherwise surface with most or all of
   * its window already spent, flashing on screen and taking any Undo with it. Restarting is the
   * conservative read: the toast gets its full window from the moment it can actually be seen.
   *
   * `cycle` is bumped so the countdown ring remounts and animates the fresh window rather than
   * finishing the stale one.
   */
  restartToastTimers: () => {
    const live = get().toasts;
    if (live.length === 0) {
      return;
    }
    const armedAt = performance.now();
    set((state) => ({ toasts: state.toasts.map((t) => ({ ...t, armedAt, cycle: t.cycle + 1 })) }));
    for (const t of live) {
      armToastTimer(t.id, t.duration, () => get().dismissToast(t.id));
    }
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
    set({
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
    });
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

  setLevel: (pillarId, value) => {
    if (!pillarId) {
      return;
    }
    // Editing a level on an UNSAVED CLONE drops the stamp it inherited: the clone was the source's rating
    // until the moment a score moved, and after that it is the user's own, so it stamps at the current
    // version on save and its inherited flags go with it. A linked draft is unaffected — its stamp lives on
    // the row, and writeProfile decides there.
    set({ pillarLevels: fillPillarLevels({ ...get().pillarLevels, [pillarId]: value }), draftFrameworkVersion: null });
    get().persistDraft();
  },

  applyState: (state, { profileId = null } = {}) => {
    set({
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
    });
    // Clears any inherited clone stamp (see duplicateDraft): this draft now IS a profile, or a blank, so
    // the borrowed version no longer applies.
    set({ activeSavedProfileId: profileId, draftFrameworkVersion: null });
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
    set({ profiles: [], activeSavedProfileId: null, draftFrameworkVersion: null });
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
      // An unsaved clone's inherited stamp is part of the draft, so Undo has to bring it back with the rest.
      draftFrameworkVersion: prev.draftFrameworkVersion ?? null,
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

    const state = parseToCanonicalState({
      title: trimmed,
      pillarLevels: fillPillarLevels(get().pillarLevels),
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
    const target = replaceIdx >= 0 ? existing[replaceIdx] : null;

    // A save bumps the stamp only when it CHANGED A LEVEL; rename and badge-switch saves carry the old one
    // forward. Bumping on any write let a rename launder a stale profile clean, clearing every amber flag
    // while the user never looked at a level. An unchanged rating heals via restampProfile instead.
    //
    // Judged against the SOURCE — the profile the draft was loaded from — not the row being written into.
    // The stamp describes a RATING, and the rating is the draft's, wherever it lands. So a rename into a
    // collision carries the source's stamp (only the name changed), while an unlinked draft overwriting a row
    // stamps at the current version (it is a new assessment, and inherits nothing from the row it replaces).
    const sourceId = get().activeSavedProfileId;
    const source = sourceId != null ? (existing.find((p) => p.id === sourceId) ?? null) : null;
    const levelsUnchanged = source != null && pillarLevelsMatch(state.pillarLevels, source.pillarLevels);
    // A detached clone ("Save as copy") has no source row, but did inherit its stamp — see duplicateDraft.
    const inherited = source == null ? get().draftFrameworkVersion : null;
    // An UNSTAMPED row is dated from `savedAt`, so carrying a null stamp forward while `savedAt` moves would
    // re-date it to the current version — the same laundering by another route. Recording the version it
    // currently resolves to pins the verdict onto the row, freeing `savedAt` to be last-modified again.
    const carriedStamp = levelsUnchanged ? (resolveProfileStamp({ profile: source }).version ?? null) : inherited;

    const row = {
      id,
      title: state.title,
      pillarLevels: state.pillarLevels,
      attachedBadge: state.attachedBadge,
      // Always moves: it is last-modified, and a rename or badge switch does modify the row. Safe because
      // `carriedStamp` above pins the resolved version onto the row, so the date no longer decides it.
      savedAt: Date.now(),
      frameworkVersion: carriedStamp ?? FRAMEWORK_VERSION,
    };
    let next = replaceIdx >= 0 ? existing.map((p, i) => (i === replaceIdx ? row : p)) : [...existing, row];
    const removedSource = removeId != null && removeId !== id;
    // Drop the merged-away source row (never the one we just wrote into). Its title is kept for the toast:
    // this is the one path where a profile DISAPPEARS, and the notice has to be able to say which.
    const removedTitle = removedSource ? (existing.find((p) => p.id === removeId)?.title ?? null) : null;
    if (removedSource) {
      next = next.filter((p) => p.id !== removeId);
    }

    // A destructive write replaces an existing row and/or removes the merged source. Snapshot the
    // whole prior list + link so the UI can offer an "Undo" that restores the exact previous state.
    // `target` is that replaced row, resolved above for the stamp decision.
    const undo = target || removedSource ? { profiles: existing, activeSavedProfileId: get().activeSavedProfileId } : null;

    const mode = saveMode(replaceIdx, target, state.title);

    // Count only writes that ADD a row, so the reminder tracks profiles accumulated rather than saves made.
    // Deliberately NOT undone by restoreProfiles: an undo cannot un-show a modal the user has read, and
    // re-counting a re-created profile would replay the 1st-profile reminder.
    const backupReminder = replaceIdx < 0 && isBackupReminderMilestone(bumpProfileCreateCount());

    // For `profile_saved`: the state BEFORE this write, readable only here, in profile_loaded's `profile_state`
    // vocabulary so one GA dimension spans both ends of the load → re-rate funnel. A create has no prior row,
    // so it reports nothing — NOT `unverified`, which is a real verdict (the grey v??? chip).
    const priorState = target != null ? profileStampState(target).state : undefined;

    writeProfilesToStorage(next);
    set({
      profiles: next,
      activeSavedProfileId: id,
      draftFrameworkVersion: null, // spent: the clone is a saved row now
      pillarLevels: { ...state.pillarLevels },
      saveFeedback: "saved",
    });
    get().persistDraft();
    return {
      status: "saved",
      savedTitle: state.title,
      overwroteTitle: target?.title ?? null,
      undo,
      backupReminder,
      mode,
      priorState,
      removedTitle,
    };
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
    // A clone carries its source's RATING, so it carries the stamp too — same as "Save new", which keeps the
    // link and inherits it that way. Recorded, not left null: the copy gets a fresh `savedAt`, and a null
    // stamp would re-derive a version from that new date rather than from when the scores were actually set.
    //
    // ONLY WHILE THE SCORES STILL MATCH THE SOURCE. Copying a draft whose levels were already edited hands
    // over someone else's stamp with the user's own numbers, and the inherited flags reappear on scores they
    // have just changed. Same rule as setLevel: once a score moves, the rating is the user's.
    const untouched = source != null && pillarLevelsMatch(get().pillarLevels, source.pillarLevels);
    set({
      title,
      activeSavedProfileId: null,
      draftFrameworkVersion: untouched ? (resolveProfileStamp({ profile: source }).version ?? null) : null,
    });
    get().persistDraft();
  },

  // "Mark as rated using v<current>" (the save caret): the escape hatch from writeProfile's only-a-levels-
  // change-bumps rule, for a user who re-read the moved levels and kept their scores. Writes ONLY
  // `frameworkVersion`, holding `savedAt` — that is the POINT, and what distinguishes it from the +1/save/-1/
  // save round trip, which reaches the same stamp but re-dates the row. `undo` is restoreProfiles-shaped, so
  // a misclick reverts like a destructive save; "not-stale" when there was nothing flagged to clear.
  restampProfile: () => {
    const activeId = get().activeSavedProfileId;
    if (activeId == null) {
      return { status: "error" };
    }
    const existing = loadProfilesFromStorage();
    const idx = existing.findIndex((p) => p.id === activeId);
    if (idx < 0) {
      return { status: "error" };
    }
    const target = existing[idx];
    if (!isStaleProfile(target)) {
      return { status: "not-stale" };
    }
    const undo = { profiles: existing, activeSavedProfileId: activeId };
    const next = existing.map((p, i) => (i === idx ? { ...p, frameworkVersion: FRAMEWORK_VERSION } : p));
    writeProfilesToStorage(next);
    set({ profiles: next });
    return { status: "restamped", undo };
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
    } else {
      // A snapshot from an UNLINKED draft carries a null link, and that null is what must be restored: the
      // save had linked the draft to the row it wrote into, so leaving it attaches the draft to a profile it
      // is not, and the chip and pillar flags read off that row's stamp. Only the link is undone — the values
      // on screen are the user's own and stay put, so the draft reads as "new" again, ready to Save.
      set({ activeSavedProfileId: null, draftFrameworkVersion: null });
      get().persistDraft();
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
    set({
      ...get(),
      title: "",
      pillarLevels: { ...defaults.pillarLevels },
      attachedBadge: normalizeAttachedBadge(defaults.attachedBadge),
      activeSavedProfileId: null,
      draftFrameworkVersion: null,
    });
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
      draftFrameworkVersion: prev.draftFrameworkVersion ?? null,
    };
    // Whether the caller offers an Undo is decided by selectHasUnsavedWork on the pre-blank draft.
    get().resetDraftToBlank();
    return { undo };
  },

  // Restore a draft snapshot captured by createNew — undo of "New profile". Re-links to the saved
  // profile only if it still exists (it may have been deleted meanwhile); otherwise stays unlinked.
  restoreDraft: ({ title, pillarLevels, attachedBadge, activeSavedProfileId, draftFrameworkVersion = null }) => {
    set({
      ...get(),
      title,
      pillarLevels: { ...pillarLevels },
      attachedBadge: normalizeAttachedBadge(attachedBadge),
      activeSavedProfileId: validateActiveId(activeSavedProfileId, get().profiles),
      draftFrameworkVersion,
    });
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

/**
 * True when two canonical pillar-level maps hold the same score for every pillar. Levels ONLY — the badge is
 * deliberately excluded, because the stamp carry-forward in {@link writeProfile} turns on whether the ratings
 * moved, and a badge is cosmetic.
 */
function pillarLevelsMatch(a, b) {
  const left = fillPillarLevels(a);
  const right = b ?? {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const k of keys) {
    if (left[k] !== right[k]) {
      return false;
    }
  }
  return true;
}

/**
 * The framework version an EXPORT should name: the loaded profile's own stamp, else the stamp an unsaved clone
 * inherited, else the current version for a plain draft (which is being rated now, against nothing else).
 *
 * Resolved rather than read raw, so a legacy row dated from `savedAt` names the version it actually resolves
 * to instead of nothing.
 */
export function selectExportFrameworkVersion(s) {
  const active = s.activeSavedProfileId != null ? s.profiles.find((p) => p.id === s.activeSavedProfileId) : null;
  if (active) {
    return resolveProfileStamp({ profile: active }).version ?? null;
  }
  return s.draftFrameworkVersion ?? FRAMEWORK_VERSION;
}

/**
 * True when the draft's badge + levels match the profile it is linked to — i.e. a rename in progress has
 * changed nothing but the name. Exported for the toolbar, which labels a rename that ALSO edits values
 * differently and offers both undos at once.
 */
export function selectDraftValuesMatchLink(s) {
  const activeId = s.activeSavedProfileId;
  const target = activeId != null ? s.profiles.find((p) => p.id === activeId) : null;
  return target != null && profileLevelsMatch(target, s);
}

/** True when the stored profile's badge + canonical pillar levels equal the current draft's. */
function profileLevelsMatch(saved, s) {
  if (normalizeAttachedBadge(saved.attachedBadge) !== normalizeAttachedBadge(s.attachedBadge)) {
    return false;
  }
  return pillarLevelsMatch(s.pillarLevels, saved.pillarLevels);
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
