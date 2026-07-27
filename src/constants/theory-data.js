import { CLUSTERS, getPillarGroups, getPillarLabel, getPillarLabelWithoutOrgan, getPillarOrder, getPlainChartPillarLabel } from "@/constants";
import { COMPETENCY_LEVEL_COPY } from "@/constants/competency-matrix-data";

function buildLevels(scores) {
  return getPillarOrder().map((id) => scores[id] ?? 2.5);
}

/**
 * The three cumulative skill tiers introduced in framework v4.0 (Foundational → Core → Advanced).
 * The matrix cards render these as three labelled bullets; the Section I pillar grid flattens them
 * back into one prose line (see `flattenFocusTiers`) to keep the nine cards compact.
 *
 * `endPct` is how far the band reaches across the L1-L5 track (0% = left edge of L1, 100% = right
 * edge of L5) and is the only authored GEOMETRY. Each band's start is derived: a tier begins at the
 * MIDPOINT of the one before it, so the bands chain off each other rather than snapping to the level
 * columns. That staggered overlap is the point — the tiers are cumulative, and you start picking up
 * the next one about halfway through the current. See `getSkillTierBands`.
 *
 *     L1        L2        L3        L4        L5
 *     |█████████████|                              Foundational    0% →  30%
 *           ^ mid (15%)
 *           |███████████████████████|              Core           15% →  64%
 *                        ^ mid (39.5%)
 *                        |█████████████████████|   Advanced     39.5% → 100%
 *
 * `bandClass` is the tier's fill/border/text tint, shared by the bands here and the pills labelling
 * each tier in the competency matrix, so the two places tiers surface read as one system.
 */
// The border is the tier's DARKEST shade at very low alpha, not a light shade at high alpha. A light
// tint composites to a brighter, higher-chroma line than the fill it outlines (green-200/35 over
// green-100 lands on a neon mint); the same hue's -900 at 20% instead darkens the fill slightly, so
// the edge reads as a soft shadow that recedes. It exists only to keep the pill from dissolving into
// the cluster surface tint behind it. Foundational uses `green`, not `emerald`, which goes neon
// against those tints.
export const SKILL_TIERS = [
  { id: "foundational", label: "Foundational", endPct: 30, bandClass: "border border-green-900/20 bg-green-100/80 text-green-900" },
  { id: "core", label: "Core", endPct: 64, bandClass: "border border-amber-900/20 bg-amber-100/80 text-amber-900" },
  { id: "advanced", label: "Advanced", endPct: 100, bandClass: "border border-rose-900/20 bg-rose-100/80 text-rose-900" },
];

/**
 * Resolve {@link SKILL_TIERS} into drawable bands, deriving each `startPct` from the previous band's
 * midpoint (the first starts at 0).
 */
export function getSkillTierBands() {
  let startPct = 0;

  return SKILL_TIERS.map((tier) => {
    const band = { ...tier, startPct, widthPct: tier.endPct - startPct };
    startPct = (startPct + tier.endPct) / 2;
    return band;
  });
}

export const SKILL_TIERS_CAPTION =
  "Within every pillar, the focus areas are not learned all at once. They cluster into three cumulative tiers that follow how you grow as you deepen a pillar.";

