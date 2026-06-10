import { create } from "zustand";

import { getPillarIdByIndex, normalizeTrackVariant } from "@/lib/constants";
import {
  fillPillarLevels,
  getDefaultChartState,
  mergeViewIntoCanonical,
  newSavedProfileId,
  normalizeSavedState,
  parseToCanonicalState,
  syncLevelsArrayFromMap,
} from "@/lib/levels";
import {
  getDefaultChartDisplay,
  loadDraftFromStorage,
  loadProfilesFromStorage,
  saveDraftToStorage,
  writeProfilesToStorage,
} from "@/lib/storage";

const initialDraft = loadDraftFromStorage() ?? { ...getDefaultChartState(), ...getDefaultChartDisplay() };

function withSyncedLevels(state) {
  const { levels } = syncLevelsArrayFromMap({
    pillarLevels: state.pillarLevels,
    trackVariant: state.trackVariant,
  });
  return { ...state, levels };
}

export const useAppStore = create((set, get) => ({
  title: initialDraft.title,
  pillarLevels: { ...initialDraft.pillarLevels },
  levels: [...initialDraft.levels],
  trackVariant: normalizeTrackVariant(initialDraft.trackVariant),
  levelsPolygonHidden: initialDraft.levelsPolygonHidden,
  chartLegendHidden: initialDraft.chartLegendHidden,
  chartTitleHidden: initialDraft.chartTitleHidden,
  footerScoresHidden: initialDraft.footerScoresHidden,
  footerScoresHiddenUserSet: initialDraft.footerScoresHiddenUserSet === true,
  activeSavedProfileId: null,
  profiles: loadProfilesFromStorage(),
  profilePickerOpen: false,
  saveFeedback: null,
  levelKeyboardInputEnabled: initialDraft.levelKeyboardInputEnabled === true,

  hydrate: () => {
    const draft = loadDraftFromStorage() ?? { ...getDefaultChartState(), ...getDefaultChartDisplay() };
    set(
      withSyncedLevels({
        title: draft.title,
        pillarLevels: { ...draft.pillarLevels },
        trackVariant: normalizeTrackVariant(draft.trackVariant),
        levelsPolygonHidden: draft.levelsPolygonHidden,
        chartLegendHidden: draft.chartLegendHidden,
        chartTitleHidden: draft.chartTitleHidden,
        footerScoresHidden: draft.footerScoresHidden,
        footerScoresHiddenUserSet: draft.footerScoresHiddenUserSet === true,
        levelKeyboardInputEnabled: draft.levelKeyboardInputEnabled === true,
      }),
    );
    set({ profiles: loadProfilesFromStorage() });
  },

  persistDraft: () => {
    saveDraftToStorage(get());
  },

  setTrackVariant: (trackVariant) => {
    set((state) =>
      withSyncedLevels({
        ...state,
        trackVariant: normalizeTrackVariant(trackVariant),
      }),
    );
    get().persistDraft();
  },

  setTitle: (title) => {
    set({ title, activeSavedProfileId: null });
    get().persistDraft();
  },

  setLevel: (index, value) => {
    const {trackVariant} = get();
    const pillarId = getPillarIdByIndex(index, trackVariant);
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
        trackVariant: normalizeTrackVariant(state.trackVariant),
        levelsPolygonHidden: get().levelsPolygonHidden,
        chartLegendHidden: get().chartLegendHidden,
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

  setChartLegendHidden: (hidden) => {
    set({ chartLegendHidden: hidden });
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

  removeProfile: (id) => {
    const next = loadProfilesFromStorage().filter((p) => p.id !== id);
    writeProfilesToStorage(next);
    set({
      profiles: next,
      activeSavedProfileId: get().activeSavedProfileId === id ? null : get().activeSavedProfileId,
    });
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

  saveProfile: () => {
    const trimmed = String(get().title).trim();
    if (!trimmed) {
      set({ saveFeedback: "add-title" });
      return false;
    }

    const merged = mergeViewIntoCanonical({
      levels: get().levels,
      pillarLevels: get().pillarLevels,
      trackVariant: get().trackVariant,
    });

    const state = parseToCanonicalState({
      title: trimmed,
      pillarLevels: merged.pillarLevels,
      trackVariant: get().trackVariant,
    });
    if (!state) {
      return false;
    }

    const existing = loadProfilesFromStorage();
    let id = null;
    let replaceIdx = -1;
    const activeId = get().activeSavedProfileId;
    const byActive = activeId != null ? existing.findIndex((p) => p.id === activeId) : -1;
    if (byActive >= 0) {
      id = activeId;
      replaceIdx = byActive;
    } else {
      const byTitle = existing.findIndex((p) => String(p.title).trim() === trimmed);
      if (byTitle >= 0) {
        ({ id } = existing[byTitle]);
        replaceIdx = byTitle;
      }
    }
    if (id == null) {
      id = newSavedProfileId();
      replaceIdx = -1;
    }

    const row = {
      id,
      title: state.title,
      pillarLevels: state.pillarLevels,
      trackVariant: state.trackVariant,
      savedAt: Date.now(),
    };
    const next = replaceIdx >= 0 ? existing.map((p, i) => (i === replaceIdx ? row : p)) : [...existing, row];

    writeProfilesToStorage(next);
    set({
      profiles: next,
      activeSavedProfileId: id,
      pillarLevels: { ...state.pillarLevels },
      saveFeedback: "saved",
    });
    get().persistDraft();
    return true;
  },

  clearSaveFeedback: () => set({ saveFeedback: null }),

  resetLevels: () => {
    const defaults = getDefaultChartState();
    set(
      withSyncedLevels({
        ...get(),
        pillarLevels: { ...defaults.pillarLevels },
        levels: [...defaults.levels],
        activeSavedProfileId: null,
      }),
    );
    get().persistDraft();
  },

  createNew: () => {
    if (String(get().title).trim()) {
      get().saveProfile();
    }

    const defaults = getDefaultChartState();
    set(
      withSyncedLevels({
        ...get(),
        title: "",
        pillarLevels: { ...defaults.pillarLevels },
        levels: [...defaults.levels],
        activeSavedProfileId: null,
      }),
    );
    get().persistDraft();
  },
}));
