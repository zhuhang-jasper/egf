import { CLUSTERS, getPillarGroups, getPillarLabel, getPillarLabelWithoutOrgan, getPillarOrder, getPlainChartPillarLabel } from "@/constants";
import { COMPETENCY_LEVEL_COPY } from "@/constants/competency-matrix-data";
import { THEORY_SECTIONS } from "@/utils/theory-url";

/**
 * Heading + intro for each of the four Theory sections, keyed by the same ids the deep-link and
 * unseen-dot machinery uses (see `THEORY_SECTIONS`). ONE OBJECT rather than four loose constants
 * scattered beside the data they head: the tab's outline is then readable in one place, and a future
 * table of contents has a single source for the labels instead of scraping them out of JSX.
 *
 * THE HEADINGS ARE QUESTIONS, AND THEY KEEP THEIR NUMERALS. The question is what a reader actually
 * arrives with; the numeral is what the printed document and the changelog's prose bullets refer back
 * to. Both earn their place, so neither is dropped.
 *
 * II AND III ARE DELIBERATELY WORDED APART. "How do the 5 levels work" is the abstract scale; "what
 * does each level look like in practice" is that scale spelled out cell by cell. Phrased any closer
 * together the two collapse into the same question and the matrix stops looking like the payoff of
 * the section above it.
 *
 * `matrix` HAS NO INTRO, because the thing directly under the heading already introduces itself and a
 * paragraph above it would say so twice: the section is two blocks, each with its own lead-in
 * (`SKILL_TIERS_INTRO` above the tier diagram, then `COMPETENCY_MATRIX_INTRO` above the nine pillar
 * cards). A subtitle here would be introducing an introduction — and when the matrix lead-in did sit in
 * this slot, it described cards two blocks below and read as a caption for the diagram in between.
 *
 * `tracks` WAS ALSO INTRO-LESS on that reasoning, since it opens with the "From Junior to Senior"
 * subsection and its own framing (JUNIOR_TO_SENIOR). Its intro earns the slot by doing something that
 * framing does not: it disambiguates the S1-S5 notation the whole section is written in from the L1-L5
 * of Section II. That has to land before the first "S1-S3" the reader meets, which is JUNIOR_TO_SENIOR's
 * own title, so it cannot wait for the subsection to make the point in passing.
 *
 * TheoryContent spaces both headings to suit — see the notes at each.
 */
export const THEORY_SECTION_COPY = {
  [THEORY_SECTIONS.pillars]: {
    heading: "I. What are the 9 pillars?",
    intro:
      "This framework breaks down a software engineer's real-world competencies into 9 distinct pillars. Each pillar lists its focus areas, sorted from foundational to advanced, and ends with a signature question: a quick self-check you can ask yourself in daily work.",
  },
  [THEORY_SECTIONS.seniority]: {
    heading: "II. How do the 5 levels work?",
    intro:
      "Each pillar is rated L1-L5. This measures your proficiency within that one pillar, from following instructions (L1) to shaping direction (L5). A single pillar level does not set your seniority. Your career stage (S1-S5, see Section IV) shows in the whole chart shape, not in one axis.",
  },
  [THEORY_SECTIONS.matrix]: {
    heading: "III. What does each level look like in practice?",
    intro: "",
  },
  [THEORY_SECTIONS.tracks]: {
    heading: "IV. Where does this take your career?",
    intro: "Career stages are written S1-S5 to keep them separate from pillar levels L1-L5. S3 does not mean L3 in every pillar.",
  },
};

function buildLevels(scores) {
  return getPillarOrder().map((id) => scores[id] ?? 2.5);
}