const PILLAR_ABOUT_COPY = {
  coding: {
    focusTiers: {
      foundational: "Language Proficiency, Naming Convention, Code Navigation, Data Structures",
      core: "Debugging, Error Handling, Design Patterns, Refactoring, Coupling & Cohesion, Testing Discipline",
      advanced: "Concurrency, Algorithms & Problem-Solving",
    },
    signatureQuestion: "Am I writing code that others can easily read and modify?",
  },
  domainLogic: {
    focusTiers: {
      foundational: "Workflow Integrity, Intent Comprehension, Completeness",
      core: "Domain Edge-Cases, Data Integrity, Business-Rule Verification, Lifecycle & Status Flow",
      advanced: "Logic Guardrails, Loophole Mitigation, Risk & Complexity Foresight",
    },
    signatureQuestion: "Am I bulletproofing the logic against hidden edge cases?",
  },
  architecture: {
    focusTiers: {
      foundational: "Framework Proficiency",
      core: "Data Modeling, State & Storage, API Design, Integration & Research, Performance",
      advanced: "Build Tooling, System Boundaries, Architectural Patterns, Secure Design, Resilience Design, Scalability, Observability",
    },
    signatureQuestion: "Am I designing systems that perform, scale, and survive?",
  },
  ai: {
    focusTiers: {
      foundational: "Effective Prompting, Secure AI Hygiene, Model & Tool Selection",
      core: "Logic Verification, Cost & Token Awareness, AI Output Review, Context Management",
      advanced: "Agentic Workflows, AI Governance, AI Enablement",
    },
    signatureQuestion: "Am I directing AI to safely multiply engineering output?",
  },
  uiUx: {
    focusTiers: {
      foundational: "Visual Fidelity, Detail Accuracy, Component Reuse",
      core: "Responsive Layout, Design System Alignment, Accessibility, UI Improvisation, User Empathy, UX Writing",
      advanced: "Perceived Performance, Interaction Design",
    },
    signatureQuestion: "Am I creating an intuitive and frictionless interface?",
    note: "Backend engineers touch this pillar less often, mainly through internal tools they build and by sensing how their work affects the end user's experience. A flatter UI/UX corner is a normal backend shape, not a gap to fix.",
  },
  productSense: {
    focusTiers: {
      foundational: "Requirement Depth, Scope Sizing, User Journey Flaws",
      core: "Technical Shortcuts, Feedback & Data Literacy, Market Awareness, Business Context Awareness",
      advanced: "Prioritization & Trade-offs, Product Judgement, Commercial Instinct",
    },
    signatureQuestion: "Am I ensuring we actually build the right thing?",
  },
  process: {
    focusTiers: {
      foundational: "SOP Compliance, Git Workflow",
      core: "Codebase Traffic, Code Review Practice, Dependencies & Blockers, Release Management",
      advanced: "Process Automation, Team Efficiency",
    },
    signatureQuestion: "Am I making it faster and easier for the team to ship?",
  },
  communication: {
    focusTiers: {
      foundational: "Communication Clarity, Active Listening, Stakeholder Reporting",
      core: "Technical Translation, Presentation & Speaking Up, Technical Documentation, Feedback Exchange",
      advanced: "Cross-Team Alignment, Conflict Mediation",
    },
    signatureQuestion: "Am I sharing the right context with the right people?",
  },
  ownership: {
    focusTiers: {
      foundational: "Reliability, Drive & Follow-Through, Commitment Accountability",
      core: "Effort Estimation, BAU Domain Fluency, Incident Resolution",
      advanced: "Initiative & De-risking, Codebase Health, Knowledge Resilience",
    },
    signatureQuestion: "Am I ensuring this crosses the finish line?",
  },
};

/** Tier map → one comma-separated line, foundational → advanced (Section I's compact form). */
function flattenFocusTiers(focusTiers) {
  return SKILL_TIERS.map(({ id }) => focusTiers?.[id])
    .filter(Boolean)
    .join(", ");
}

const CLUSTER_ABOUT_META = {
  technical: { subtitle: '(The "How")' },
  product: { subtitle: '(The "What" & "Why")' },
  operational: { subtitle: '(The "Force Multipliers")' },
};

export const PILLARS_SECTION_INTRO =
  "This framework breaks down a software engineer's real-world competencies into 9 distinct pillars. Each pillar lists its focus areas, sorted from foundational to advanced, and ends with a signature question: a quick self-check you can ask yourself in daily work.";

function buildPillarClusterGroups() {
  return getPillarGroups().map(({ id, title, pillars }) => ({
    id,
    label: title,
    subtitle: CLUSTER_ABOUT_META[id]?.subtitle ?? "",
    color: CLUSTERS[id].color,
    textColor: CLUSTERS[id].textColor,
    pillars: pillars.map(({ id: pillarId }) => {
      const focusTiers = PILLAR_ABOUT_COPY[pillarId]?.focusTiers ?? {};
      return {
        id: pillarId,
        pillar: getPillarLabel(pillarId),
        // Both shapes ship: `focusTiers` for the matrix's three labelled bullets, `focusSummary` for
        // the Section I grid's single prose line.
        focusTiers,
        focusSummary: flattenFocusTiers(focusTiers),
        signatureQuestion: PILLAR_ABOUT_COPY[pillarId]?.signatureQuestion ?? "",
        note: PILLAR_ABOUT_COPY[pillarId]?.note ?? "",
      };
    }),
  }));
}

export const PILLAR_CLUSTER_GROUPS = buildPillarClusterGroups();

