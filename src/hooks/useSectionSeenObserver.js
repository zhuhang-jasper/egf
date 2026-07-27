import { useEffect } from "react";

import { THEORY_SECTION_IDS } from "@/utils/theory-url";

/** Stable DOM ids for a section's head/tail sentinels — zero-height markers bracketing its content. */
export function getSectionSentinelId(section, edge) {
  return `${THEORY_SECTION_IDS[section]}-${edge}`;
}

/**
 * How long a section must remain on screen, AFTER both its edges have been seen, before the dot
 * clears. Without this the dot vanishes mid-flick: a fast scroll satisfies both edges within a few
 * hundred milliseconds, so the indicator disappears before the user has registered it was there. The
 * delay is about giving the dot time to be SEEN, not about measuring reading.
 */
const SEEN_SETTLE_MS = 600;

/**
 * How long a head/tail sentinel must stay in view before that edge is recorded.
 *
 * Edge writes are PERMANENT (they persist across sessions), so they need their own gate — the settle
 * delay above cannot undo them. Without this, a flick through a tall section latched both edges as
 * momentum carried the tail through the viewport, and a later glance at the section's top would find
 * the pair complete and clear the dot for content never read.
 *
 * The value is bounded on BOTH sides, because a zero-height sentinel is only in view for as long as it
 * takes to scroll one viewport past it — at 60fps that is `800 / pxPerFrame * 16`ms:
 *
 *   ~200 px/frame (flick)        →  ~64ms   must be rejected
 *   ~120 px/frame (fast scroll)  → ~107ms   must be rejected
 *    ~60 px/frame (normal read)  → ~213ms   must be ACCEPTED
 *
 * So this has to sit between ~110ms and ~210ms. Too high (400ms was the first attempt) and a steady
 * read-through never earns either edge, leaving the dot permanently lit — a far worse failure than
 * clearing slightly too easily. 150ms rejects flicks with margin while a normal read clears it.
 */
const EDGE_DWELL_MS = 150;

/**
 * Marks a Theory section as read once BOTH its head and tail have been in view AND the section has
 * stayed on screen for {@link SEEN_SETTLE_MS}, clearing that section's unseen dot.
 *
 * Both edges, in either order, because each one alone is defeatable:
 *
 *   - Tail alone misses the dot itself. Entering a section from below (scrolling up out of Career
 *     Paths into the Matrix) reaches the tail first, so the dot would clear without the heading it is
 *     attached to ever being on screen.
 *   - Head alone is just "the section appeared", which a fast flick past it satisfies.
 *
 * Requiring both means the scroll position has been at the top and has reached the bottom, so
 * everything between them has passed through the viewport. Order does not matter — reading upward is
 * still reading.
 *
 * The edges are zero-height sentinel nodes rather than the section box, because the box's own bottom
 * edge is already on screen the moment a SHORT section appears (anything shorter than the viewport),
 * which would collapse the two-edge test back into "it appeared". Sentinels make each edge exact and
 * independent of section height.
 *
 * The settle delay is timed against the SECTION, not each edge. Timing the edges individually would
 * demand a pause at the head and again at the tail, which makes a normal read-through feel sticky at
 * the bottom of every section. Instead the timer starts when the pair completes and is cancelled if
 * the section leaves the viewport first, so scrolling clean past a section never clears it.
 *
 * Because the hook re-subscribes when `unseenSections` shrinks, a section stops being observed the
 * moment it's marked. The observer drains as the user reads down the page and never attaches at all
 * for a caught-up user.
 *
 * `active` must be the Theory tab's live visible flag. The tab panel stays mounted while hidden and a
 * `hidden` element never intersects, so a hidden panel can't produce false reads on its own — but
 * gating explicitly skips setup while the Tool tab is open, and makes the subscription re-run on tab
 * switch so sentinels already on screen are re-evaluated. Switching tabs mid-settle tears the effect
 * down, which cancels the pending timer; the completed EDGES survive in storage, so returning to the
 * tab and putting the section back on screen restarts only the settle.
 *
 * BROWSER-tab visibility is deliberately NOT handled. Backgrounding the window doesn't change layout,
 * so no intersection callback fires and a pending timer isn't cancelled — but both delays are under a
 * second, so the only reachable case is switching away within ~600ms of reaching a section's end, which
 * nobody does deliberately. A `visibilitychange` listener plus the live intersection bookkeeping needed
 * to re-arm from it costs more (in code and in per-event work) than the sub-second window is worth.
 *
 * @param {boolean} active Whether the Theory tab is currently visible.
 * @param {Set<string>} unseenSections Section ids still carrying a dot (from `useTheoryUpdates`).
 * @param {(section: string, edge: "head" | "tail") => boolean} markSectionEdgeSeen Records one edge as
 *   seen and returns whether both are now in. Owns the persisted latch.
 * @param {(section: string) => boolean} isSectionEdgePairComplete Read-only check for an already-armed
 *   section, used to resume a pair completed in an earlier session.
 * @param {(section: string) => void} markSectionSeen Stamps a section read once settled.
 */
