import { CLUSTERS, getPillarGroups, getPillarLabel, getPillarLabelWithoutOrgan, getPillarOrder, getPlainChartPillarLabel } from "@/constants";
import { COMPETENCY_LEVEL_COPY } from "@/constants/competency-matrix-data";

function buildLevels(scores) {
  return getPillarOrder().map((id) => scores[id] ?? 2.5);
}

const PILLAR_ABOUT_COPY = {
  coding: {
    focusSummary:
      "Language Proficiency, Naming Convention, Core Programming Skills, Debugging & Code Navigation, Data Structures & Algorithms, **Testing Discipline**, **Code-Level Abstractions**",
    signatureQuestion: "Am I writing code that others can easily read and modify?",
  },
  domainLogic: {
    focusSummary:
      "Workflow Integrity, Definition of Done Maturity, Domain Edge-Cases, **Business-Rule Verification**, Logic Guardrails, Loophole Mitigation, Risk & Complexity Foresight",
    signatureQuestion: "Am I bulletproofing the logic against hidden edge cases?",
  },
  architecture: {
    focusSummary:
      "Framework Proficiency, Design Patterns, State & Storage Management, API Design, **System Boundaries**, **Secure Design**, **Observability & Production Readiness**, Build Tooling & Scalability",
    signatureQuestion: "Am I designing systems that perform, scale, and survive?",
  },
  ai: {
    focusSummary: "Effective Prompting, Secure AI Hygiene, Logic Verification, Context Management, Agentic Tools Integration, Output Multiplication",
    signatureQuestion: "Am I directing AI to safely multiply engineering output?",
  },
  uiUx: {
    focusSummary: "Visual Fidelity, Detail Accuracy, Component Reuse, Design System Alignment, User Empathy, UX Improvisation",
    signatureQuestion: "Am I creating an intuitive and frictionless interface?",
    note: "Backend engineers touch this pillar less often, mainly through internal tools they build and by sensing how their work affects the end user's experience. A flatter UI/UX corner is a normal backend shape, not a gap to fix.",
  },
  productSense: {
    focusSummary:
      "Requirement Depth, Scope Sizing, User Journey Flaws, Technical Shortcuts, **Business Context Awareness**, Product Judgement, **Commercial Instinct**",
    signatureQuestion: "Am I ensuring we actually build the right thing?",
  },
  process: {
    focusSummary: "SOP Adherence, PMO Compliance, Git Workflow, Codebase Traffic, Release Management, Process Automation, Team Efficiency",
    signatureQuestion: "Am I making it faster and easier for the team to ship?",
  },
  communication: {
    focusSummary:
      "Communication Clarity, **Stakeholder Reporting**, Technical Translation, **Technical Documentation**, Cross-Functional Alignment, Conflict Mediation",
    signatureQuestion: "Am I sharing the right context with the right people?",
  },
  ownership: {
    focusSummary:
      "Reliability, Sprint Accountability, Estimation Integrity, BAU Domain Fluency, Incident Resolution, Initiative & De-risking, Team Resilience",
    signatureQuestion: "Am I ensuring this crosses the finish line?",
  },
};

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
    pillars: pillars.map(({ id: pillarId }) => ({
      id: pillarId,
      pillar: getPillarLabel(pillarId),
      focusSummary: PILLAR_ABOUT_COPY[pillarId]?.focusSummary ?? "",
      signatureQuestion: PILLAR_ABOUT_COPY[pillarId]?.signatureQuestion ?? "",
      note: PILLAR_ABOUT_COPY[pillarId]?.note ?? "",
    })),
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
  "Each pillar is rated on an L1-L5 scale. The scale moves from adherence (following instructions) to strategic impact (shaping direction). Your scores reveal core strengths, skill gaps, and clear next steps for growth.";

/** `phase` is the full quality/identity pair (Section II); `term` is the identity word shown where space is tight (matrix headers). */
export const SENIORITY_LEVEL_DEFINITIONS = [
  {
    code: "L1",
    phase: "Adherence / Learner",
    term: "Learner",
    description: "Can follow clear instructions, match existing patterns, and execute tasks with high support.",
    seniority: "Junior",
  },
  {
    code: "L2",
    phase: "Autonomy / Practitioner",
    term: "Practitioner",
    description: "Can complete defined tasks and workflows end-to-end independently without constant guidance.",
    seniority: "Mid",
  },
  {
    code: "L3",
    phase: "Complexity / Expert",
    term: "Expert",
    description: 'Can navigate difficult hurdles and "messy" problems alone while maintaining standard expectations.',
    seniority: "Senior",
  },
  {
    code: "L4",
    phase: "Influence / Mentor",
    term: "Mentor",
    description: "Can raise the quality bar for others, resolve cross-functional friction, and mentor peers to proficiency.",
    seniority: "Lead / Staff",
  },
  {
    code: "L5",
    phase: "Impact / Strategist",
    term: "Strategist",
    description:
      "Can navigate high ambiguity, solve systemic risks, and shape workflows or strategies beyond the immediate team, at a scale relative to the organization.",
    seniority: "Principal",
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
        focusSummary: pillar.focusSummary,
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
