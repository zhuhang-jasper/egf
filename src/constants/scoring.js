export const LEVEL_STEP = 0.5;
export const HUMAN_STRENGTH_TOP_K = 3;
/** Mean of top ceil(n × ratio) pillars — breadth score (9→6, 8→6). */
export const BREADTH_TOP_RATIO = 2 / 3;
export const CAREER_PEAK_WEIGHT = 0.55;
export const CAREER_BREADTH_WEIGHT = 0.45;
export const DEFAULT_PILLAR_LEVEL = 3;
export const SENIORITY_LEVEL_COUNT = 5;

/** Core technical pillars for career floor (excludes AI — newer, role-dependent). */
export const TECHNICAL_FLOOR_PILLARS = ["coding", "domainLogic", "architecture"];

/**
 * Career level = highest band where peak, breadth, and cluster avgs all meet mins.
 * `clusters.technical` — coding + domain + architecture (AI excluded; see TECHNICAL_FLOOR_PILLARS).
 * `feClusters` — FE only (product/UI). Operational is not gated (L4→L5 growth lives there).
 *
 * Intended step feel: L1→L2 small · L2→L3 big · L3→L4 big · L4→L5 moderate.
 * L1 has no requirements (default). Evaluated L5 → L2 in code.
 */
export const CAREER_LEVEL_REQUIREMENTS = {
  L5: { peak: 4.6, breadth: 3.6, clusters: { technical: 3.0 }, feClusters: { product: 3.0 } },
  L4: { peak: 3.6, breadth: 3.1, clusters: { technical: 3.0 }, feClusters: { product: 2.5 } },
  L3: { peak: 2.6, breadth: 2.3, clusters: { technical: 2.5 }, feClusters: { product: 2.0 } },
  L2: { peak: 1.6, breadth: 1.5, clusters: { technical: 1.5 }, feClusters: { product: 1.5 } },
};

export const CAREER_LEVEL_BY_AVG_BAND = [
  { code: "L1", phase: "Adherence / Learning", role: "Junior" },
  { code: "L2", phase: "Practitioner / Autonomy", role: "Mid" },
  { code: "L3", phase: "Proficient / Complexity", role: "Senior" },
  { code: "L4", phase: "Influential", role: "Lead/Staff" },
  { code: "L5", phase: "Impact / Strategic", role: "Principal" },
];
