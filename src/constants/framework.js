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
 * One slot per job: `chartBg` fills the radar wedges and the legend swatch naming them (keep the two equal),
 * `surfaceBg` is card backgrounds, `bezel` is card borders and left edges (the brightest, most saturated
 * tone), `midtone` is every coloured text run — titles, badges, chip text and rings, chart pillar labels —
 * sitting a step below `bezel` so it stays legible on a light surface.
 * All are static hex, not derived at render, so the theory tab, tool tab and poster draw from one source.
 * See docs/DECISIONS.md#cluster-colour-slots before collapsing any two of these back into one value.
 */
export const CLUSTERS = {
  technical: {
    label: "Technical",
    chartBg: "#cdbdd8",
    surfaceBg: "#EEE9F2",
    bezel: "#9782A8",
    midtone: "#7D688D",
  },
  product: {
    label: "Product",
    chartBg: "#f5b39d",
    surfaceBg: "#FCE6DE",
    bezel: "#DF885D",
    midtone: "#C87348",
  },
  operational: {
    label: "Operational",
    chartBg: "#bddbb5",
    surfaceBg: "#E9F3E6",
    bezel: "#6E9577",
    midtone: "#557B5E",
  },
};

/**
 * The single chart-axis order and form-cluster grouping (ids reference {@link PILLARS}).
 * There is one pillar layout for the whole app; the FE/BE distinction is now a purely cosmetic
 * badge (see {@link TRACK_BADGE_OPTIONS}), not a different pillar set.
 * To drop a pillar: remove its id from `PILLAR_ORDER` and the cluster lists.
 *
 * REORDERING IS SAFE — everything keys off pillar id, not position — but check the cluster wedges
 * after. A cluster's pillars need not be contiguous here (`technical` already wraps: indices 0-2 plus
 * 8), and `sortClusterArc` in chart/plugins.js is what resolves that into one arc.
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

/** A profile's attached badge. Any listed option is kept; everything else (incl. legacy/absent) is `none`. */
export function normalizeAttachedBadge(value) {
  return TRACK_BADGE_OPTIONS.includes(value) ? value : "none";
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
 * Label split into its three parts — leading emoji, pillar name, "(Organ)" metaphor — so the form
 * can space and style each one. Missing parts come back as "".
 */
export function splitPillarLabelParts(pillarId) {
  const label = getPillarLabel(pillarId);
  const m = label.match(/^(?<emoji>\S+)?\s*(?<name>.*?)\s*(?<organ>\([^)]*\))?\s*$/u);
  return {
    emoji: m?.groups.emoji ?? "",
    name: m?.groups.name ?? label,
    organ: m?.groups.organ ?? "",
  };
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
  return PILLAR_ORDER.map((id, i) => orientChartPillarLabel(getChartPillarLabel(id), i, PILLAR_ORDER.length));
}

/** Longest label — reserved on the last axis so radar padding stays stable. */
function getChartLayoutReservedLabel() {
  return PILLAR_ORDER.reduce((longest, id) => {
    const label = getChartPillarLabel(id);
    return label.length > longest.length ? label : longest;
  }, "");
}

export function getChartLayoutLabels() {
  const reserved = getChartLayoutReservedLabel();
  const lastId = PILLAR_ORDER.at(-1);
  return PILLAR_ORDER.map((id, i) => (id === lastId ? reserved : orientChartPillarLabel(getChartPillarLabel(id), i, PILLAR_ORDER.length)));
}

/** About/export charts — text-only pillar names (no emoji). */
export function getPlainChartPillarLabel(pillarId) {
  return getChartPillarLabel(pillarId).replace(/^[^\s]+\s+/, "");
}

export function getPlainChartLabels() {
  return PILLAR_ORDER.map((id) => getPlainChartPillarLabel(id));
}

function getPlainChartLayoutReservedLabel() {
  return PILLAR_ORDER.reduce((longest, id) => {
    const label = getPlainChartPillarLabel(id);
    return label.length > longest.length ? label : longest;
  }, "");
}

export function getPlainChartLayoutLabels() {
  const reserved = getPlainChartLayoutReservedLabel();
  const lastId = PILLAR_ORDER.at(-1);
  return PILLAR_ORDER.map((id) => (id === lastId ? reserved : getPlainChartPillarLabel(id)));
}

/** Emoji-only pillar label — the leading emoji, text dropped (variation selectors stripped). */
export function getEmojiChartPillarLabel(pillarId) {
  const m = getChartPillarLabel(pillarId).match(/^(?<emoji>\S+)/u);
  return m ? m.groups.emoji : "";
}

export function getEmojiChartLabels() {
  return PILLAR_ORDER.map((id) => getEmojiChartPillarLabel(id));
}

function buildPillarRef(pillarId) {
  return {
    id: pillarId,
    index: PILLAR_ORDER.indexOf(pillarId),
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
  return PILLAR_ORDER[index] ?? null;
}

/** Cluster id a pillar belongs to (null if none). */
export function getClusterIdForPillar(pillarId) {
  return getPillarGroupOrder().find((group) => group.pillars.includes(pillarId))?.id ?? null;
}

/**
 * Per-axis cluster text colors, positionally aligned with the chart's label array (index i →
 * pillar `PILLAR_ORDER[i]`). Same palette the poster uses for pillar names
 * (`CLUSTERS[cluster].midtone`). Axes with no cluster fall back to `null`.
 */
export function getPillarClusterLabelColors() {
  return PILLAR_ORDER.map((id) => {
    const clusterId = getClusterIdForPillar(id);
    return clusterId ? CLUSTERS[clusterId].midtone : null;
  });
}
