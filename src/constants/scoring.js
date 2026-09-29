export const LEVEL_STEP = 0.5;
export const DEFAULT_PILLAR_LEVEL = 2;

/**
 * Career tracks for the stage gate. Key pillars overlap between tracks on purpose; a track's support set is
 * every pillar not in its key set. Object order is the final tie-break. Mirrors the theory tab's
 * CAREER_TRACK_PROFILES key pillars.
 */
export const TRACKS = {
  deepTechnical: { label: "Deep Technical", keyPillars: ["coding", "domainLogic", "architecture", "ai"] },
  productFocused: { label: "Product-Focused", keyPillars: ["domainLogic", "uiUx", "productSense", "communication"] },
  peopleDelivery: { label: "People & Delivery", keyPillars: ["productSense", "process", "communication", "ownership"] },
};

/** AI Leverage is good to have, so a low AI score never caps the stage through the lowest-pillar floor. */
export const MIN_PILLAR_EXCLUDED = ["ai"];

/** Tracks fork at S3; below it the matched track is only the tie-break default, so it is not shown. */
export const TRACK_FORK_STAGE = "S3";

const STAGE_THRESHOLDS = {
  S5: { keyMean: 4.5, supportMean: 3.3, minPillar: 1.5 },
  S4: { keyMean: 3.5, supportMean: 2.5, minPillar: 1.0 },
  S3: { keyMean: 2.6, supportMean: 2.0, minPillar: 0.5 },
  S2: { keyMean: 1.6, supportMean: 1.2, minPillar: null },
};

/** Per track, per stage (S5 → S2). S1 has no requirements. `minPillar: null` always passes. */
export const CAREER_STAGE_REQUIREMENTS = Object.fromEntries(Object.keys(TRACKS).map((id) => [id, STAGE_THRESHOLDS]));

export const CAREER_STAGE_BANDS = [
  { code: "S1", role: "Junior" },
  { code: "S2", role: "Mid" },
  { code: "S3", role: "Senior" },
  { code: "S4", role: "Lead/Staff" },
  { code: "S5", role: "Principal" },
];
