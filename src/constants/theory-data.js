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

export const CAREER_TRACKS_SECTION_INTRO =
  "Every engineer starts on the same foundation. At L3 (Senior), the path forks into one of three tracks — chosen by where you naturally drive the most impact.";

export const FOUNDATIONAL_PHASE = {
  title: "The Foundational Phase (L1 & L2)",
  intro:
    "At L1 and L2, your title is simply Software Engineer, and your goal is to build your foundation in the Technical cluster. Your daily domain (frontend, backend, fullstack) will naturally shape which pillars grow first — but it does not decide your track. The Senior fork at L3 is based on where you naturally drive the most impact, not on your tech stack.",
  technicalPillars: ["Coding", "Domain Logic", "Architecture", "AI Leverage"],
  roleLevels: [{ level: "L1/L2", title: "Software Engineer" }],
};

export const SENIOR_FORK = {
  title: "The Senior Fork (L3)",
  intro:
    "From L3 onwards, your growth splits into one of three tracks, each concentrating on different pillars. The radar shapes shown for each track are examples of where each shape leans, not targets to copy. The Technical cluster remains everyone's foundation.",
  outro: "Not sure which track? Look at your radar: your three highest pillars outside the Technical cluster usually point at your natural track.",
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
      "Focuses on user experience and cross-functional impact. This path is for engineers who bridge the gap between code and product strategy. They use strong communication to actively shape and refine the user journey.",
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
      "Focuses on team speed and alignment. This path is for engineers transitioning from daily execution into management, dedicated to unblocking teams, streamlining processes, and ensuring the delivery of high-value initiatives.",
    roleLevels: [
      { level: "L3", title: "Senior Engineer (Track 1 or 2)" },
      { level: "L4", title: "Team Lead" },
      { level: "L5", title: "Engineering Manager" },
      { level: "L6", title: "Head of Engineering / VP" },
      { level: "L7", title: "Chief Technology Officer" },
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
