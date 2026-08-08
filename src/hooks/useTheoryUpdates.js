import { useCallback, useMemo, useState } from "react";

import {
  changelogRank,
  FRAMEWORK_VERSION,
  isNewerVersion,
  SECTION_LATEST_VERSION,
  THEORY_SECTION_PROGRESS_KEY,
  THEORY_SEEN_SECTIONS_KEY,
  THEORY_SEEN_VERSION_KEY,
} from "@/constants";
import { track } from "@/utils/analytics";

/**
 * Drives the Theory tab's unseen-updates indicators — both the per-section dots on the section
 * headings and the aggregate dot on the Theory tab label.
 *
 * State is a single persisted map ({@link THEORY_SEEN_SECTIONS_KEY}) of `{ sectionId: version }`:
 * the changelog version each section was last *read* at. A section is UNSEEN when the newest version
 * that touched it ({@link SECTION_LATEST_VERSION}) is newer than its stored value — so bumping the
 * framework only lights the sections the changelog says actually changed, not all four.
 *
 * Dismissal is per-section and happens on SCROLL, not on tab open: a section is read once BOTH its
 * head and tail have been in view (`useSectionSeenObserver` watches edge sentinels and reports each
 * via {@link markSectionEdgeSeen}), at which point it is stamped to current. Partial one-edge progress
 * is persisted separately ({@link THEORY_SECTION_PROGRESS_KEY}) so the two edges can be reached in
 * different sessions. The tab dot is purely derived — lit while ANY section is unseen.
 *
 * A fresh user (no stored map) is baselined to current on first read, so a first-time visitor never
 * sees dots for history they were never shown. Users carrying the legacy single-version key are
 * migrated the same way, using that version as every section's baseline — so someone who was already
 * caught up stays caught up, and someone who was behind lights up exactly the stale sections.
 */
export function useTheoryUpdates() {
  const [seenSections, setSeenSections] = useState(readSeenSections);

  // FRAMEWORK_VERSION must exist in CHANGELOG: `markSectionSeen` stamps it as the "read at" value,
  // and changelogRank() ranks an unknown version as infinitely OLD — so a bump with no matching
  // changelog entry would stamp a value that never satisfies isNewerVersion, leaving dots stuck on
  // forever. Cheap dev-time assert rather than a subtle "the dot won't go away" bug report.
  if (import.meta.env.DEV && changelogRank(FRAMEWORK_VERSION) === Number.POSITIVE_INFINITY) {
    console.error(`FRAMEWORK_VERSION "${FRAMEWORK_VERSION}" has no CHANGELOG entry — unseen dots will never clear. Add the entry.`);
  }

  // Sections whose newest change is newer than what this user has read. Recomputed from the map, so
  // marking one section seen re-derives the set (and with it the tab dot) with no extra bookkeeping.
  const unseenSections = useMemo(() => {
    const unseen = new Set();
    for (const [section, version] of Object.entries(SECTION_LATEST_VERSION)) {
      if (isNewerVersion(version, seenSections[section])) {
        unseen.add(section);
      }
    }
    return unseen;
  }, [seenSections]);

  const markSectionSeen = useCallback((section) => {
    clearSectionProgress(section);
    setSeenSections((prev) => {
      // Already at current — bail out and keep the same object identity so no re-render cascades from
      // an observer firing repeatedly for a section the user has already read.
      if (prev[section] === FRAMEWORK_VERSION) {
        return prev;
      }
      const next = { ...prev, [section]: FRAMEWORK_VERSION };
      writeSeenSections(next);
      // Inside the bail-guarded branch, so this fires once per section per framework version — the same
      // latch that stops the dot coming back. A new CHANGELOG entry re-arms both, which is the point:
      // it reports whether anyone read the section's NEW content, not just that they scrolled past once.
      track("theory_section_seen", { section, framework_version: FRAMEWORK_VERSION });
      return next;
    });
  }, []);

  /**
   * Records that one EDGE (head or tail) of a section has been in view, and reports whether that
   * completes the pair. Persisted rather than held in memory: the two edges of a tall section are
   * rarely on screen in the same sitting, so partial progress has to survive a reload, a tab switch,
   * or closing the page — otherwise a user who scrolled to the bottom, left, and came back to read
   * the top would lose the tail credit and keep the dot forever.
   *
   * Completing the pair does NOT mark the section read. It only ARMS it: the caller then runs a settle
   * delay so the dot stays visible long enough to be noticed, and calls `markSectionSeen` if the
   * section is still on screen when that elapses.
   */
  const markSectionEdgeSeen = useCallback((section, edge) => {
    const edges = readSectionEdges(section);
    if (edges.has(edge)) {
      return edges.size >= 2;
    }
    edges.add(edge);
    writeSectionProgress(section, [...edges]);
    return edges.size >= 2;
  }, []);

  /**
   * Read-only: whether both edges of `section` are already latched at the current version. Lets the
   * observer ask "is this section armed?" without the write that `markSectionEdgeSeen` performs —
   * probing with that would fabricate an edge the user never actually reached.
   */
  const isSectionEdgePairComplete = useCallback((section) => readSectionEdges(section).size >= 2, []);

  return {
    hasUnseenUpdates: unseenSections.size > 0,
    unseenSections,
    markSectionSeen,
    markSectionEdgeSeen,
    isSectionEdgePairComplete,
  };
}

