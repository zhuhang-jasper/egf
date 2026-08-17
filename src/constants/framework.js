/** Master pillar catalog (id → label). Add/remove pillars here; wire into tracks below. */
export const PILLARS = {
  coding: { label: "🤲 Coding (Hands)" },
  domainLogic: { label: "👃 Domain Logic (Nose)" },
  architecture: { label: "🧠 Architecture (Brain)" },
  ai: { label: "🤖 AI Leverage (Machine)" },
  uiUx: { label: "👀 UI/UX (Eyes)" },
  productSense: { label: "💡 Product Sense (Gut)" },
  process: { label: "🦴 Process (Spine)" },
  communication: { label: "🗣️ Communication (Voice)" },
  ownership: { label: "✨ Ownership (Soul)" },
};

/**
 * The three clusters, and the four colours each one owns. FOUR VALUES, FOUR DIFFERENT JOBS — read this before
 * editing any of them, because only one of the four is "the cluster's colour" in the way you might assume:
 *
 *   color      the ACCENT, used sparingly on small marks that should punch: card left bezels, career-track
 *              titles, chip rings. NOT the chart and NOT the legend.
 *   chartBg    the radar's cluster wedges (chart/plugins.js) AND the legend swatch naming them. THESE TWO MUST
 *              STAY THE SAME VALUE — a legend explains the chart, so its swatch has to be the colour actually
 *              on it. A wedge is also a large area behind live data, so this belongs below `color`: the accent
 *              at wedge size reads as three solid blocks fighting the data polygon.
 *   surfaceBg  card backgrounds — the tool form's cluster cards, the theory tab's pillar cards, the
 *              career-track cards, the score cards. OPAQUE, so it holds its value on any page background.
 *   textColor  cluster label text and the score cards' text/border, plus the chart's coloured axis labels
 *              (getPillarLabelColor). Text first: keep it dark enough to read on `surfaceBg`.
 *   badgeBg / badgeText   the career-track level badges only.
 *
 * WHAT THE SPLIT FIXED, so it does not get undone: `chartBg` and `surfaceBg` used to be ONE field. Card tints
 * were derived from the wedge colour by a `${color}55` alpha helper, so (a) cards could not be retuned without
 * moving the chart and vice versa, and (b) being translucent, every card tint shifted whenever the page
 * background changed. `surfaceBg` is now that same 33%-over-white composite, precomputed opaque — hence pairs
 * like #cdbdd8 → #EEE9F2 that look arbitrary but are exactly what shipped before. `color` is likewise split
 * out of `textColor`, which had been doing bezel duty on top of being text; both still hold the same hex here,
 * and that is now a coincidence the two are free to break.
 *
 * TO RESTYLE: edit the hexes below, nothing else. Two traps, both learned the hard way — keep `chartBg` well
 * below `color` in saturation (a vivid wedge competes with the polygon, a near-white one vanishes under it),
 * and note `chartBg` CHANGES THE EXPORTED PNG, since the wedges and legend both sit inside the chart's export
 * root. Copy an image and look at it before shipping a palette edit.
 */
export const CLUSTERS = {
  technical: {
    label: "Technical",
    color: "#756085",
    chartBg: "#cdbdd8",
    surfaceBg: "#EEE9F2",
    textColor: "#756085",
    badgeBg: "#c4b5d0",
    badgeText: "#3f3549",
  },
  product: {
    label: "Product",
    color: "#b8653a",
    chartBg: "#f5b39d",
    surfaceBg: "#FCE6DE",
    textColor: "#b8653a",
    badgeBg: "#e8b09a",
    badgeText: "#5c2e14",
  },
  operational: {
    label: "Operational",
    color: "#4d7356",
    chartBg: "#bddbb5",
    surfaceBg: "#E9F3E6",
    textColor: "#4d7356",
    badgeBg: "#b0cdb0",
    badgeText: "#1f3d28",
  },
};

/**
 * NO `getClusterSurfaceBg` / `getClusterSurfaceHoverBg` HELPERS ANY MORE. They took a cluster's saturated
 * `color` and appended `55` / `77` alpha to derive the card tint from it, which is exactly the coupling
 * `surfaceBg` exists to break: the tint could not be tuned without moving the colour that paints the chart,
 * and being translucent it also shifted whenever the page background changed.
 *
 * Read `CLUSTERS[id].surfaceBg` directly instead. For the hover step, mix toward the cluster's own colour —
 * `color-mix(in srgb, ${color} 12%, ${surfaceBg})`, as CompetencyMatrix does. NOT a black overlay: washing
 * black over these desaturates all three toward the same grey instead of each going deeper in its own hue.
 */

