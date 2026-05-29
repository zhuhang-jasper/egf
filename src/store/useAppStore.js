import { create } from "zustand";

import { DEFAULT_STATE, isAiPillarIndex, normalizeTrackVariant, PILLAR_COUNT, PILLAR_SCHEMA } from "@/lib/constants";
import { getDefaultChartState, newSavedProfileId, normalizeSavedState } from "@/lib/levels";
import { loadDraftFromStorage, loadProfilesFromStorage, saveDraftToStorage, writeProfilesToStorage } from "@/lib/storage";

const initialDraft = loadDraftFromStorage() ?? getDefaultChartState();

export const useAppStore = create((set, get) => ({
  title: initialDraft.title,
  levels: [...initialDraft.levels],
  aiLevels: [...initialDraft.aiLevels],
  trackVariant: normalizeTrackVariant(initialDraft.trackVariant),
  levelsPolygonHidden: false,
  chartLegendHidden: false,
  footerScoresHidden: false,
  activeSavedProfileId: null,
  profiles: loadProfilesFromStorage(),
  profilePickerOpen: false,
  saveFeedback: null,

  hydrate: () => {
    const draft = loadDraftFromStorage() ?? getDefaultChartState();
    set({
      title: draft.title,
      levels: [...draft.levels],
      aiLevels: [...draft.aiLevels],
      trackVariant: normalizeTrackVariant(draft.trackVariant),
      profiles: loadProfilesFromStorage(),
    });
  },

  persistDraft: () => {
    const { title, levels, aiLevels, trackVariant } = get();
    saveDraftToStorage({ title, levels, aiLevels, trackVariant, pillarSchema: PILLAR_SCHEMA });
  },

  setTrackVariant: (trackVariant) => {
    set({ trackVariant: normalizeTrackVariant(trackVariant) });
    get().persistDraft();
  },

  setTitle: (title) => {
    set({ title, activeSavedProfileId: null });
    get().persistDraft();
  },

  setLevel: (index, value, { isAi = false } = {}) => {
    if (isAi) {
      if (!isAiPillarIndex(index)) {
        return;
      }
      const aiLevels = [...get().aiLevels];
      aiLevels[index] = value;
      for (let j = 0; j < PILLAR_COUNT; j++) {
        if (!isAiPillarIndex(j)) {
          aiLevels[j] = 0;
        }
      }
      set({ aiLevels });
    } else {
      const levels = [...get().levels];
      levels[index] = value;
      set({ levels });
    }
    get().persistDraft();
  },

  applyState: (state, { profileId = null } = {}) => {
    set({
      title: state.title,
      levels: [...state.levels],
      aiLevels: [...state.aiLevels],
      trackVariant: normalizeTrackVariant(state.trackVariant),
      activeSavedProfileId: profileId,
    });
    get().persistDraft();
  },

  setLevelsPolygonHidden: (hidden) => set({ levelsPolygonHidden: hidden }),

  setChartLegendHidden: (hidden) => set({ chartLegendHidden: hidden }),

  setFooterScoresHidden: (hidden) => set({ footerScoresHidden: hidden }),

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
    const state = normalizeSavedState({
      title: trimmed,
      levels: get().levels,
      aiLevels: get().aiLevels,
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
      levels: state.levels,
      aiLevels: state.aiLevels,
      pillarSchema: state.pillarSchema,
      trackVariant: state.trackVariant,
      savedAt: Date.now(),
    };
    const next = replaceIdx >= 0 ? existing.map((p, i) => (i === replaceIdx ? row : p)) : [...existing, row];

    writeProfilesToStorage(next);
    set({
      profiles: next,
      activeSavedProfileId: id,
      saveFeedback: "saved",
    });
    get().persistDraft();
    return true;
  },

  clearSaveFeedback: () => set({ saveFeedback: null }),

  resetLevels: () => {
    set({
      levels: [...DEFAULT_STATE.levels],
      aiLevels: [...DEFAULT_STATE.aiLevels],
      activeSavedProfileId: null,
    });
    get().persistDraft();
  },
}));
