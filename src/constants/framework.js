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

export const CLUSTERS = {
  technical: { label: "Technical", color: "#cdbdd8", textColor: "#756085", badgeBg: "#c4b5d0", badgeText: "#3f3549" },
  product: { label: "Product", color: "#f5b39d", textColor: "#b8653a", badgeBg: "#e8b09a", badgeText: "#5c2e14" },
  operational: { label: "Operational", color: "#bddbb5", textColor: "#4d7356", badgeBg: "#b0cdb0", badgeText: "#1f3d28" },
};

/** Cluster tint for cards, form, chips — hex alpha suffix */
export function getClusterSurfaceBg(color) {
  return `${color}55`;
}

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
export const TRACK_BADGE_OPTIONS = ["none", "fe", "be"];

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
};

/** Pillar ids persisted in profiles (missing keys default on load). */
export const CANONICAL_PILLAR_IDS = [...new Set(PILLAR_ORDER)];

/** A profile's attached badge. Explicit `fe`/`be` are kept; everything else (incl. legacy/absent) is `none`. */
export function normalizeAttachedBadge(value) {
  return value === "fe" || value === "be" ? value : "none";
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
