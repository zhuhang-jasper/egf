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
 * Per-track chart order and form clusters (ids reference {@link PILLARS}).
 * To drop a pillar from a track: remove its id from `pillarOrder` and cluster lists.
 */
export const TRACK_VARIANTS = ["fe", "be"];

export const TRACK_VARIANT_UI = {
  fe: {
    shortLabel: "FE",
    label: "Frontend",
    pillClass: "bg-track-fe text-track-fe-foreground",
    toggleActiveClass: "bg-background shadow-sm border border-border",
  },
  be: {
    shortLabel: "BE",
    label: "Backend",
    pillClass: "bg-track-be text-track-be-foreground",
    toggleActiveClass: "bg-background shadow-sm border border-border",
  },
};

export const TRACKS = {
  fe: {
    pillarOrder: ["coding", "architecture", "ai", "process", "ownership", "communication", "productSense", "uiUx", "domainLogic"],
    pillarGroups: [
      { id: "technical", pillars: ["coding", "domainLogic", "architecture", "ai"] },
      { id: "product", pillars: ["uiUx", "productSense"] },
      { id: "operational", pillars: ["process", "communication", "ownership"] },
    ],
  },
  be: {
    pillarOrder: ["coding", "architecture", "ai", "process", "ownership", "communication", "productSense", "domainLogic"],
    pillarGroups: [
      { id: "technical", pillars: ["coding", "domainLogic", "architecture", "ai"] },
      { id: "product", pillars: ["productSense"] },
      { id: "operational", pillars: ["process", "communication", "ownership"] },
    ],
  },
};

/** Pillar ids persisted in profiles (union of all track orders; missing keys default on load). */
export const CANONICAL_PILLAR_IDS = [...new Set(TRACK_VARIANTS.flatMap((track) => TRACKS[track].pillarOrder))];

/** Profiles/drafts without `trackVariant` are treated as front-end (FE). */
export function normalizeTrackVariant(value) {
  return value === "be" ? "be" : "fe";
}

export function getTrackConfig(trackVariant = "fe") {
  return TRACKS[normalizeTrackVariant(trackVariant)];
}

export function getPillarOrder(trackVariant = "fe") {
  return getTrackConfig(trackVariant).pillarOrder;
}

/** Default-track chart order — used where track is not yet available. */
export const PILLAR_ORDER = getPillarOrder("fe");

export const PILLAR_COUNT = 9;

export function getPillarGroupOrder(trackVariant = "fe") {
  return getTrackConfig(trackVariant).pillarGroups;
}

export function getPillarLabel(pillarId) {
  return PILLARS[pillarId]?.label ?? "";
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
  const m = label.match(/^(\S+)\s+(.*)$/u);
  return m ? `${m[2]} ${m[1]}` : label;
}

export function getChartLabels(trackVariant = "fe") {
  const order = getPillarOrder(trackVariant);
  return order.map((id, i) => orientChartPillarLabel(getChartPillarLabel(id), i, order.length));
}

/** Longest label on the active track — reserved on the last axis so radar padding stays stable. */
function getChartLayoutReservedLabel(trackVariant = "fe") {
  return getPillarOrder(trackVariant).reduce((longest, id) => {
    const label = getChartPillarLabel(id);
    return label.length > longest.length ? label : longest;
  }, "");
}

export function getChartLayoutLabels(trackVariant = "fe") {
  const order = getPillarOrder(trackVariant);
  const reserved = getChartLayoutReservedLabel(trackVariant);
  const lastId = order.at(-1);
  return order.map((id, i) =>
    id === lastId ? reserved : orientChartPillarLabel(getChartPillarLabel(id), i, order.length),
  );
}

/** About/export charts — text-only pillar names (no emoji). */
export function getPlainChartPillarLabel(pillarId) {
  return getChartPillarLabel(pillarId).replace(/^[^\s]+\s+/, "");
}

export function getPlainChartLabels(trackVariant = "fe") {
  return getPillarOrder(trackVariant).map((id) => getPlainChartPillarLabel(id));
}

function getPlainChartLayoutReservedLabel(trackVariant = "fe") {
  return getPillarOrder(trackVariant).reduce((longest, id) => {
    const label = getPlainChartPillarLabel(id);
    return label.length > longest.length ? label : longest;
  }, "");
}

export function getPlainChartLayoutLabels(trackVariant = "fe") {
  const order = getPillarOrder(trackVariant);
  const reserved = getPlainChartLayoutReservedLabel(trackVariant);
  const lastId = order.at(-1);
  return order.map((id) => (id === lastId ? reserved : getPlainChartPillarLabel(id)));
}

function buildPillarRef(pillarId, trackVariant) {
  const order = getPillarOrder(trackVariant);
  return {
    id: pillarId,
    index: order.indexOf(pillarId),
    label: getPillarLabel(pillarId),
  };
}

export function getPillarGroups(trackVariant = "fe") {
  const track = normalizeTrackVariant(trackVariant);
  return getPillarGroupOrder(track).map(({ id, pillars }) => ({
    id,
    title: CLUSTERS[id].label,
    pillars: pillars.map((pillarId) => buildPillarRef(pillarId, track)),
  }));
}

export function getPillarIdByIndex(index, trackVariant = "fe") {
  return getPillarOrder(trackVariant)[index] ?? null;
}