/**
 * The single chart-axis order and form-cluster grouping (ids reference {@link PILLARS}).
 * There is one pillar layout for the whole app; the FE/BE distinction is now a purely cosmetic
 * badge (see {@link TRACK_BADGE_OPTIONS}), not a different pillar set.
 * To drop a pillar: remove its id from `PILLAR_ORDER` and the cluster lists.
 */
export const PILLAR_ORDER = ["coding", "architecture", "ai", "process", "ownership", "communication", "productSense", "uiUx", "domainLogic"];

export const PILLAR_GROUPS = [
  { id: "technical", pillars: ["coding", "domainLogic", "architecture", "ai"] },
  { id: "product", pillars: ["uiUx", "productSense"] },
  { id: "operational", pillars: ["process", "communication", "ownership"] },
];

/**
 * Selectable "attached badge" options for a profile — a cosmetic label decoupled from the pillar
 * layout. `none` = no badge. Append here (plus a {@link TRACK_BADGE_UI} entry) to add a future badge.
 */
export const TRACK_BADGE_OPTIONS = ["none", "fe", "be", "fs"];

export const TRACK_BADGE_UI = {
  none: {
    shortLabel: "—",
    label: "No badge",
    pillClass: "",
  },
  fe: {
    shortLabel: "FE",
    label: "Frontend",
    pillClass: "bg-track-fe text-track-fe-foreground",
  },
  be: {
    shortLabel: "BE",
    label: "Backend",
    pillClass: "bg-track-be text-track-be-foreground",
  },
  fs: {
    shortLabel: "FS",
    label: "Fullstack",
    pillClass: "bg-track-fs text-track-fs-foreground",
  },
};

/**
 * Max characters in a profile name, enforced at the input and when parsing to canonical state so every write
 * path stays bounded.
 *
 * A sanity bound on stored data, NOT a layout constraint: the title truncates in the middle by measurement
 * (see useMiddleEllipsis), so fitting is enforced where it can be observed. It was briefly tuned to what fit
 * on one line, which a character budget cannot express when capitals are twice the width of lowercase.
 *
 * 50 leaves room for the `Copy of ` prefix duplication prepends (useAppStore.duplicateDraft slices to this).
 */
export const MAX_PROFILE_NAME_LENGTH = 50;

/** Pillar ids persisted in profiles (missing keys default on load). */
export const CANONICAL_PILLAR_IDS = [...new Set(PILLAR_ORDER)];

/** A profile's attached badge. Any listed option is kept; everything else (incl. legacy/absent) is `none`. */
export function normalizeAttachedBadge(value) {
  return TRACK_BADGE_OPTIONS.includes(value) ? value : "none";
}

export function getPillarOrder() {
  return PILLAR_ORDER;
}

export const PILLAR_COUNT = 9;

export function getPillarGroupOrder() {
  return PILLAR_GROUPS;
}

export function getPillarLabel(pillarId) {
  return PILLARS[pillarId]?.label ?? "";
}

/**
 * Pillar label with both the leading emoji and the body-part metaphor in parentheses dropped — e.g.
 * "Domain Logic" from "👃 Domain Logic (Nose)". Used where the organ name would be repetitive
 * (the competency-matrix cards); the emoji + parenthetical are introduced once in the Section I
 * pillar grid.
 */
export function getPillarLabelWithoutOrgan(pillarId) {
  return getPillarLabel(pillarId)
    .replace(/^\S+\s+/, "")
    .replace(/\s*\([^)]*\)\s*$/, "");
}

/**
 * Chart axis labels omit the organ name in parentheses (e.g. "🤲 Coding" not "🤲 Coding (Hands)").
 * They also strip emoji variation selectors (U+FE0F): the only pillar emoji that carries one is
 * 🗣️ Communication, and mobile Safari's canvas mis-measures/-anchors that grapheme cluster, shifting
 * just that one label. Stripping it on the canvas labels keeps every axis rendering consistently.
 * (The form labels keep the variation selector — DOM text renders it fine.)
 */
