import { CLUSTERS, getPillarGroups, getPillarLabel, getPillarOrder, getPlainChartPillarLabel } from "@/lib/constants";
import { COMPETENCY_LEVEL_COPY } from "@/lib/constants/competency-matrix-data";

function buildLevels(scores) {
  return getPillarOrder("fe").map((id) => scores[id] ?? 2.5);
}

const PILLAR_ABOUT_COPY = {
  coding: {
    focusSummary:
      "Language Proficiency, Core Programming Skills, Naming Convention, Data Structures & Algorithms, Debugging & Code Navigation, Reusable Abstractions",
    signatureQuestion: "Am I writing code that others can easily read and modify?",
  },
  domainLogic: {
    focusSummary:
      "Workflow Integrity, Domain Edge-Cases, Definition of Done Maturity, Loophole Mitigation, Logic Guardrails, Risk & Complexity Foresight",
    signatureQuestion: "Am I translating complex requirements into bulletproof code?",
  },
  architecture: {
    focusSummary: "Framework Proficiency, Design Patterns, State & Storage Management, API Design, Modular Abstractions, Build Tooling & Scalability",
    signatureQuestion: "Am I designing a system built to perform and scale over time?",
  },
  ai: {
    focusSummary: "Effective Prompting, Logic Verification, Context Management, Agentic Tools Integration, Secure AI Hygiene, Output Multiplication",
    signatureQuestion: "Am I directing AI to safely multiply our engineering output?",
  },
  uiUx: {
    focusSummary: "Visual Fidelity, Detail Accuracy, Component Reuse, Design System Alignment, User Empathy, UX Improvisation",
    signatureQuestion: "Am I creating an intuitive and frictionless interface?",
  },
  productSense: {
    focusSummary:
      "Requirement Depth, Scope Sizing, User Journey Flaws, Technical Shortcuts, Domain Context Awareness, Product Judgement, Business Instinct",
    signatureQuestion: "Am I ensuring we actually build the right thing?",
  },
  process: {
    focusSummary: "SOP Adherence, PMO Compliance, Git Workflow, Codebase Traffic, Release Management, Process Automation, Team Efficiency",
    signatureQuestion: "Am I making it faster and easier for the team to ship?",
  },
  communication: {
    focusSummary: "Communication Clarity, Cross-Functional Alignment, Technical Translation, PMO Alignment, Conflict Mediation",
    signatureQuestion: "Am I sharing the right context with the right people?",
  },
  ownership: {
    focusSummary:
      "Reliability, Estimation Integrity, Sprint Accountability, BAU Domain Fluency, Incident Resolution, Initiative & De-risking, Mentorship, Team Resilience",
    signatureQuestion: "Am I ensuring this crosses the finish line?",
  },
};

const CLUSTER_ABOUT_META = {
  technical: { subtitle: '(The "Hows")' },
  product: { subtitle: '(The "What & Why")' },
  operational: { subtitle: "(The Force Multiplier)" },
};

export const PILLARS_SECTION_INTRO =
  "This framework breaks down a software engineer's real-world competencies into distinct trait pillars. It provides a holistic view of key focus areas, helping engineers identify and navigate their preferred career trajectories.";