/**
 * The three cumulative skill tiers introduced in framework v4.0 (Foundational → Core → Advanced).
 * The matrix cards render these as three labelled bullets; the Section I pillar grid flattens them
 * back into one prose line (see `flattenFocusTiers`) to keep the nine cards compact.
 *
 * `endPct` is how far the band reaches across the L1-L5 track (0% = left edge of L1, 100% = right
 * edge of L5). A band's start is normally derived — a tier begins at the MIDPOINT of the one before
 * it, so the bands chain off each other rather than snapping to the level columns. That staggered
 * overlap is the point: the tiers are cumulative, and you start picking up the next one about
 * halfway through the current. A tier may author its own `startPct` to break out of that chain; see
 * `getSkillTierBands`.
 *
 * These are APPROXIMATE by intent — "Foundational fades out somewhere mid-L2" — not exact fractions
 * of the ruler. The ruler is five equal 20% cells, so mid-L2 is 30% on the nose, but Foundational is
 * authored at 35%: the extra 5% is what keeps its label from truncating in the narrowest cards, and
 * it still reads as mid-L2. Prefer widening a band over shrinking its type if a label stops fitting.
 *
 *     L1        L2        L3        L4        L5
 *     |███████████████|                            Foundational    0% →  35%
 *            ^ mid (17.5%)
 *            |█████████████████████████|          Core         17.5% →  65%
 *                         |███████████████████|   Advanced     40.5% → 100%  (start pinned)
 *
 * Core's midpoint is 41.25%, but Advanced pins its start to 40.5% so the two stay independent:
 * how far Core carries you and when Advanced begins are separate claims about the framework.
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
  { id: "foundational", label: "Foundational", endPct: 35, bandClass: "border border-green-900/20 bg-green-100/80 text-green-900" },
  { id: "core", label: "Core", endPct: 65, bandClass: "border border-amber-900/20 bg-amber-100/80 text-amber-900" },
  // `startPct` pinned rather than derived. Core's midpoint is 41%, which would drift Advanced's left
  // edge rightward; 40.5% holds it where it was authored. The two claims are independent — how far
  // Core carries you, and when Advanced starts showing up — so moving one should not silently move
  // the other.
  { id: "advanced", label: "Advanced", startPct: 40.5, endPct: 100, bandClass: "border border-rose-900/20 bg-rose-100/80 text-rose-900" },
];

/**
 * Resolve {@link SKILL_TIERS} into drawable bands, deriving each `startPct` from the previous band's
 * midpoint (the first starts at 0).
 *
 * A tier may instead AUTHOR its own `startPct` to opt out of that chain, which decouples it from the
 * band before it — needed once a tier's `endPct` moves for reasons that shouldn't drag its successor
 * along. An authored start still seeds the midpoint for whatever follows, so the chain resumes from
 * the position actually drawn rather than the one that would have been derived.
 */
export function getSkillTierBands() {
  let derivedStartPct = 0;

  return SKILL_TIERS.map((tier) => {
    const startPct = tier.startPct ?? derivedStartPct;
    const band = { ...tier, startPct, widthPct: tier.endPct - startPct };
    derivedStartPct = (startPct + tier.endPct) / 2;
    return band;
  });
}

/**
 * Lead-in for the tier diagram, rendered ABOVE it (see TheoryContent). It was a caption below the bands,
 * where "Within every pillar…" arrived after the reader had already worked out three tiers and five levels
 * from the picture — defining a thing the eye had finished interpreting. Above, it lands in the order the
 * ideas actually build: tiers exist, then here is where they fall on the L1-L5 axis.
 *
 * It has to say "skill tiers" in full, because it is now the only place on the page that names the concept.
 * The diagram lost its "Skill Tiers" heading when this moved above it (two labels for one figure), the
 * matrix lead-in below does not mention tiers, and the pills on each pillar card read "Foundational" /
 * "Core" / "Advanced" rather than naming the set.
 */
export const SKILL_TIERS_INTRO =
  "Within every pillar, the focus areas are not learned all at once. They cluster into three cumulative skill tiers that follow how you grow as you deepen a pillar.";

/**
 * Caption INSIDE the tier card, below the bands. Unlike {@link SKILL_TIERS_INTRO}, which has to arrive
 * before the picture (it names the concept the picture is of), this one only makes sense after the eye
 * has already seen the stagger: it reads the overlap the bands draw, so it belongs under them.
 *
 * It exists because the overlap is the one thing the diagram states but does not explain. A reader who
 * sees three offset bands over L1-L5 will otherwise take the horizontal position as a rule ("Advanced
 * starts at L3"), which is exactly the column-reading this says not to do.
 */