export const PILLAR_DEFINITIONS = PILLAR_CLUSTER_GROUPS.flatMap(({ label, subtitle, pillars }) =>
  pillars.map((pillar) => ({
    ...pillar,
    cluster: label,
    clusterSubtitle: subtitle,
  })),
);

export const SENIORITY_SECTION_INTRO =
  "Each pillar is rated L1-L5. This measures your proficiency within that one pillar, from following instructions (L1) to shaping direction (L5). A single pillar level does not determine your overall seniority. Your actual engineering seniority is indicated by your whole chart shape.";

/**
 * `phase` is the full quality/identity pair (Proficiency Levels section); `term` is the identity word
 * shown where space is tight (matrix headers).
 *
 * Deliberately carries NO role equivalent (Junior/Mid/Senior/…). Framework v4.0 decoupled per-pillar
 * proficiency from career seniority: a level here rates one pillar, and overall seniority is read
 * from the whole chart shape, not from any single axis. Pinning a role title to each level asserts
 * the mapping the rewrite removed, so don't reintroduce one.
 */
export const SENIORITY_LEVEL_DEFINITIONS = [
  {
    code: "L1",
    phase: "Adherence / Learner",
    term: "Learner",
    description: "Can follow clear instructions, match existing patterns, and execute with high support.",
  },
  {
    code: "L2",
    phase: "Autonomy / Practitioner",
    term: "Practitioner",
    description: "Can complete defined tasks and workflows end-to-end independently.",
  },
  {
    code: "L3",
    phase: "Complexity / Expert",
    term: "Expert",
    description: "Can navigate messy, complex problems alone while meeting standard expectations.",
  },
  {
    code: "L4",
    phase: "Influence / Mentor",
    term: "Mentor",
    description: "Can raise the quality bar for others, resolve cross-team friction, mentor peers, and hold the team to the foundations below them.",
  },
  {
    code: "L5",
    phase: "Impact / Strategist",
    term: "Strategist",
    description:
      "Can navigate high ambiguity, solve systemic risks, shape direction beyond the team, and set the foundations the wider company inherits.",
  },
];

export const SENIORITY_LEVELS = SENIORITY_LEVEL_DEFINITIONS;

function buildCompetencyMatrix() {
  let order = 0;

  return PILLAR_CLUSTER_GROUPS.flatMap((group) =>
    group.pillars.map((pillar) => {
      order += 1;
      return {
        order,
        pillarId: pillar.id,
        // Matrix cards drop the body-part parenthetical (kept in the Section I pillar grid) to avoid
        // repeating it — e.g. "👃 Domain Logic" here vs. "👃 Domain Logic (Nose)" in the intro.
        pillarName: getPillarLabelWithoutOrgan(pillar.id),
        focusTiers: pillar.focusTiers,
        note: pillar.note,
        color: group.color,
        textColor: group.textColor,
        clusterLabel: group.label,
        levels: COMPETENCY_LEVEL_COPY[pillar.id],
      };
    }),
  );
}

export const COMPETENCY_MATRIX = buildCompetencyMatrix();

const ABOUT_PILLAR_SEQUENCE = getPillarGroups().flatMap(({ pillars }) => pillars.map(({ id }) => id));

const KEY_PILLAR_RANK = new Map(ABOUT_PILLAR_SEQUENCE.map((id, index) => [getPlainChartPillarLabel(id), index]));

/** Sort career-track key pillar badges to match the documentation pillar order. */
export function sortKeyFocusPillars(pillarNames) {
  return [...pillarNames].sort((a, b) => (KEY_PILLAR_RANK.get(a) ?? Number.MAX_SAFE_INTEGER) - (KEY_PILLAR_RANK.get(b) ?? Number.MAX_SAFE_INTEGER));
}

export const CAREER_TRACKS_SECTION_INTRO = "";

export const JUNIOR_TO_SENIOR = {
  title: "From Junior to Senior (L1–L3)",
  intro:
    "At L1 and L2, your title is simply Software Engineer, whatever your daily domain (frontend, backend, fullstack). The domain shapes which pillars grow first, but it does not decide your career track. That choice comes at L3.",
};