export function useSectionSeenObserver(active, unseenSections, markSectionEdgeSeen, isSectionEdgePairComplete, markSectionSeen) {
  // The Set identity changes on every derive, which would re-subscribe on unrelated renders. Key the
  // effect on the sorted ids instead, so it only re-runs when the membership actually changes.
  const unseenKey = [...unseenSections].sort().join(",");

  useEffect(() => {
    if (!active || unseenKey === "") {
      return undefined;
    }

    const sections = unseenKey.split(",");
    // Sections whose head+tail are both in and are now waiting out the settle delay.
    const settleTimers = new Map();
    // Pending per-edge dwells, keyed `"<section>:<edge>"`. Cleared when the edge scrolls away before
    // the dwell elapses, which is what stops a flick from recording it.
    const edgeTimers = new Map();
    // Sections whose pair completed during THIS subscription, so the section observer below knows to
    // start a timer when they come back on screen. A pair completed in an earlier session is picked
    // up on the first intersection instead (see the read-only isSectionEdgePairComplete probe).
    const complete = new Set();

    const cancelSettle = (section) => {
      const timer = settleTimers.get(section);
      if (timer !== undefined) {
        clearTimeout(timer);
        settleTimers.delete(section);
      }
    };

    const startSettle = (section) => {
      if (settleTimers.has(section)) {
        return; // already counting down
      }
      settleTimers.set(
        section,
        setTimeout(() => {
          settleTimers.delete(section);
          markSectionSeen(section);
        }, SEEN_SETTLE_MS),
      );
    };

    const cancelEdgeDwell = (key) => {
      const timer = edgeTimers.get(key);
      if (timer !== undefined) {
        clearTimeout(timer);
        edgeTimers.delete(key);
      }
    };

    // Edge sentinels: latch head/tail into persistent storage, but only after the edge has been in
    // view continuously for EDGE_DWELL_MS.
    //
    // The dwell is what makes a flick harmless. An edge write is PERMANENT, while the settle timer is
    // in-memory and cancellable — so without this gate, flicking through a tall section wrote both
    // edges (momentum scrolling carries the tail through the viewport on the way past), and returning
    // later to look at just the top would find the pair already complete and clear the dot for content
    // that was never read. Requiring the edge to linger means a scroll that blows past it records
    // nothing at all.
    const edgeObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const { theorySection: section, theorySectionEdge: edge } = entry.target.dataset;
        if (!section || !edge) {
          continue;
        }
        const key = `${section}:${edge}`;
        if (!entry.isIntersecting) {
          // Flicked past before the dwell elapsed — drop it. The sentinel stays observed, so the edge
          // can still be earned on a later, slower pass.
          cancelEdgeDwell(key);
          continue;
        }
        if (edgeTimers.has(key)) {
          continue; // already counting down for this edge
        }
        const target = entry.target;
        edgeTimers.set(
          key,
          setTimeout(() => {
            edgeTimers.delete(key);
            // Earned: stop watching, since a recorded edge has nothing left to report.
            edgeObserver.unobserve(target);
            if (markSectionEdgeSeen(section, edge)) {
              complete.add(section);
              startSettle(section);
            }
          }, EDGE_DWELL_MS),
        );
      }
    });

    // Section boxes: run the settle clock, and cancel it if the section scrolls away before it fires.
    const sectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const section = entry.target.dataset.theorySectionBox;
        if (!section) {
          continue;
        }
        if (!entry.isIntersecting) {
          cancelSettle(section);
          continue;
        }
        // `complete` is empty on a fresh subscription even for a section whose pair was finished in an
        // earlier session, so fall back to the persisted latch. This probe MUST be the read-only one:
        // calling markSectionEdgeSeen here would write an edge the user never actually reached.
        if (complete.has(section) || isSectionEdgePairComplete(section)) {
          complete.add(section);
          startSettle(section);
        }
      }
    });

    for (const section of sections) {
      for (const edge of ["head", "tail"]) {
        const el = document.getElementById(getSectionSentinelId(section, edge));
        if (el) {
          // Stamp section + edge on the node so the callback maps a target back without a parallel
          // element→id lookup.
          el.dataset.theorySection = section;
          el.dataset.theorySectionEdge = edge;
          edgeObserver.observe(el);
        }
      }
      const box = document.getElementById(THEORY_SECTION_IDS[section]);
      if (box) {
        box.dataset.theorySectionBox = section;
        sectionObserver.observe(box);
      }
    }

    return () => {
      edgeObserver.disconnect();
      sectionObserver.disconnect();
      for (const timer of settleTimers.values()) {
        clearTimeout(timer);
      }
      settleTimers.clear();
      for (const timer of edgeTimers.values()) {
        clearTimeout(timer);
      }
      edgeTimers.clear();
    };
  }, [active, unseenKey, markSectionEdgeSeen, isSectionEdgePairComplete, markSectionSeen]);
}