export const SKILL_TIERS_CAPTION =
  "The tiers overlap on purpose. You pick up a focus area based on where it sits within a tier, not on a fixed column. A late Core focus area can appear at the same level as an early Advanced one.";

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

/**
 * Lead-in for the nine pillar cards, and NOT the section's intro — it renders directly above the first
 * card rather than under the heading, because the tier diagram sits between the two and a paragraph
 * announcing the matrix landed above a figure that is not the matrix.
 *
 * IT OPENS BY POINTING AT WHAT FOLLOWS. "Below is the full behavioral matrix" tells the reader that the
 * nine cards under this paragraph ARE the matrix, which is the one thing the cards themselves cannot say:
 * collapsed, they look like the Section I pillar grid. (The cards now help too, via the "View matrix"
 * control on each header.)
 *
 * WRITTEN AS SENTENCES. This began life as a section subtitle and opened like one, "The full behavioral
 * matrix: 9 pillars across 5 levels", a noun phrase and a colon, which reads as a title. That is fine
 * hanging off a heading and wrong as body copy standing beside `SKILL_TIERS_INTRO`, which opens with a
 * plain declarative sentence. Both paragraphs in this section now do.
 *
 * THE INSTRUCTION GOES LAST, and says "any". It used to be sandwiched mid-paragraph, where it interrupted
 * the description with a mechanic, and it used to say "expand a pillar", which read oddly once the first
 * pillar started out open (see DEFAULT_EXPANDED_PILLAR): the sentence would be asking for something already
 * done directly below it. "Open any pillar" covers the other eight, and "open" is the verb the card's own
 * control uses.
 *
 * It no longer restates that the focus areas are grouped into tiers: the diagram immediately above says so,
 * and every collapsed pillar card shows the three pills anyway.
 *
 * "45 cells" carries the number the section heading used to ("III. The 45-Point Competency Matrix"), which
 * the question form dropped, and "matrix" is here because the heading no longer names it either. Both are
 * how the framework is described elsewhere (see SITE_COPY.detail), so each should be said once in the tab.
 */
export const COMPETENCY_MATRIX_INTRO =
  "Below is the full behavioral matrix: 9 pillars across 5 levels, 45 cells in total. Each cell describes the observable behaviors expected at that level. Open any pillar to read its five.";

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

export const JUNIOR_TO_SENIOR = {
  title: "From Junior to Senior (S1–S3)",
  intro:
    "At S1 and S2, your title is simply Software Engineer, whatever your daily domain (frontend, backend, fullstack). The domain shapes which pillars grow first, but it does not decide your career track. That choice comes at S3.",
};

export const FOUNDATIONAL_PHASE = {
  title: "Building the Foundation",
  intro:
    "Across S1–S3 the whole chart grows fairly evenly, with the Technical cluster leading. The shape stays balanced: you're widening the base, not specializing yet.",
  technicalPillars: ["Coding", "UI/UX", "Domain Logic", "Architecture"],
  stageCharts: [
    {
      id: "junior",
      title: "Junior",
      role: { level: "S1", title: "Junior Software Engineer" },
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
      role: { level: "S2", title: "Mid Software Engineer" },
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
      role: { level: "S3", title: "Senior Software Engineer" },
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
  title: "The Senior Fork (S3)",
  intro: "At S3, your career path forks into three tracks, based on where you drive the most impact, not on your tech stack.",
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
      { level: "S3", title: "Senior Software Engineer" },
      { level: "S4", title: "Staff Software Engineer" },
      { level: "S5", title: "Principal Software Engineer / Solution Architect" },
      { level: "S6", title: "Technical Fellow" },
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
      { level: "S3", title: "Senior Product Engineer" },
      { level: "S4", title: "Staff Product Engineer" },
      { level: "S5", title: "Principal Product Engineer / Product Architect" },
      { level: "S6", title: "Chief Architect" },
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
      { level: "S3", title: "Senior Engineer (Track 1/2)" },
      { level: "S4", title: "Team Lead" },
      { level: "S5", title: "Engineering Manager" },
      { level: "S6", title: "Head of Engineering / VP" },
      { level: "S7", title: "Chief Technology Officer" },
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