export const FOUNDATIONAL_PHASE = {
  title: "Building the Foundation",
  intro:
    "Across L1–L3 the whole chart grows fairly evenly, with the Technical cluster leading. The shape stays balanced: you're widening the base, not specializing yet.",
  technicalPillars: ["Coding", "UI/UX", "Domain Logic", "Architecture"],
  stageCharts: [
    {
      id: "junior",
      title: "Junior",
      role: { level: "L1", title: "Junior Software Engineer" },
      levels: buildLevels({
        coding: 1,
        domainLogic: 1,
        architecture: 1,
        ai: 1,
        uiUx: 1,
        productSense: 1,
        process: 1,
        communication: 1,
        ownership: 1,
      }),
    },
    {
      id: "mid",
      title: "Mid",
      role: { level: "L2", title: "Mid Software Engineer" },
      levels: buildLevels({
        coding: 2,
        domainLogic: 2,
        architecture: 2,
        ai: 1.5,
        uiUx: 1.5,
        productSense: 1.5,
        process: 1.5,
        communication: 1.5,
        ownership: 1.5,
      }),
    },
    {
      id: "senior",
      title: "Senior",
      role: { level: "L3", title: "Senior Software Engineer" },
      levels: buildLevels({
        coding: 3,
        domainLogic: 3,
        architecture: 3,
        ai: 2,
        uiUx: 2,
        productSense: 2.5,
        process: 2.5,
        communication: 2.5,
        ownership: 2.5,
      }),
    },
  ],
};

export const SENIOR_FORK = {
  title: "The Senior Fork (L3)",
  intro: "At L3, your career path forks into three tracks, based on where you drive the most impact, not on your tech stack.",
};

export const CAREER_TRACK_PROFILES = [
  {
    id: "deep-technical",
    name: "Deep Technical",
    chartTitle: "e.g. Staff Engineer (BE)",
    keyFocusPillars: ["Coding", "Domain Logic", "Architecture", "AI Leverage"],
    summary:
      "Masters system health and engineering excellence: solving complex architectural problems as a technical force-multiplier, intentionally bypassing people management. Most commonly entered from backend.",
    roleLevels: [
      { level: "L3", title: "Senior Software Engineer" },
      { level: "L4", title: "Staff Software Engineer" },
      { level: "L5", title: "Principal Software Engineer / Solution Architect" },
      { level: "L6", title: "Technical Fellow" },
    ],
    levels: buildLevels({
      coding: 4,
      domainLogic: 4,
      architecture: 4,
      ai: 2.5,
      uiUx: 2.5,
      productSense: 3,
      process: 3,
      communication: 3.5,
      ownership: 3.5,
    }),
  },
  {
    id: "product-focused",
    name: "Product-Focused",
    chartTitle: "e.g. Staff Engineer (FE)",
    keyFocusPillars: ["Domain Logic", "UI/UX", "Product Sense", "Communication"],
    // Chip display order (overrides doc-order sort): Product Sense before UI/UX keeps the four chips
    // to two rows and matches the poster.
    chipOrder: ["Domain Logic", "Product Sense", "UI/UX", "Communication"],
    summary:
      "Masters the user journey and product judgment: bridging code and product strategy to make sure the right thing gets built. Most commonly entered from frontend.",
    roleLevels: [
      { level: "L3", title: "Senior Product Engineer" },
      { level: "L4", title: "Staff Product Engineer" },
      { level: "L5", title: "Principal Product Engineer / Product Architect" },
      { level: "L6", title: "Chief Architect" },
    ],
    levels: buildLevels({
      coding: 3.5,
      domainLogic: 3.5,
      architecture: 3,
      ai: 2.5,
      uiUx: 4,
      productSense: 4,
      process: 3,
      communication: 3.5,
      ownership: 3.5,
    }),
  },
  {
    id: "people-delivery",
    name: "People & Delivery",
    chartTitle: "e.g. Team Lead",
    keyFocusPillars: ["Product Sense", "Process", "Communication", "Ownership"],
    summary:
      "Masters team speed and alignment: transitioning from execution into management to unblock teams, streamline processes, and deliver high-value initiatives. Entered from either stack.",
    roleLevels: [
      { level: "L3", title: "Senior Engineer (Track 1/2)" },
      { level: "L4", title: "Team Lead" },
      { level: "L5", title: "Engineering Manager" },
      { level: "L6", title: "Head of Engineering / VP" },
      { level: "L7", title: "Chief Technology Officer" },
    ],
    levels: buildLevels({
      coding: 3.5,
      domainLogic: 3.5,
      architecture: 3,
      ai: 2.5,
      uiUx: 3,
      productSense: 2.5,
      process: 4,
      communication: 4,
      ownership: 4,
    }),
  },
];

export const CLUSTER_COLORS = CLUSTERS;