function buildPillarClusterGroups() {
  return getPillarGroups("fe").map(({ id, title, pillars }) => ({
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
  "Each pillar is rated on an L1-L5 scale, serving as a benchmark to assess an engineer's maturity and seniority. This scoring identifies core strengths, skill gaps, and clear opportunities for growth. The five levels are defined as follows:";

export const SENIORITY_LEVEL_DEFINITIONS = [
  {
    code: "L1",
    phase: "Adherence / Learning",
    description: "Can follow clear instructions, match existing patterns, and execute tasks with high support.",
    seniority: "Junior",
  },
  {
    code: "L2",
    phase: "Practitioner / Autonomy",
    description: "Can complete defined tasks and workflows end-to-end independently without constant guidance.",
    seniority: "Mid",
  },
  {
    code: "L3",
    phase: "Proficient / Complexity",
    description: 'Can navigate difficult hurdles and "messy" problems alone while maintaining standard expectations.',
    seniority: "Senior",
  },
  {
    code: "L4",
    phase: "Influential",
    description: "Can raise the quality bar for others, resolve cross-functional friction, and mentor peers to proficiency.",
    seniority: "Lead / Staff",
  },
  {
    code: "L5",
    phase: "Impact / Strategic",
    description: "Can navigate high ambiguity, solve systemic risks, and shape long-term workflows or strategies.",
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
        pillarName: pillar.pillar,
        focusSummary: pillar.focusSummary,
        color: group.color,
        textColor: group.textColor,
        clusterLabel: group.label,
        levels: COMPETENCY_LEVEL_COPY[pillar.id],
      };
    }),
  );
}

export const COMPETENCY_MATRIX = buildCompetencyMatrix();

const ABOUT_PILLAR_SEQUENCE = getPillarGroups("fe").flatMap(({ pillars }) => pillars.map(({ id }) => id));

const KEY_PILLAR_RANK = new Map(ABOUT_PILLAR_SEQUENCE.map((id, index) => [getPlainChartPillarLabel(id), index]));

/** Sort career-track key pillar badges to match the About page pillar order. */
export function sortKeyFocusPillars(pillarNames) {
  return [...pillarNames].sort((a, b) => (KEY_PILLAR_RANK.get(a) ?? Number.MAX_SAFE_INTEGER) - (KEY_PILLAR_RANK.get(b) ?? Number.MAX_SAFE_INTEGER));
}

export const CAREER_TRACKS_SECTION_INTRO =
  "After the foundational phase, engineers split at L3 (Senior) into three impact paths based on where they drive the most value.";

export const FOUNDATIONAL_PHASE = {
  title: "The Foundational Phase (L1 & L2)",
  intro:
    "Levels 1 and 2 are strictly for building your technical foundation. Your primary goal is to master the Technical cluster before your path splits at L3 (Senior) based on your domain:",
  technicalPillars: ["Coding", "Domain Logic", "Architecture", "AI Leverage"],
  domains: [
    {
      label: "Backend",
      body: "Naturally flows toward Deep Technical or People tracks.",
    },
    {
      label: "Frontend",
      body: "Naturally flows toward Product or People tracks.",
    },
    {
      label: "Fullstack",
      body: "Highly flexible; branches based on where you drive the most impact.",
    },
  ],
  roleLevels: [{ level: "L1/L2", title: "Software Engineer" }],
};

export const CAREER_TRACK_PROFILES = [
  {
    id: "deep-technical",
    name: "Deep Technical",
    keyFocusPillars: ["Domain Logic", "Coding", "Architecture", "AI Leverage"],
    summary:
      "Focuses on system health and engineering excellence. This path is for engineers who solve complex architectural problems and act as technical force-multipliers, intentionally bypassing people management.",
    roleLevels: [
      { level: "L3", title: "Senior Software Engineer" },
      { level: "L4", title: "Staff Software Engineer" },
      { level: "L5", title: "Principal Software Engineer / Solution Architect" },
      { level: "L6+", title: "Distinguished Software Engineer / Technical Fellow" },
    ],
    levels: buildLevels({
      coding: 4,
      domainLogic: 4,
      architecture: 4,
      ai: 4,
      uiUx: 2,
      productSense: 2,
      process: 2,
      communication: 2,
      ownership: 2,
    }),
  },
  {
    id: "product-focused",
    name: "Product-Focused",
    keyFocusPillars: ["Domain Logic", "UI/UX", "Product Sense", "Communication"],
    summary:
      "Focuses on user experience and cross-functional impact. This path is for engineers who bridge the gap between code and product strategy, leveraging strong communication to actively shape and refine the user journey.",
    roleLevels: [
      { level: "L3", title: "Senior Product Engineer" },
      { level: "L4", title: "Staff Product Engineer" },
      { level: "L5", title: "Principal Product Engineer / Product Architect" },
      { level: "L6+", title: "Distinguished Product Engineer / Chief Architect" },
    ],
    levels: buildLevels({
      uiUx: 4,
      productSense: 4,
      domainLogic: 4,
      coding: 2,
      architecture: 2,
      ai: 2,
      process: 2,
      communication: 4,
      ownership: 2,
    }),
  },
  {
    id: "people-delivery",
    name: "People & Delivery",
    keyFocusPillars: ["Product Sense", "Process", "Communication", "Ownership"],
    summary:
      "Focuses on organizational velocity and alignment. This path is for engineers transitioning from daily execution into management, dedicated to unblocking teams, streamlining processes, and ensuring the delivery of high-value initiatives.",
    roleLevels: [
      { level: "L3", title: "Senior Fork (Any Domain)" },
      { level: "L4", title: "Team Lead" },
      { level: "L5", title: "Engineering Manager" },
      { level: "L6", title: "Head of Engineering / VP" },
      { level: "L7", title: "Chief Technology Officer (CTO)" },
    ],
    levels: buildLevels({
      process: 4,
      communication: 4,
      ownership: 4,
      productSense: 4,
      coding: 2,
      architecture: 2,
      ai: 2,
      domainLogic: 2,
      uiUx: 2,
    }),
  },
];

export const CLUSTER_COLORS = CLUSTERS;
