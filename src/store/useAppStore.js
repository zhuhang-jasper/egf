import { create } from "zustand";

import { getPillarIdByIndex, normalizeAttachedBadge } from "@/constants";
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
import { getDefaultChartDisplay, loadDraftFromStorage, loadProfilesFromStorage, saveDraftToStorage, writeProfilesToStorage } from "@/utils/storage";

const initialDraft = loadDraftFromStorage() ?? { ...getDefaultChartState(), ...getDefaultChartDisplay() };
const initialProfiles = loadProfilesFromStorage();

// Monotonic id source for toasts (module-scoped so ids stay unique across the store's lifetime).
let toastSeq = 0;
// Per-toast auto-dismiss timers, so a coalescing toast can reset its own countdown.
const toastTimers = new Map();
// Coalescing key + accumulator for the batched delete-Undo toast. `deleteBatch` collects the rows
// removed while the toast is still on screen; it resets once that toast is gone (expired/undone).
const DELETE_TOAST_KEY = "profile-delete";
let deleteBatch = [];

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
  chartBadgeHidden: initialDraft.chartBadgeHidden,
  chartTitleHidden: initialDraft.chartTitleHidden,
  footerScoresHidden: initialDraft.footerScoresHidden,
  footerScoresHiddenUserSet: initialDraft.footerScoresHiddenUserSet === true,
  activeSavedProfileId: validateActiveId(initialDraft.activeSavedProfileId, initialProfiles),
  profiles: initialProfiles,
  profilePickerOpen: false,
  saveFeedback: null,
  levelKeyboardInputEnabled: initialDraft.levelKeyboardInputEnabled === true,
  toasts: [],

  /**
   * Show a transient toast. `variant` is "default" | "success" | "error" | "dark". `action`, if
   * given, is `{ label, onAction }` and renders a button (e.g. "Undo") that fires `onAction` then
   * dismisses. `duration` ms until auto-dismiss (0 = sticky).
   *
   * `key` coalesces: if a live toast already has the same `key`, this replaces its content in place
   * and resets its countdown instead of stacking a new toast (used to batch rapid deletes into one
   * "Deleted N profiles" toast). Returns the toast id (the existing one when coalescing).
   */
  showToast: (message, { variant = "default", duration = 2600, action = null, key = null } = {}) => {
    const text = String(message ?? "").trim();
    if (!text) {
      return null;
    }
    const existing = key != null ? get().toasts.find((t) => t.key === key) : null;
    const id = existing ? existing.id : ++toastSeq;
    if (existing) {
      set((state) => ({ toasts: state.toasts.map((t) => (t.id === id ? { ...t, message: text, variant, action, key } : t)) }));
    } else {
      set((state) => ({ toasts: [...state.toasts, { id, message: text, variant, action, key }] }));
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
    // Once the batched-delete toast is gone, drop the accumulated rows so the "gone" profiles aren't
    // held in memory. (Undo already clears the batch itself before dismissing.)
    if (get().toasts.find((t) => t.id === id)?.key === DELETE_TOAST_KEY) {
      deleteBatch = [];
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
        chartBadgeHidden: draft.chartBadgeHidden,
        chartTitleHidden: draft.chartTitleHidden,
        footerScoresHidden: draft.footerScoresHidden,
        footerScoresHiddenUserSet: draft.footerScoresHiddenUserSet === true,
        levelKeyboardInputEnabled: draft.levelKeyboardInputEnabled === true,
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
    // Keep the link to the loaded profile (`activeSavedProfileId`) even when the title is edited.
    // A renamed draft then reads as "renaming" against its source, so the Save control can offer
    // Rename (in place) vs. Save new (save a copy under the new name). Use `saveAsNew`/`duplicateDraft`
    // /`createNew`/Reset to fork or detach.
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
        chartBadgeHidden: get().chartBadgeHidden,
        chartTitleHidden: get().chartTitleHidden,
        footerScoresHidden: get().footerScoresHidden,
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

  setChartBadgeHidden: (hidden) => {
    set({ chartBadgeHidden: hidden });
    get().persistDraft();
  },

  setChartTitleHidden: (hidden) => {
    set({ chartTitleHidden: hidden });
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

  setProfilePickerOpen: (open) => {
    set({ profilePickerOpen: open });
    if (open) {
      set({ profiles: loadProfilesFromStorage() });
    }
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

  // Delete a profile via the bin icon and surface a batched Undo toast. Rapid deletes coalesce: each
  // one while the toast is still up merges into a single "Deleted N profiles" toast, accumulates the
  // removed row, and resets the 10s countdown. Undo re-inserts every row from the current batch. The
  // batch clears once the toast is gone (expired or undone), so the next delete starts fresh.
  deleteProfileWithUndo: (id) => {
    const removed = get().removeProfile(id);
    if (!removed) {
      return;
    }
    // Start a fresh batch unless the previous delete's toast is still on screen (coalescing window).
    const toastLive = get().toasts.some((t) => t.key === DELETE_TOAST_KEY);
    deleteBatch = toastLive ? [...deleteBatch, removed] : [removed];
    const rows = deleteBatch; // capture for the Undo closure
    const count = rows.length;
    const message = count === 1 ? `Deleted “${rows[0].title}”` : `Deleted ${count} profiles`;
    get().showToast(message, {
      variant: "dark",
      duration: 10000,
      key: DELETE_TOAST_KEY,
      action: {
        label: "Undo",
        onAction: () => {
          get().restoreDeletedProfiles(rows);
          deleteBatch = [];
          track("profiles_delete_undone", { count });
        },
      },
    });
  },

  // Delete every saved profile. Returns `{ removed, undo }` — count removed + a snapshot for undo.
  clearAllProfiles: () => {
    const existing = loadProfilesFromStorage();
    const undo = { profiles: existing, activeSavedProfileId: get().activeSavedProfileId };
    writeProfilesToStorage([]);
    set({ profiles: [], activeSavedProfileId: null });
    return { removed: existing.length, undo };
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

  loadProfile: (id) => {
    const pr = loadProfilesFromStorage().find((p) => p.id === id);
    if (!pr) {
      return;
    }
    const state = normalizeSavedState(pr);
    if (!state) {
      return;
    }
    get().applyState(state, { profileId: id });
    set({ profilePickerOpen: false });
  },

  // Shared writer for the save paths. Identity is tracked by uuid (`activeSavedProfileId`), never by
  // name, so name collisions are surfaced as an explicit confirm rather than silently overwriting.
  //
  // Target resolution:
  //   - `overwriteId` set → write into that exact profile (the "Overwrite it" collision path).
  //   - `forceNew` true   → always insert a new row, ignoring the link ("Save new" — save a copy
  //                         under the already-changed name, leaving the source untouched).
  //   - otherwise         → update the linked profile (`activeSavedProfileId`), else insert new.
  //
  // `removeId` deletes another profile in the same write — used when overwriting resolves a rename
  // collision: the renamed source is merged into the clash target, so the source row is dropped.
  //
  // Before writing, unless `overwriteId` is set, it checks for a *different* stored profile with the
  // same name+badge and, if found, returns a `collision` result instead of writing so the UI can
  // prompt (Overwrite / Cancel).
  //
  // Returns one of:
  //   { status: "saved" }                    — written successfully
  //   { status: "add-title" }                — blank title, nothing written
  //   { status: "error" }                    — payload failed to normalize
  //   { status: "collision", name, badge }   — name+badge clash; caller must decide
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

    writeProfilesToStorage(next);
    set({
      profiles: next,
      activeSavedProfileId: id,
      pillarLevels: { ...state.pillarLevels },
      saveFeedback: "saved",
    });
    get().persistDraft();
    return { status: "saved", savedTitle: state.title, overwroteTitle: overwrote?.title ?? null, undo };
  },

  // Save/Update the current draft. Updates the linked profile in place (renaming it if the title
  // changed), or creates a new one when unlinked. May return a `collision` result — see writeProfile.
  saveProfile: () => get().writeProfile(),

  // "Save new" (offered while renaming): the title already differs from the linked profile, so save
  // a copy under that new name right away, leaving the source untouched. The new copy becomes the
  // active profile. May still return a `collision` if the new name clashes with a *third* profile.
  saveAsNew: () => get().writeProfile({ forceNew: true }),

  // "Save as…" (offered when the title still matches the source): detach from the linked profile
  // (new, unsaved draft keeping the same badge + levels) and clear the title so the user can name it
  // before saving. Nothing is written yet — the draft just becomes unlinked with a blank name.
  duplicateDraft: () => {
    set({ title: "", activeSavedProfileId: null });
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
    const defaults = getDefaultChartState();
    // "Had content" gates whether the caller offers an Undo — no point offering it when the draft
    // was already blank + all-default (nothing would be lost). Any title, badge, link, or off-default
    // level counts.
    const hadContent =
      prev.title.trim() !== "" ||
      prev.activeSavedProfileId != null ||
      normalizeAttachedBadge(prev.attachedBadge) !== normalizeAttachedBadge(defaults.attachedBadge) ||
      Object.keys({ ...prev.pillarLevels, ...defaults.pillarLevels }).some((k) => prev.pillarLevels[k] !== defaults.pillarLevels[k]);
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
    return { undo, hadContent };
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
}));

/**
 * Find a stored profile that clashes with the draft on name+badge, excluding `selfId` (the row we
 * are about to write into — updating a profile in place is never a "collision" with itself).
 * Comparison is case-insensitive on the trimmed title, matching how a user perceives duplicates.
 */
function findNameBadgeCollision(profiles, title, badge, selfId) {
  const name = String(title).trim().toLowerCase();
  const b = normalizeAttachedBadge(badge);
  return profiles.find((p) => p.id !== selfId && String(p.title).trim().toLowerCase() === name && normalizeAttachedBadge(p.attachedBadge) === b) ?? null;
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