/**
 * The edges of `section` already seen AT THE CURRENT VERSION, as a Set. Progress stamped against an
 * older version is discarded: a head-read at v4.1 must not combine with a tail-read at v4.2 to clear
 * a v4.2 dot, since the content in between changed after that first half was read.
 */
function readSectionEdges(section) {
  const entry = readJson(THEORY_SECTION_PROGRESS_KEY)?.[section];
  if (!entry || entry.version !== FRAMEWORK_VERSION || !Array.isArray(entry.edges)) {
    return new Set();
  }
  return new Set(entry.edges);
}

function writeSectionProgress(section, edges) {
  const all = readJson(THEORY_SECTION_PROGRESS_KEY) ?? {};
  all[section] = { version: FRAMEWORK_VERSION, edges };
  writeJson(THEORY_SECTION_PROGRESS_KEY, all);
}

/** Drops a section's partial progress — called once it's fully read, so the key doesn't accumulate. */
function clearSectionProgress(section) {
  const all = readJson(THEORY_SECTION_PROGRESS_KEY);
  if (!all || !(section in all)) {
    return;
  }
  delete all[section];
  writeJson(THEORY_SECTION_PROGRESS_KEY, all);
}

/**
 * The stored seen-map, with the fresh-user and legacy-key baselines applied (and written back, so the
 * baseline is established once rather than re-derived every mount).
 *
 * Per-section tracking only exists from the version that shipped it onward. Everyone arriving from an
 * earlier build has just ONE stored string to go on, so it seeds all four sections uniformly.
 *
 * That legacy value means "the version the Theory tab was last OPENED at" — the old implementation
 * stamped it in an effect keyed on tab-active, with no scroll involved — and this migration
 * necessarily reads it as "read at". The two differ, and the error is one-directional: a user who
 * opened Theory at vX and immediately bounced is credited with having read all of vX, so their
 * unread vX material is silently baselined away. Only versions AFTER vX can still raise a dot for
 * them. Nothing better is recoverable, since per-section reads were never recorded; it self-corrects
 * from the next bump on, when every stamp comes from a real scroll.
 */
function readSeenSections() {
  const stored = readJson(THEORY_SEEN_SECTIONS_KEY);
  if (stored) {
    return stored;
  }

  // No map yet. A legacy single-version user gets that version as every section's baseline; a fresh
  // user gets the current version, which means "caught up" and shows no dots.
  const baseline = readLegacySeenVersion() ?? FRAMEWORK_VERSION;
  const migrated = {};
  for (const section of Object.keys(SECTION_LATEST_VERSION)) {
    migrated[section] = baseline;
  }
  // Written back immediately, which CONSUMES the legacy key: from here on the map exists, the early
  // return above wins, and readLegacySeenVersion is never consulted again for this user.
  const persisted = writeSeenSections(migrated);
  // DELETED AT THE POINT OF CONSUMPTION, not by the boot-time sweeper in utils/storage.js. Its whole
  // value has just been transferred into the map above, so keeping it serves nothing — but the order is
  // the reason this cannot be a retired key: `retireLegacyKeys()` runs before React mounts, so it would
  // wipe the baseline BEFORE this function ever read it, and a returning user would be silently
  // re-baselined to "caught up" and lose every dot the key exists to preserve.
  //
  // Doing it here also removes the waiting period that a sweep-based retirement would need. The
  // migration keeps working for a browser that shows up years late, and still cleans up after itself.
  //
  // GATED ON THE WRITE HAVING LANDED, so a store that rejected the map (quota, private mode) does not
  // also lose the baseline it was derived from: nothing is deleted, and the next load migrates again
  // from the same legacy value. Deleting unconditionally would turn one failed write into a permanently
  // re-baselined user.
  if (persisted) {
    dropLegacySeenVersion();
  }
  return migrated;
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    // Guard against a hand-edited or half-written value: anything that isn't a plain object is
    // discarded so the caller falls back to re-baselining rather than reading properties off it.
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readLegacySeenVersion() {
  try {
    return localStorage.getItem(THEORY_SEEN_VERSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Retire the legacy single-version baseline, once its value has been migrated into the section map.
 *
 * Silent on failure: the key is already unreachable by then (see readSeenSections), so a store that
 * refuses the delete costs nothing but the leftover bytes.
 */
function dropLegacySeenVersion() {
  try {
    localStorage.removeItem(THEORY_SEEN_VERSION_KEY);
  } catch {
    /* private mode / disabled store */
  }
}

function writeSeenSections(map) {
  return writeJson(THEORY_SEEN_SECTIONS_KEY, map);
}

/** @returns true when the value actually reached localStorage. */
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // localStorage unavailable (private mode, quota) — keep the session-only value.
    return false;
  }
}
