/**
 * Per-pillar L1–L5 competency descriptors (framework v4.3). L4/L5 may include a bold persona lead-in.
 * `text` may contain **bold** markers mirroring the PDF's in-cell emphasis — rendered via <EmphasizedText />.
 * The rewrite carries no emphasis markers: the "what's new" highlighter is off, and the old v3.x
 * markers pointed at deltas that no longer exist after the full matrix rewrite.
 */
export const COMPETENCY_LEVEL_COPY = {
  coding: {
    L1: {
      text: "Can implement basic language logic by following established codebase patterns. Needs a pointer to the right file, then loses the thread across modules. Picks a data structure that does the job. Fixes bugs by trial and error rather than tracing the cause. Follows the naming convention after a reviewer points it out.",
    },
    L2: {
      text: "Can independently deliver standard features using fundamental data structures and clean naming conventions. Navigates the module to debug immediate issues, handling common errors gracefully. Follows the framework's own conventions. Verifies the happy path and failure cases before handoff. Applies familiar design patterns in readable pull requests.",
    },
    L3: {
      text: "Can refactor toward low coupling and high cohesion, applying advanced algorithmic logic to resolve complex performance constraints. Diagnoses intricate defects by navigating deep execution paths, reasoning about concurrency where it matters. Knows when breaking convention is the right call. Covers boundary conditions and failure modes as standard practice.",
    },
    L4: {
      persona: "The Codesmith.",
      text: "Can define team coding standards for testing discipline, design patterns, and refactoring that hold without constant policing. Refactors shared abstractions that unblock multiple teammates at once. Rewrites the fragile, high-traffic modules the team fears touching, cutting the defect rate for everyone downstream.",
    },
    L5: {
      persona: "The Grandmaster.",
      text: "Can set the coding direction beyond the immediate team. Chooses language paradigms and refactoring conventions that outlive any single project. Drives algorithmic refactoring across codebases spanning several teams. Evaluates emerging programming models and decides what the organization adopts, ignores, or retires to mitigate future technical debt.",
    },
  },
  domainLogic: {
    L1: {
      text: "Can implement basic workflows by strictly following defined requirements. Reads a requirement literally and misses what it implies. Treats the ticket's checklist as the definition of done. Does not spot domain edge-cases without external guidance. Verifies behavior only against the stated happy path. Leaves data in a broken state when a step fails halfway through.",
    },
    L2: {
      text: "Can independently execute standard workflows, grasping the intent behind the requirement rather than just its wording. Anticipates missing domain edge-cases and protects data integrity. Handles common operational errors and status transitions correctly. Calls work complete only after verifying it against the stated business rules.",
    },
    L3: {
      text: "Can secure complex workflow integrity across interdependent systems. Untangles conflicting domain rules to execute advanced loophole mitigation. Validates logic against real domain scenarios, not just written requirements. Builds robust logic guardrails for multi-step lifecycle and status transitions. Applies risk and complexity foresight during feature planning.",
    },
    L4: {
      persona: "The Logic Safeguard.",
      text: "Can model the highest-risk workflows others cannot untangle, closing the loopholes and building the guardrails that keep bad state out. Challenges vulnerable requirements before development starts, spotting the failure modes others miss. Sets the team's bar for complete work, so business-rule defects stop reaching production.",
    },
    L5: {
      persona: "The Rule Setter.",
      text: "Can translate ambiguous business strategy into enforceable domain rules beyond the immediate team. Overturns the assumptions the business stopped questioning years ago. Sees which domain complexity will become a liability long before it does. Sets the domain rules the rest of the wider company codes against.",
    },
  },
  architecture: {
    L1: {
      text: "Can implement basic features within an existing system's structure. Reads a data model well enough to add to it, not to change it. Requires direct guidance on storage choices and integration. Builds endpoints to the shape they are told, without thinking about who calls them next. Pulls in whichever library a search result suggests.",
    },
    L2: {
      text: "Can autonomously build within an assigned module using standard data models. Wires up integrations and data flows. Manages local state and storage efficiently. Builds APIs that behave predictably for whoever calls them. Notices when something will slow down before it does. Researches unfamiliar libraries before pulling them in, weighing fit over novelty.",
    },
    L3: {
      text: "Can architect complex systems by applying architectural patterns to define resilient system boundaries. Models data and orchestrates state and storage across decoupled domains. Drives API design to ensure reliable data contracts that hold up under load, embedding secure design against common threats. Builds in the signals needed to tell what the system is doing in production.",
    },
    L4: {
      persona: "The Bridge Builder.",
      text: "Can drive technical consensus by standardizing architectural patterns, secure design, and observability baselines across multiple teams. Draws system boundaries that let teams build without colliding. Audits API design and researches integrations for broad reach. Chooses a toolchain the team can still work in years later.",
    },
    L5: {
      persona: "The Ecosystem Architect.",
      text: "Can define the technical roadmap governing architectural patterns beyond the immediate team. Pioneers toolchain and scalability migrations that outlive any single project. Decides where systems split, so teams can move without waiting on each other. Sets how much failure the organization plans for, and what it refuses to tolerate.",
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
      text: "Can curate deep codebase context to safely guide autonomous AI agents through complex legacy refactoring, balancing depth against token cost. Catches the subtle errors AI introduces before they reach the codebase. Knows which model suits which task, and what each one costs to run. Multiplies feature output utilizing targeted agentic prompt strategies.",
    },
    L4: {
      persona: "The Workflow Multiplier.",
      text: "Can set the team's shared context conventions so agent work stays consistent across the codebase. Puts guardrails in place that protect proprietary codebases across shared workflows. Holds the team to reviewing AI output, so generated code never merges unchecked.",
    },
    L5: {
      persona: "The AI Vanguard.",
      text: "Can initiate strategic AI projects that leverage technical knowledge to create deep impact within and beyond the engineering team. Orchestrates automated workflows to eliminate systemic operational friction. Decides which AI capabilities the organization adopts, contains, or retires, scaling delivery velocity safely.",
    },
  },
  uiUx: {
    L1: {
      text: "Can translate basic interface designs maintaining baseline visual fidelity. Matches the design when every detail is specified for them. Builds one-off components instead of extending the shared library. Ships what the design shows without considering the states the design omits. Builds for one screen size and stops there.",
    },
    L2: {
      text: "Can independently match interface specifications with high visual fidelity and detail accuracy, adapting layouts responsively across screen sizes. Builds components that fit the shared library rather than sitting beside it. Handles loading and empty states so the screen never looks stuck. Fills in the obvious missing states the design didn't specify.",
    },
    L3: {
      text: "Can resolve complex workflows by driving advanced UI improvisation across disparate interfaces. Decides where component boundaries sit so the library stays coherent. Tunes interaction and perceived performance so the screen feels fast under real conditions. Meets accessibility standards without being told which ones apply. Sharpens interface copy for clarity.",
    },
    L4: {
      persona: "The UX Safeguard.",
      text: "Can hold the team to design system alignment and interaction standards, so the interface stays consistent whoever builds it. Raises the team's accessibility bar until gaps stop reaching users. Catches copy that reads wrong before it ships. Keeps a deadline from shipping a broken experience.",
    },
    L5: {
      persona: "The Experience Architect.",
      text: "Can rule out platforms the design system cannot live inside. Decides what belongs in the shared foundation and what stays with each product. Sets the interaction patterns products inherit rather than each team inventing them. Spots friction repeating across products and fixes it once at the source.",
    },
  },
  productSense: {
    L1: {
      text: "Can execute basic tickets utilizing surface requirement depth. Follows the flow the ticket describes, shipping exactly what it says. Performs baseline scope sizing but takes requirements at face value. Requires guidance to grasp the business context behind a feature. Takes a shortcut a senior suggests without weighing its cost.",
    },
    L2: {
      text: "Can independently navigate requirement depth to execute standard features, sizing scope accurately before committing to a deadline. Catches gaps in the flow before writing code. Reads user feedback, usage data, and market signals to ground decisions rather than guessing. Proposes minor technical shortcuts that save effort without cutting corners.",
    },
    L3: {
      text: "Can actively clarify ambiguous requirement depth to prevent team rework downstream. Analyzes complex user journey flaws to implement robust technical shortcuts that hold up in production. Reads where the market is moving, and what will date fast. Weighs what the business actually needs against what was requested, questioning why a feature exists, not just how to build it.",
    },
    L4: {
      persona: "The Scope Negotiator.",
      text: "Can negotiate scope so the team stops absorbing work that will not earn its cost. Decides which requests ship and which get cut. Holds the team's product judgement bar, so weak requirements stop reaching development. Reads the business context well enough to argue the case in the room where it is decided.",
    },
    L5: {
      persona: "The Product Partner.",
      text: "Can shape product roadmaps beyond the immediate team, deciding what the product becomes next. Applies profound commercial instinct to trade-offs that cut across teams. Pioneers strategic technical shortcuts that trade engineering cost for business value. Sets which bets the organization makes first.",
    },
  },
  process: {
    L1: {
      text: "Can execute basic SOP compliance with direct guidance. Follows foundational Git workflow but frequently disrupts codebase traffic. Approves code reviews without reading them properly. Stalls on blockers instead of escalating them early. Needs close supervision to ship reliably.",
    },
    L2: {
      text: "Can independently maintain SOP compliance and a clean Git workflow, managing routine codebase traffic without collisions. Reviews peer pull requests promptly, flagging real issues, and clears their own blockers before they stall the team. Ships standard releases on schedule, keeping their own workflow tidy with familiar tooling and scripts.",
    },
    L3: {
      text: "Can choose release and branching approaches that fit how the team works. Navigates heavy codebase traffic without blocking others. Raises the team's code review standard, catching design issues before merge. Splits a feature into phases so the risky part ships first. Builds CI checks that cut recurring manual steps.",
    },
    L4: {
      persona: "The Process Shield.",
      text: "Can raise the team's release management and review standards so they hold without chasing. Unblocks dependencies across teams and keeps cross-team releases moving. Sets how the team phases large work, so parallel streams don't collide at integration. Cuts the meetings and handoffs the team had accepted as normal.",
    },
    L5: {
      persona: "The Automator.",
      text: "Can decide how far to automate and where manual judgment still earns its place, beyond the immediate team. Defines the automation and release frameworks that outlive any single project. Restructures how the whole department ships, turning release and coordination protocols into standards other teams adopt.",
    },
  },
  communication: {
    L1: {
      text: "Can share an update when someone asks for one. Listens for instructions but misses the unspoken context. Explains their work in technical terms, whoever is listening. Requires guidance to produce accurate stakeholder reporting on the usual cadence. Reads slides word for word when asked to present.",
    },
    L2: {
      text: "Can flag a change or blocker as it appears, and catch what was implied, not just said. Executes standard technical translation to clarify constraints. Delivers scheduled stakeholder reporting independently. Documents their own work in enough detail to answer the obvious questions later. Presents a demo when asked.",
    },
    L3: {
      text: "Can articulate technical risks during planning through advanced technical translation. Takes hard feedback on their own work without going defensive. Reports what each audience needs to decide, cutting detail that changes nothing. Writes documentation that outlives the conversation: decisions, trade-offs, system knowledge. Drives cross-team alignment through blockers.",
    },
    L4: {
      persona: "The Mediator.",
      text: "Can execute critical conflict mediation to resolve active friction between teams. Drives cross-team alignment when no one owns the decision. Gives hard feedback in a way people can act on. Sets the team's documentation standards and gets them followed, so docs read the same whoever wrote them. Escalates a wrong decision past their own chain when it matters.",
    },
    L5: {
      persona: "The Ambassador.",
      text: "Can set how information reaches the people who need it, across teams that share no reporting line. Directs high-level technical translation for executive stakeholders. Leads systemic conflict mediation between teams. Pioneers cross-team alignment where the decision has no clear owner.",
    },
  },
  ownership: {
    L1: {
      text: "Can complete assigned tasks maintaining baseline reliability. Meets deadlines that someone else set and tracked. Keeps tasks moving when reminded. Owns a mistake after someone else finds it. Follows the runbook during an incident. Relies heavily on peers for estimation.",
    },
    L2: {
      text: "Can independently deliver features upholding strict commitments and honest estimation. Resolves the routine issues that come up in day-to-day operations. Sees tasks through to done and keeps their own work running reliably. Owns their mistakes and fixes them without being chased.",
    },
    L3: {
      text: "Can orchestrate complex incident resolution utilizing deep BAU knowledge. Drives robust initiative and de-risking during feature planning to ensure reliability. Leaves the codebase healthier than they found it, paying down debt others avoid. Volunteers for problems nobody owns instead of waiting for assignment.",
    },
    L4: {
      persona: "The Finisher.",
      text: "Can drive knowledge resilience through systemic initiative and de-risking, so no handover stalls delivery, including their own. Audits peer estimation and codebase health. Orchestrates major incident resolution, staying on it until delivery is trusted without follow-up. Distributes work so the team's delivery holds.",
    },
    L5: {
      persona: "The Founder's Mindset.",
      text: "Can architect frameworks that keep the organization's delivery dependable beyond the immediate team. Pioneers strategic initiative and de-risking for risks that fall between teams. Shapes how the organization responds when something breaks, so the same failure does not repeat. Sets how the organization keeps critical knowledge alive, so delivery outlives the teams.",
    },
  },
};
