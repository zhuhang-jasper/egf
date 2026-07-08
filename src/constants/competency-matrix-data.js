/**
 * Per-pillar L1–L5 competency descriptors (framework v3.1). L4/L5 may include a bold persona lead-in.
 * `text` may contain **bold** markers mirroring the PDF's in-cell emphasis — rendered via <EmphasizedText />.
 */
export const COMPETENCY_LEVEL_COPY = {
  coding: {
    L1: {
      text: "Can implement basic language logic by following established codebase patterns. Requires active guidance to navigate core structural files. Writes functional code but frequently relies on peer reviews to catch elementary algorithmic inefficiencies, naming convention issues, **and unverified changes**.",
    },
    L2: {
      text: "Can independently deliver standard features utilizing fundamental data structures and clean naming conventions. Navigates local module scopes to debug immediate issues. **Verifies the happy path and common failure cases before handoff without being prompted.** Creates readable pull requests while maintaining general performance awareness during routine codebase additions.",
    },
    L3: {
      text: "Can design **code-level abstractions** and apply advanced algorithmic logic to resolve complex performance constraints. Diagnoses intricate system defects by navigating deep execution paths. **Structures logic for systematic verification, covering boundary conditions and failure modes as standard practice.** Maintains high language proficiency by producing maintainable code tailored for scale.",
    },
    L4: {
      persona: "The Gatekeeper.",
      text: "Can define **team coding standards for naming conventions, testing discipline, and code-level abstractions, then enforce them through critical pull request audits. Refactors shared abstractions that unblock multiple teammates at once.** Mentors peers on advanced debugging and code navigation techniques, **raising the team's baseline until reviews catch design flaws, not formatting issues**.",
    },
    L5: {
      persona: "The Grandmaster.",
      text: "Can **set the coding direction beyond the immediate team — choosing language paradigms, testing strategies, and abstraction conventions that outlive any single project**. Executes systemic algorithmic refactoring **across codebases that no single team owns**. Evaluates emerging programming models **and decides what the organization adopts, ignores, or retires** to mitigate future technical debt.",
    },
  },
  domainLogic: {
    L1: {
      text: "Can implement basic workflows by strictly following defined requirements. Misses implicit domain edge-cases without external guidance. **Verifies behavior only against the stated happy path.** Requires rigorous oversight to achieve definition of done maturity when handling non-standard operational states.",
    },
    L2: {
      text: "Can independently execute standard workflows while anticipating missing domain edge-cases. Builds logic guardrails to handle common operational errors. Meets definition of done maturity by **verifying behavior against stated business rules and** identifying routine loopholes before peer review.",
    },
    L3: {
      text: "Can secure complex workflow integrity across interdependent systems. Untangles conflicting domain rules to execute advanced loophole mitigation. **Validates logic against real domain scenarios, not just written requirements.** Designs robust logic guardrails for multi-step data transitions. Applies risk and complexity foresight during feature planning.",
    },
    L4: {
      persona: "The Logic Safeguard.",
      text: "Can audit peer implementations to enforce strict loophole mitigation across the team. Challenges vulnerable requirements **before development starts**, utilizing deep risk and complexity foresight. Establishes **team** standards elevating definition of done maturity **until business-rule defects are caught in review, not production**.",
    },
    L5: {
      persona: "The Rule Setter.",
      text: "Can foresee systemic vulnerabilities to establish logic guardrails **beyond the immediate team**. Translates ambiguous business strategy into strict workflow integrity standards. Exercises advanced risk and complexity foresight to restructure **operational assumptions that no single team questions**.",
    },
  },
  architecture: {
    L1: {
      text: "Can implement basic features by adhering to existing design patterns. Requires direct guidance to handle state and storage management correctly. Relies on peers for API design integration, **secure input handling**, and foundational framework proficiency.",
    },
    L2: {
      text: "Can autonomously build **within established system boundaries** utilizing established design patterns. Integrates standard API design without structural friction. Manages local state and storage efficiently, **applying baseline secure design practices**. **Adds logging that makes routine issues traceable in production.**",
    },
    L3: {
      text: "Can architect complex systems by **defining resilient system boundaries**. Orchestrates advanced state and storage management across decoupled domains. Drives API design to ensure reliable data contracts, **embedding secure design against common threats**. **Builds observable systems that reveal production issues before users report them.**",
    },
    L4: {
      persona: "The Bridge Builder.",
      text: "Can drive technical consensus by standardizing design patterns, **secure design, and observability baselines** across multiple teams. **Draws system boundaries that let teams build without colliding.** Audits API design for broad integration. Elevates build tooling and scalability to accelerate peer deployment velocity.",
    },
    L5: {
      persona: "The Ecosystem Architect.",
      text: "Can define the technical roadmap governing **framework choices beyond the immediate team**. Pioneers build tooling and scalability migrations **that outlive any single project**. Resolves foundational debt by establishing unified state and storage paradigms **across systems no single team owns**.",
    },
  },
  ai: {
    L1: {
      text: "Can leverage basic AI utilities to accelerate development velocity through snippet generation, code autocomplete, and elementary debugging. Adheres to foundational safety boundaries while building consistent secure AI hygiene habits. Requires guidance to provide clear context **and accepts generated output without questioning it**.",
    },
    L2: {
      text: "Can utilize effective prompting to independently drive structural scaffolding and expand feature delivery speed. Applies routine logic verification to identify and correct generated hallucinations. **Maintains project context files** to securely optimize personal engineering output.",
    },
    L3: {
      text: "Can **curate deep codebase context** to safely guide autonomous AI agents through complex legacy refactoring. Enforces continuous logic verification to eliminate tool-generated technical debt. Multiplies feature output utilizing targeted agentic prompt strategies.",
    },
    L4: {
      persona: "The Workflow Multiplier.",
      text: "Can standardize agentic tool execution methodologies **and shared context conventions** to scale team-wide development velocity. Establishes **team-wide** secure AI hygiene standards to protect proprietary codebases. Implements repository guardrails to mandate strict logic verification across shared workflows.",
    },
    L5: {
      persona: "The AI Vanguard.",
      text: "Can initiate strategic AI projects to leverage technical knowledge and create deep impact **within and beyond the engineering team**. Orchestrates automated workflows to eliminate systemic operational friction. **Decides which AI capabilities the organization adopts, contains, or retires as the landscape shifts.** Scales delivery velocity safely.",
    },
  },
  uiUx: {
    L1: {
      text: "Can translate basic interface designs maintaining baseline visual fidelity. Misses implicit detail accuracy without guidance. Requires direct oversight to achieve design system alignment. Executes minimal component reuse. **Ships what the design shows without considering states the design omits.**",
    },
    L2: {
      text: "Can independently match interface specifications with high visual fidelity and detail accuracy. Executes consistent component reuse for standard requirements. Maintains strict design system alignment. Applies baseline user empathy to perform minor UX improvisation for missing states.",
    },
    L3: {
      text: "Can resolve complex workflows by driving advanced UX improvisation. Maintains strict visual fidelity and detail accuracy across disparate interfaces. Orchestrates extensive component reuse. Evaluates undocumented **user scenarios** utilizing deep user empathy and design system alignment.",
    },
    L4: {
      persona: "The UX Safeguard.",
      text: "Can audit peer implementations to enforce strict design system alignment and visual fidelity. Challenges vulnerable interface requirements **before development starts**, using deep user empathy. Mentors teams on detail accuracy, driving **shared component reuse until interface inconsistencies are caught in review, not by users**.",
    },
    L5: {
      persona: "The Experience Director.",
      text: "Can architect foundational interface strategies defining visual fidelity standards **beyond the immediate team**. Pioneers design system alignment **that outlives any single product**. Exercises profound user empathy to shape **UX conventions that no single team owns**. Establishes structural guidelines mandating detail accuracy and cross-platform component reuse.",
    },
  },
  productSense: {
    L1: {
      text: "Can execute basic tickets utilizing surface requirement depth. Misses obvious user journey flaws without oversight. Performs baseline scope sizing but struggles to identify technical shortcuts. Requires guidance to develop **business context awareness** and product judgement.",
    },
    L2: {
      text: "Can independently navigate requirement depth to execute standard features. Identifies routine user journey flaws before implementation. Executes accurate scope sizing while leveraging **business context awareness**. Applies basic product judgement to propose minor technical shortcuts.",
    },
    L3: {
      text: "Can actively clarify ambiguous requirement depth to prevent team rework. Analyzes complex user journey flaws to implement robust technical shortcuts. **Refines scope sizing by weighing what the business actually needs against what was requested.** Exercises strong product judgement during planning **by questioning why a feature exists, not just how to build it**.",
    },
    L4: {
      persona: "The Scope Negotiator.",
      text: "Can audit peer requirement depth to mitigate systemic user journey flaws. Negotiates technical shortcuts with product managers to optimize team-wide scope sizing. **Enforces strict product judgement until weak requirements are challenged before development, not discovered after release.**",
    },
    L5: {
      persona: "The Product Partner.",
      text: "Can define overarching requirement depth to shape **product roadmaps beyond the immediate team**. Applies profound **commercial instinct** to eliminate **user journey flaws that no single team owns**. Pioneers strategic technical shortcuts **that trade engineering cost for business value**. Dictates macro-level scope sizing utilizing expert product judgement.",
    },
  },
  process: {
    L1: {
      text: "Can execute basic SOP adherence with direct guidance. Follows foundational Git workflow but frequently disrupts codebase traffic. Requires supervision for PMO compliance during release management. Contributes minimally to process automation and team efficiency.",
    },
    L2: {
      text: "Can independently maintain SOP adherence and strict PMO compliance. Executes standard Git workflow efficiently to manage routine codebase traffic. Navigates standard release management autonomously. Applies basic process automation to **remove friction from their own daily workflow**.",
    },
    L3: {
      text: "Can orchestrate complex release management using selective deployment strategies. Navigates heavy codebase traffic within the Git workflow without relying on shared bottleneck branches. Enforces strict SOP adherence and PMO compliance. Implements targeted process automation **that removes recurring manual steps for the whole team**.",
    },
    L4: {
      persona: "The Process Shield.",
      text: "Can audit peer SOP adherence and enforce **team-wide** PMO compliance. Standardizes advanced Git workflow practices to mitigate codebase traffic congestion. Drives cross-functional release management. Pioneers robust process automation **until manual coordination becomes the exception, not the routine**.",
    },
    L5: {
      persona: "The Automator.",
      text: "Can architect process automation **resolving operational friction beyond the immediate team**. Defines overarching SOP adherence and PMO compliance frameworks **that outlive any single project**. Pioneers zero-touch release management. Restructures Git workflow and codebase traffic protocols **across teams that no single lead owns**.",
    },
  },
  communication: {
    L1: {
      text: "Can convey basic updates maintaining baseline communication clarity. Requires guidance to **produce accurate stakeholder reporting** and establish cross-functional alignment. Executes elementary technical translation but relies entirely on leadership for conflict mediation during blockers. **Leaves knowledge undocumented unless explicitly asked.**",
    },
    L2: {
      text: "Can maintain proactive communication clarity to drive routine cross-functional alignment. Executes standard technical translation to clarify feature constraints. **Delivers consistent stakeholder reporting independently. Documents their own work so others can pick it up without asking.** Escalates issues promptly to assist leadership with conflict mediation.",
    },
    L3: {
      text: "Can navigate complex blockers by driving robust cross-functional alignment. Performs advanced technical translation to articulate risks during planning. **Tailors stakeholder reporting to what each audience needs to decide. Writes technical documentation that outlives the conversation — decisions, trade-offs, and system knowledge.** Facilitates routine conflict mediation.",
    },
    L4: {
      persona: "The Mediator.",
      text: "Can execute critical conflict mediation to resolve active **cross-team** friction. Drives cross-functional alignment through expert technical translation. **Sets team documentation and reporting standards until critical knowledge survives any single person leaving.** Audits team-wide communication clarity.",
    },
    L5: {
      persona: "The Ambassador.",
      text: "Can design communication frameworks **beyond the immediate team** maximizing clarity. Pioneers strategic cross-functional alignment **across teams that no single lead owns**. Directs high-level technical translation for executive stakeholders. **Shapes reporting and documentation culture that outlives any single project** and leads systemic conflict mediation.",
    },
  },
  ownership: {
    L1: {
      text: "Can complete assigned tasks maintaining baseline reliability. Requires guidance to uphold sprint accountability and develop basic BAU domain fluency. Escalates issues promptly but relies heavily on peers for incident resolution and estimation integrity.",
    },
    L2: {
      text: "Can independently deliver features upholding strict sprint accountability and estimation integrity. Navigates routine BAU domain fluency to execute standard incident resolution. Applies baseline initiative and de-risking to maintain reliable system operations. **Owns their mistakes and fixes them without being chased.**",
    },
    L3: {
      text: "Can orchestrate complex incident resolution utilizing deep BAU domain fluency. Drives robust initiative and de-risking during feature planning to ensure reliability. Enforces consistent estimation integrity **even when honest estimates are unpopular**. **Volunteers for problems nobody owns instead of waiting for assignment.**",
    },
    L4: {
      persona: "The Finisher.",
      text: "Can drive team resilience through systemic initiative and de-risking, **ensuring delivery never depends on a single person — including themselves**. Audits peer estimation integrity. Orchestrates major incident resolution while enforcing rigorous sprint accountability **until commitments are trusted without follow-up**.",
    },
    L5: {
      persona: "The Founder's Mindset.",
      text: "Can architect frameworks elevating reliability and team resilience **beyond the immediate team**. Pioneers strategic initiative and de-risking **for risks that no single team owns**. Mandates estimation integrity **across teams**. Cultivates deep BAU domain fluency **that outlives any single project** through advanced incident resolution governance.",
    },
  },
};
