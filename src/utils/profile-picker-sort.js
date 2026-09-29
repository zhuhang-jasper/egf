/**
 * Row ordering for the profile dropdown. No store access, and the badge order arrives as a parameter rather
 * than being read from constants here, so profile-picker-sort.test.js can pass its own order.
 */

/**
 * Rank a profile's badge for grouping — lower sorts first. An unknown or absent badge ranks last, which is
 * also where "none" sits in the order the caller passes.
 */
export function badgeRank(badge, badgeOrder) {
  const i = badgeOrder.indexOf(badge);
  return i === -1 ? badgeOrder.length : i;
}

/**
 * `query` filtered out, then grouped by badge and A-Z within each group; storage hands profiles over
 * newest-first, so this ordering is for display only. Case- and accent-insensitive on both halves, the name
 * comparison using `sensitivity: "base"` so "Ana" and "ána" group together. Returns a new array.
 */
export function sortProfilesForPicker(profiles, { query = "", badgeOrder = [], normalizeBadge = (b) => b } = {}) {
  const q = String(query).trim().toLowerCase();
  return (profiles ?? [])
    .filter((p) => q === "" || String(p.title).toLowerCase().includes(q))
    .slice()
    .sort((a, b) => {
      const byBadge = badgeRank(normalizeBadge(a.attachedBadge), badgeOrder) - badgeRank(normalizeBadge(b.attachedBadge), badgeOrder);
      if (byBadge !== 0) {
        return byBadge;
      }
      return String(a.title).localeCompare(String(b.title), undefined, { sensitivity: "base" });
    });
}