function getChartPillarLabel(pillarId) {
  return getPillarLabel(pillarId)
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\uFE0F/g, "");
}

/**
 * True for axes sitting on the left half of the radar (excluding the top/bottom cardinals).
 * Axis 0 is at 12 o'clock and steps clockwise, so cos(angle) < ~0 marks the left side; the
 * -0.25 threshold keeps the top (coding) and bottom axes treated as centered.
 */
function isLeftSideAxis(index, count) {
  const rad = ((360 / count) * index - 90) * (Math.PI / 180);
  return Math.cos(rad) < -0.25;
}

/**
 * Move a label's leading emoji to the trailing position for left-side axes, so on the left
 * half — where Chart.js right-aligns the text toward the radar — the emoji sits closest to the
 * centre (mirroring the right side). Cardinal/right axes keep the emoji leading.
 */
function orientChartPillarLabel(label, index, count) {
  if (!isLeftSideAxis(index, count)) {
    return label;
  }
  const m = label.match(/^(?<lead>\S+)\s+(?<rest>.*)$/u);
  return m ? `${m.groups.rest} ${m.groups.lead}` : label;
}

export function getChartLabels() {
  const order = getPillarOrder();
  return order.map((id, i) => orientChartPillarLabel(getChartPillarLabel(id), i, order.length));
}

/** Longest label — reserved on the last axis so radar padding stays stable. */
function getChartLayoutReservedLabel() {
  return getPillarOrder().reduce((longest, id) => {
    const label = getChartPillarLabel(id);
    return label.length > longest.length ? label : longest;
  }, "");
}

export function getChartLayoutLabels() {
  const order = getPillarOrder();
  const reserved = getChartLayoutReservedLabel();
  const lastId = order.at(-1);
  return order.map((id, i) => (id === lastId ? reserved : orientChartPillarLabel(getChartPillarLabel(id), i, order.length)));
}

/** About/export charts — text-only pillar names (no emoji). */
export function getPlainChartPillarLabel(pillarId) {
  return getChartPillarLabel(pillarId).replace(/^[^\s]+\s+/, "");
}

export function getPlainChartLabels() {
  return getPillarOrder().map((id) => getPlainChartPillarLabel(id));
}

function getPlainChartLayoutReservedLabel() {
  return getPillarOrder().reduce((longest, id) => {
    const label = getPlainChartPillarLabel(id);
    return label.length > longest.length ? label : longest;
  }, "");
}

export function getPlainChartLayoutLabels() {
  const order = getPillarOrder();
  const reserved = getPlainChartLayoutReservedLabel();
  const lastId = order.at(-1);
  return order.map((id) => (id === lastId ? reserved : getPlainChartPillarLabel(id)));
}

/** Emoji-only pillar label — the leading emoji, text dropped (variation selectors stripped). */
export function getEmojiChartPillarLabel(pillarId) {
  const m = getChartPillarLabel(pillarId).match(/^(?<emoji>\S+)/u);
  return m ? m.groups.emoji : "";
}

export function getEmojiChartLabels() {
  return getPillarOrder().map((id) => getEmojiChartPillarLabel(id));
}

function buildPillarRef(pillarId) {
  const order = getPillarOrder();
  return {
    id: pillarId,
    index: order.indexOf(pillarId),
    label: getPillarLabel(pillarId),
  };
}

export function getPillarGroups() {
  return getPillarGroupOrder().map(({ id, pillars }) => ({
    id,
    title: CLUSTERS[id].label,
    pillars: pillars.map((pillarId) => buildPillarRef(pillarId)),
  }));
}

export function getPillarIdByIndex(index) {
  return getPillarOrder()[index] ?? null;
}

/** Cluster id a pillar belongs to (null if none). */
export function getClusterIdForPillar(pillarId) {
  return getPillarGroupOrder().find((group) => group.pillars.includes(pillarId))?.id ?? null;
}

/**
 * Per-axis cluster text colors, positionally aligned with the chart's label array (index i →
 * pillar `getPillarOrder()[i]`). Same palette the poster uses for pillar names
 * (`CLUSTERS[cluster].textColor`). Axes with no cluster fall back to `null`.
 */
export function getPillarClusterLabelColors() {
  return getPillarOrder().map((id) => {
    const clusterId = getClusterIdForPillar(id);
    return clusterId ? CLUSTERS[clusterId].textColor : null;
  });
}
