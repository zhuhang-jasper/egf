/**
 * Per-pillar L1–L5 competency descriptors (framework v4.1). L4/L5 may include a bold persona lead-in.
 * `text` may contain **bold** markers mirroring the PDF's in-cell emphasis — rendered via <EmphasizedText />.
 * The v4.1 rewrite carries no emphasis markers: the "what's new" highlighter is off, and the old v3.x
 * markers pointed at deltas that no longer exist after the full matrix rewrite.
 */
export const COMPETENCY_LEVEL_COPY = {
  coding: {
    L1: {
      text: "Can implement basic language logic by following established codebase patterns. Requires active guidance to navigate core structural files and pick the right data structure. Writes functional code but frequently relies on peer reviews to catch naming convention issues, unclear code, and unverified changes.",
    },
    L2: {
      text: "Can independently deliver standard features using fundamental data structures and clean naming conventions. Navigates the module to debug immediate issues, handling common errors gracefully. Verifies the happy path and failure cases before handoff without being prompted. Creates readable, self-documenting pull requests while applying familiar design patterns.",
    },
    L3: {
      text: "Can refactor toward low coupling and high cohesion, applying advanced algorithmic logic to resolve complex performance constraints. Diagnoses intricate system defects by navigating deep execution paths, and reasons about concurrency where it matters. Structures logic for systematic verification, covering boundary conditions and failure modes as standard practice.",
    },
    L4: {
      persona: "The Codesmith.",
      text: "Can define team coding standards for testing discipline, design patterns, and refactoring, enforcing them through critical pull request audits. Refactors shared abstractions that unblock multiple teammates at once. Rewrites the fragile, high-traffic modules the team fears touching, cutting the defect rate for everyone downstream.",
    },
    L5: {
      persona: "The Grandmaster.",
      text: "Can set the coding direction beyond the immediate team. Chooses language paradigms and refactoring conventions that outlive any single project. Executes systemic algorithmic refactoring across codebases that no single team owns. Evaluates emerging programming models and decides what the organization adopts, ignores, or retires to mitigate future technical debt.",
    },
  },
  domainLogic: {
    L1: {
      text: "Can implement basic workflows by strictly following defined requirements. Misses implicit domain edge-cases and the true intent behind them without external guidance. Verifies behavior only against the stated happy path. Requires rigorous oversight to achieve definition of done maturity when handling non-standard operational states.",
    },
    L2: {
      text: "Can independently execute standard workflows, grasping the intent behind the requirement rather than just its wording. Anticipates missing domain edge-cases and protects data integrity. Handles common operational errors and status transitions correctly. Meets definition of done maturity by verifying behavior against stated business rules and identifying routine loopholes before peer review.",
    },
    L3: {
      text: "Can secure complex workflow integrity across interdependent systems. Untangles conflicting domain rules to execute advanced loophole mitigation. Validates logic against real domain scenarios, not just written requirements. Builds robust logic guardrails for multi-step lifecycle and status transitions. Applies risk and complexity foresight during feature planning.",
    },
    L4: {
      persona: "The Logic Safeguard.",
      text: "Can model the highest-risk workflows others cannot untangle, closing the loopholes and building the guardrails that keep bad state out. Challenges vulnerable requirements before development starts, spotting the failure modes others miss. Sets the team's definition-of-done bar until business-rule defects are caught in review, not production.",
    },
    L5: {
      persona: "The Rule Setter.",
      text: "Can foresee systemic vulnerabilities to establish logic guardrails beyond the immediate team. Translates ambiguous business strategy into enforceable domain rules. Restructures operational assumptions that no single team thinks to question. Sets the domain rules the rest of the wider company codes against.",
    },
  },
  architecture: {
    L1: {
      text: "Can implement basic features by adhering to existing framework conventions. Requires direct guidance on data flow and integration. Relies on peers for API design, secure input handling, and choosing the right pattern. Leans on existing structures rather than shaping them.",
    },
    L2: {
      text: "Can autonomously build within an assigned module using standard data models. Wires up integrations and data flows that hold under routine load. Manages local state and storage efficiently. Researches unfamiliar libraries before pulling them in, weighing fit over novelty.",
    },
    L3: {
      text: "Can architect complex systems by applying architectural patterns to define resilient system boundaries. Models data and orchestrates state and storage across decoupled domains. Drives API design to ensure reliable data contracts that hold up under load, embedding secure design against common threats.",
    },
    L4: {
      persona: "The Bridge Builder.",
      text: "Can drive technical consensus by standardizing architectural patterns, secure design, and observability baselines across multiple teams. Draws system boundaries that let teams build without colliding. Audits API design and researches integrations for broad reach. Elevates build tooling and scalability to accelerate peer deployment velocity.",
    },
    L5: {
      persona: "The Ecosystem Architect.",
      text: "Can define the technical roadmap governing architectural patterns beyond the immediate team. Pioneers build tooling and scalability migrations that outlive any single project. Resolves foundational debt by establishing unified state and storage paradigms across systems no single team owns.",
    },
  },
  ai: {
    L1: {
      text: "Can leverage basic AI utilities for snippet generation, code autocomplete, and elementary debugging. Adheres to foundational safety boundaries while building consistent secure AI hygiene habits. Reaches for familiar tools but requires guidance to provide clear context, and accepts generated output without questioning it.",
    },
    L2: {
      text: "Can utilize effective prompting to independently drive structural scaffolding and expand feature delivery speed, selecting the right model for the task. Applies routine logic verification to catch and correct generated hallucinations. Maintains project context files that keep the AI grounded in the real codebase, not inventing APIs.",
    },
    L3: {
      text: "Can curate deep codebase context to safely guide autonomous AI agents through complex legacy refactoring, balancing depth against token cost. Catches the subtle errors AI introduces before they reach the codebase. Multiplies feature output utilizing targeted agentic prompt strategies.",
    },
    L4: {
      persona: "The Workflow Multiplier.",
      text: "Can standardize agentic tool execution methodologies and shared context conventions to scale team-wide development velocity. Sets the guardrails that protect proprietary codebases across shared workflows. Implements repository checks that mandate AI output review before generated code merges.",
    },
    L5: {
      persona: "The AI Vanguard.",
      text: "Can initiate strategic AI projects that leverage technical knowledge to create deep impact within and beyond the engineering team. Orchestrates automated workflows to eliminate systemic operational friction. Decides which AI capabilities the organization adopts, contains, or retires, scaling delivery velocity safely.",
    },
  },
  uiUx: {
    L1: {
      text: "Can translate basic interface designs maintaining baseline visual fidelity. Misses implicit detail accuracy without guidance. Copies components instead of reusing the shared library. Ships what the design shows without considering the states the design omits, and needs the design spelled out pixel by pixel.",
    },
    L2: {
      text: "Can independently match interface specifications with high visual fidelity and detail accuracy, adapting layouts responsively across screen sizes. Executes consistent component reuse and baseline accessibility for standard requirements. Maintains strict design system alignment. Applies baseline user empathy to perform minor UI improvisation for missing states.",
    },
    L3: {
      text: "Can resolve complex workflows by driving advanced UI improvisation across disparate interfaces. Orchestrates extensive component reuse while sharpening interface copy for clarity. Tunes interaction and perceived performance so the screen feels fast under real conditions. Evaluates undocumented user scenarios utilizing deep user empathy.",
    },
    L4: {
      persona: "The UX Safeguard.",
      text: "Can audit peer implementations to enforce design system alignment and interaction standards across the team. Challenges vulnerable interface requirements before development starts. Mentors teams on accessibility and interaction consistency until gaps are caught in review, not by users.",
    },
    L5: {
      persona: "The Experience Director.",
      text: "Can architect interface strategies defining interaction and accessibility standards beyond the immediate team. Pioneers design system alignment that outlives any single product. Sets the interaction and interface-writing conventions that no single team owns. Exercises profound user empathy to shape products people find effortless.",
    },
  },
  productSense: {
    L1: {
      text: "Can execute basic tickets utilizing surface requirement depth. Misses obvious user journey flaws without oversight, shipping exactly what the ticket says. Performs baseline scope sizing but takes requirements at face value. Requires guidance to grasp the business context behind a feature and struggles to judge what actually matters to users.",
    },
    L2: {
      text: "Can independently navigate requirement depth to execute standard features, sizing scope accurately before committing to a deadline. Catches gaps in the flow before writing code. Reads user feedback, usage data, and market signals to ground decisions rather than guessing. Proposes minor technical shortcuts that save effort without cutting corners.",
    },
    L3: {
      text: "Can actively clarify ambiguous requirement depth to prevent team rework downstream. Analyzes complex user journey flaws to implement robust technical shortcuts that hold up in production. Weighs what the business actually needs against what was requested, questioning why a feature exists, not just how to build it.",
    },
    L4: {
      persona: "The Scope Negotiator.",
      text: "Can mitigate systemic gaps across the team's work. Negotiates scope with product managers to protect the team from low-value work. Arbitrates which requests ship and which get cut. Enforces strong product judgement until weak requirements are challenged before development, not discovered after release.",
    },
    L5: {
      persona: "The Product Partner.",
      text: "Can shape product roadmaps beyond the immediate team, deciding what the product becomes next. Applies profound commercial instinct to trade-offs that no single team owns. Pioneers strategic technical shortcuts that trade engineering cost for business value. Dictates macro-level priorities utilizing expert product judgement.",
    },
  },
  process: {
    L1: {
      text: "Can execute basic SOP compliance with direct guidance. Follows foundational Git workflow but frequently disrupts codebase traffic. Leans on peer review to catch issues and stalls on blockers instead of escalating them early. Needs close supervision to ship reliably.",
    },
    L2: {
      text: "Can independently maintain SOP compliance and a clean Git workflow, managing routine codebase traffic without collisions. Reviews peer pull requests with care and clears their own blockers before they stall the team. Ships standard releases on schedule, keeping their own workflow tidy with familiar tooling and scripts.",
    },
    L3: {
      text: "Can orchestrate complex release management using selective deployment strategies. Navigates heavy codebase traffic within the Git workflow without relying on shared bottleneck branches. Raises the team's code review standard, catching design issues before merge. Builds CI checks and pipeline tests that cut recurring manual steps.",
    },
    L4: {
      persona: "The Process Shield.",
      text: "Can raise the team's release management and review standards, enforcing them through project-office coordination. Unblocks dependencies across teams and keeps cross-functional releases moving. Standardizes the team's automation stack until manual coordination becomes the exception, not the routine, and the standards other teams borrow.",
    },
    L5: {
      persona: "The Automator.",
      text: "Can architect zero-touch pipelines resolving operational friction beyond the immediate team. Defines the automation and release frameworks that outlive any single project. Restructures how the whole department ships, turning release and coordination protocols into automation frameworks other teams adopt.",
    },
  },
  communication: {
    L1: {
      text: "Can convey basic updates maintaining baseline communication clarity. Listens for instructions but misses the unspoken context. Requires guidance to produce accurate stakeholder reporting. Relies entirely on leadership for conflict mediation during blockers. Leaves knowledge undocumented unless explicitly asked.",
    },
    L2: {
      text: "Can maintain proactive communication clarity and listen actively enough to catch what was implied, not just said. Executes standard technical translation to clarify constraints. Delivers consistent stakeholder reporting independently. Speaks up in meetings and exchanges feedback without waiting to be asked.",
    },
    L3: {
      text: "Can articulate technical risks during planning through advanced technical translation. Presents to a room and defends a position under pushback. Writes technical documentation that outlives the conversation: decisions, trade-offs, and system knowledge. Drives cross-functional alignment through complex blockers.",
    },
    L4: {
      persona: "The Mediator.",
      text: "Can execute critical conflict mediation to resolve active cross-team friction. Drives cross-functional alignment through expert feedback exchange. Sets the team's documentation standards until critical knowledge survives any single person leaving, not just the loudest voice.",
    },
    L5: {
      persona: "The Ambassador.",
      text: "Can design communication frameworks beyond the immediate team, maximizing clarity. Pioneers strategic cross-functional alignment across teams that no single lead owns. Shapes the documentation culture that outlives any single project and leads systemic conflict mediation.",
    },
  },
  ownership: {
    L1: {
      text: "Can complete assigned tasks maintaining baseline reliability. Requires guidance to uphold commitment accountability and develop basic BAU domain fluency. Drops tasks that lose momentum without a reminder. Escalates issues promptly but relies heavily on peers for incident resolution and estimation.",
    },
    L2: {
      text: "Can independently deliver features upholding strict commitment accountability and honest estimation. Resolves the routine issues that come up in day-to-day operations. Sees tasks through to done and keeps their own work running reliably. Owns their mistakes and fixes them without being chased.",
    },
    L3: {
      text: "Can orchestrate complex incident resolution utilizing deep BAU domain fluency. Drives robust initiative and de-risking during feature planning to ensure reliability. Leaves the codebase healthier than they found it, paying down debt others avoid. Volunteers for problems nobody owns instead of waiting for assignment.",
    },
    L4: {
      persona: "The Finisher.",
      text: "Can drive knowledge resilience through systemic initiative and de-risking, ensuring delivery never depends on a single person, including themselves. Audits peer estimation and codebase health. Orchestrates major incident resolution, staying on it until delivery is trusted without follow-up.",
    },
    L5: {
      persona: "The Founder's Mindset.",
      text: "Can architect frameworks that keep the whole organization's delivery dependable and knowledge resilient beyond the immediate team. Pioneers strategic initiative and de-risking for risks that no single team owns. Sets how the organization keeps critical knowledge alive, so delivery outlives the teams that inherit it.",
    },
  },
};
