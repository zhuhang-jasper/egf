import { useCallback, useEffect, useState } from "react";

import { isProgrammaticScroll } from "@/utils/scroll";

// `:v2` is per-tab; v1 was a single shared key. Orphaning v1's value costs one stale header state for the
// rest of a session, which is cheaper than reading a shared boolean as if it were one tab's choice.
const HEADER_COLLAPSED_SESSION_PREFIX = "app:headerCollapsed:v2:";

/**
 * How much upward wheel/touch travel, accumulated while the page is already at the very top, reveals the
 * intro. This is a "pull against a wall" gesture: at `scrollY === 0` the page cannot scroll further up, so
 * continued upward input has no other possible meaning.
 *
 * Only has to clear an accidental nudge — roughly one wheel notch or a short finger drag. It does NOT have
 * to defend against flicks: `armIfNewGesture` already makes a fling structurally incapable of revealing, so
 * this number is free to be small. It was 220 while timing was the only defence, which made a legitimate
 * pull feel like work.
 */
const REVEAL_PULL_PX = 110;

/** Idle gap after which accumulated pull is forgotten, so unrelated nudges never sum into a reveal. */
const PULL_RESET_MS = 350;

/**
 * Input silence that stands in for a gesture boundary on the wheel, which has no touchstart equivalent.
 *
 * Momentum arrives as an unbroken stream of events, so any gap this long means the previous gesture ended.
 * Must comfortably exceed the inter-event spacing of inertial scrolling (tens of ms) while staying short
 * enough that deliberately pulling right after a scroll settles is not a chore.
 */
const GESTURE_GAP_MS = 250;

/**
 * Collapses the app intro (title + tagline) into nothing, leaving only the sticky tab bar, and reveals it
 * again on a deliberate upward pull at the top of the page.
 *
 * WHY THIS IS CSS STATE, NOT A SCROLL POSITION. The intro used to collapse simply by being scrolled out of
 * view, which made "collapsed" mean "scrollY is about 120". That encoding is what caused every problem in
 * this area: the range between 0 and the tab bar's anchor was a set of legitimate scroll positions the
 * browser would happily leave the user at, so keeping the header out of that band meant intercepting the
 * user's own momentum and scrolling them somewhere else. Fighting the scroll is unwinnable — and worse,
 * interception could itself strand the page mid-band, violating the very invariant it enforced.
 *
 * Taking the intro out of the layout removes the band entirely. When collapsed the document's top IS the
 * tab bar, so `scrollY === 0` is already the collapsed state and momentum landing there is simply correct.
 * No snapping, no cooldowns, no competing forces.
 *
 * WHY A PULL. Scrolling back to the top is something users do to re-read the first section, and it should
 * not cost them the intro's height unasked. So no amount or speed of scrolling reveals anything: the only
 * trigger is {@link REVEAL_PULL_PX} of further upward input once already parked at the top, which is
 * unambiguous because the page has nowhere left to go. Collapsing is the mirror image — any downward scroll
 * past the intro hides it, since scrolling down is a request for content space.
 *
 * COLLAPSE IS GLOBAL, REVEAL IS LOCAL. The state is stored per tab, but the two directions deliberately do
 * not propagate the same way, because they are not the same kind of statement.
 *
 * Collapsing says "give me content space". That is a claim about the chrome, not about whichever tab the
 * user happened to be on when they made it, so it applies everywhere — scrolling down on Theory leaves Tool
 * collapsed too, which is what makes the app feel like one surface rather than two.
 *
 * Revealing is an EARNED act: {@link REVEAL_PULL_PX} of deliberate pull at the top of one specific tab, or
 * that tab's caret. It stays on the tab that earned it. Letting it propagate was the original bug —
 * expanding on Theory silently expanded Tool, so returning to a Tool tab that had been collapsed and
 * scrolled deep and then scrolling back up ran past the tab bar into a title never asked for there. That is
 * exactly the free reveal the pull gesture exists to prevent.
 *
 * A REVEAL DOES CARRY INTO A TAB PARKED AT THE TOP, though — reveal is local, but not hermetically so. The
 * condition is about where the INCOMING tab sits, not where the user currently is.
 *
 * Adopting a reveal is only meaningful if the header will be on screen when the tab opens. A tab parked at
 * the top shows it immediately, and the two tabs read as one surface instead of two independently-dressed
 * pages. A tab parked deep would gain a title sitting invisibly above the viewport, whose only observable
 * effect is to unlock the scroll-up: the user scrolls back expecting to stop at the tab bar and sails past
 * it into a title that tab never earned. That is the whole complaint this hook exists to answer, so deep
 * tabs keep their collapse and require their own pull.
 *
 * "Parked at the top" is {@link isTabParkedAtTop} — the remembered offset being `<= 0`, which reads as "has
 * not scrolled past the bar" because those offsets are measured FROM the bar. It needs no knowledge of the
 * header's height, which is what makes it safe to consult while deciding what that height should be.
 *
 * Propagation fires on the TRANSITION into collapsed, never on the standing value. A tab adopting
 * `collapsed = true` during a switch must not re-broadcast it, or the other tab's reveal would be wiped
 * every time the user looked away and came back, making reveal useless. Same for the repeated
 * `setCollapsed(true)` that a single downward scroll produces — the `prev === next` bail in the setter is
 * what keeps those from each becoming a broadcast.
 *
 * The switch has to commit in ONE render. The new tab's collapsed value is adopted during render (see
 * below) rather than in an effect, because `useTabScrollMemory`'s layout effect measures the header to
 * resolve its scroll target — if the collapse landed a commit later, that measurement would be taken
 * against the outgoing tab's header.
 *
 * COLLAPSING TAKES EVERYTHING ABOVE THE BAR, not just the intro — the page's outer top padding and the
 * card's own top padding collapse with it (see HomePage). Any of that left behind would stay scrollable,
 * recreating the dead "not quite at the top" band this design exists to remove. With all of it gone,
 * `scrollY === 0` means precisely "the tab bar is at the viewport top", which is the pull gesture's
 * precondition.
 *
 * The reveal needs no scroll compensation because it can only fire AT scrollY 0: the layout grows entirely
 * above the scroll position, so nothing visible shifts and the page simply becomes scrollable upward.
 */
export function useHeaderCollapse(activeTab) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(activeTab, false));

  // Adopt the incoming tab's header state DURING render. React discards this render and immediately re-runs
  // the component, so `activeTab` and `collapsed` reach the DOM in a single commit — which is what lets
  // `useTabScrollMemory`'s layout effect measure the header it is actually about to restore against. Doing
  // this in an effect instead would paint one frame of the outgoing tab's header and resolve the scroll
  // target from it.
  //
  // A tab with no stored choice INHERITS the current one (`prev`) instead of defaulting to expanded. A user
  // who has collapsed the header should not be handed it back by a tab they simply have not opened yet;
  // that would be the same unearned reveal this hook exists to prevent, just via a different route.
  const [renderedTab, setRenderedTab] = useState(activeTab);
  if (renderedTab !== activeTab) {
    setRenderedTab(activeTab);
    setCollapsed((prev) => readCollapsed(activeTab, prev));
  }

  // THIS TAB's value, written from an effect rather than from the setter so an inherited value is recorded
  // as the tab's own the moment it is adopted. It also keeps the setter's job to exactly one thing: the
  // broadcast. Recording on adoption is what lets `collapseEveryTab` below simply write every key it finds
  // — a tab is in storage from the first commit that shows it, so "every tab that has been seen" and "every
  // tab that could be showing a stale value" are the same set, and no tab list has to be threaded in here.
  useEffect(() => {
    writeCollapsed(activeTab, collapsed);
  }, [activeTab, collapsed]);

  // Collapsing broadcasts; revealing does not. The `prev === next` bail is load-bearing, not an
  // optimisation: `onScroll` calls this on every downward scroll event, and a tab switch adopts values
  // through the render path above — neither is a fresh collapse, and treating either as one would wipe the
  // other tab's earned reveal. Revealing writes nothing here; the effect above persists it for this tab
  // alone, which is precisely what "local" means.
  const setCollapsedPersisted = useCallback((next) => {
    setCollapsed((prev) => {
      if (prev === next) {
        return prev;
      }
      if (next) {
        collapseEveryTab();
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let pullAccum = 0;
    let lastPullAt = 0;
    let touchY = null;
    let lastInputAt = 0;
    // False until a gesture is known to have STARTED with the page already at rest at the top. Only such a
    // gesture may accumulate pull. Reset the moment the page moves.
    let pullArmed = false;
    // Previous scroll position, so `onScroll` can tell direction. Seeded from the live value so the first event
    // after a tab restore compares against where the restore actually left the page, not 0 — otherwise that
    // first event would look like a large downward scroll and collapse immediately.
    let lastScrollY = window.scrollY;

    const now = () => performance.now();

    /**
     * Upward input while parked at the top. Only meaningful there: anywhere else the page absorbs the
     * gesture as ordinary scrolling, and the raw input carries no header intent.
     *
     * A DIFFERENT GESTURE IS REQUIRED, not merely a pause. Being at `scrollY === 0` is not sufficient: a
     * flick arrives there still coasting, and the events driving that coast are upward input at the top.
     * Nor is a quiet window sufficient — that was the previous approach, and a hard enough fling has a
     * momentum tail that outlasts any fixed timeout, so revealing stayed reachable by pure force.
     *
     * So the test is about gesture IDENTITY. Pull may only accumulate once `pullArmed` is set, which
     * happens only when fresh input begins while the page is already still at the top: a `touchstart`
     * there, or a wheel event separated from all prior input by {@link GESTURE_GAP_MS}. A flick's tail is
     * by definition part of a gesture that began deep in the page, so it can never arm — no matter how
     * hard the flick. Revealing is therefore always a deliberate second action.
     */
    const addPull = (upwardPx) => {
      if (upwardPx <= 0 || window.scrollY > 0) {
        return;
      }
      if (!pullArmed) {
        pullAccum = 0;
        return;
      }
      if (now() - lastPullAt > PULL_RESET_MS) {
        pullAccum = 0; // stale — don't let slow unrelated nudges sum into a reveal
      }
      lastPullAt = now();
      pullAccum += upwardPx;
      if (pullAccum >= REVEAL_PULL_PX) {
        pullAccum = 0;
        pullArmed = false; // consumed — a further reveal needs another fresh gesture
        setCollapsedPersisted(false);
      }
    };

    /**
     * Decide, as raw input arrives, whether it belongs to a gesture that STARTED at rest at the top.
     *
     * The test is a gap of {@link GESTURE_GAP_MS} since the previous input of ANY kind. Momentum arrives as an
     * unbroken stream of events, so a gap that long means a human began something new — and that holds however
     * long or gently the inertia decays, which a "has the page stopped moving?" timer did not: a fling's wheel
     * events outlive its scrolling, so such a timer armed for the tail.
     *
     * `lastInputAt` is therefore stamped on every event, unconditionally. Skipping the stamp for events that
     * failed the test (an earlier attempt) let a long tail defeat it — those events were ignored, so the first
     * one afterwards saw a huge gap and read as a new gesture. Observing every event is what makes an unbroken
     * stream detectable as unbroken.
     *
     * `fromTouchStart` short-circuits the gap on touch, where a finger landing is an unambiguous boundary.
     */
    const armIfNewGesture = (fromTouchStart) => {
      // Measured against ALL input, momentum included, and stamped unconditionally. Skipping the stamp for
      // non-qualifying events let a long tail defeat this: its events were ignored while the page settled, so
      // the first one after settling saw a huge gap since the last stamped input and read as a new gesture.
      // Observing every event is what makes an unbroken stream detectable as unbroken.
      const gapSincePrevInput = now() - lastInputAt;
      lastInputAt = now();

      const atTop = window.scrollY <= 0;
      const newGesture = fromTouchStart || gapSincePrevInput >= GESTURE_GAP_MS;
      if (atTop && newGesture) {
        pullArmed = true;
      }
    };

    // Downward scrolling collapses — but only scrolling the USER caused.
    //
    // Scroll events carry no origin, so this handler cannot tell a gesture from the app scrolling itself: the
    // per-tab restore (which re-asserts a remembered offset for up to ~2s after every switch), deep-link
    // glides, the matrix pillar jump. Treating those as intent meant switching to a tab remembered mid-page
    // collapsed the header instantly — so the state LOOKED per-tab even though it is one shared boolean,
    // because every switch quietly reset it.
    //
    // `isProgrammaticScroll()` is the discriminator, and it has to be a flag set by the SCROLLER rather than
    // a timing guess here. An input-recency heuristic looks equivalent but isn't: switching tabs right after
    // a wheel gesture puts the restore's scroll a few milliseconds after genuine input, which no listener-side
    // timing can distinguish from that input having caused it. That is exactly the reported bug — pull to
    // expand on one tab, switch to a tab remembered deep in its content, header collapses.
    const onScroll = () => {
      // The page moving means the current gesture is scrolling, not pulling — so it is disqualified from
      // ever revealing. This is what makes a flick structurally incapable of it: the fling scrolls, which
      // disarms, and its own momentum tail can never re-arm because re-arming requires the page to be still.
      pullArmed = false;
      const y = window.scrollY;
      const scrollingDown = y > lastScrollY;
      lastScrollY = y;

      if (isProgrammaticScroll()) {
        return; // restore, deep-link glide, matrix jump — the app moved the page, not the user
      }
      // ONLY scrolling DOWN collapses. Direction is the whole point: scrolling down is a request for content
      // space, scrolling up is not.
      //
      // Without this check, arriving on a tab restored mid-page with the header expanded meant the user's first
      // upward scroll collapsed it — which removes ~120px from ABOVE the viewport, jerking everything they were
      // looking at. One jolt, then fine, because after that there was nothing left to remove. That was the
      // stutter: not a scroll-position conflict and not rendering cost, just the collapse firing on a gesture
      // that never asked for it.
      if (scrollingDown && y > 0) {
        pullAccum = 0;
        setCollapsedPersisted(true);
      }
    };

    // Negative deltaY is upward in the wheel model.
    const onWheel = (e) => {
      armIfNewGesture(false);
      addPull(-e.deltaY);
    };


    const onTouchStart = (e) => {
      touchY = e.touches[0]?.clientY ?? null;
      armIfNewGesture(true); // a finger landing is unambiguously the start of a new gesture
    };
    // Dragging a finger DOWN the screen scrolls the page UP, so a growing clientY is upward travel.
    const onTouchMove = (e) => {
      const y = e.touches[0]?.clientY;
      if (y == null || touchY == null) {
        return;
      }
      armIfNewGesture(false);
      addPull(y - touchY);
      touchY = y;
    };
    const onTouchEnd = () => {
      touchY = null;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
    // `setCollapsedPersisted` is stable, so these listeners subscribe once and survive tab switches —
    // `lastScrollY` and the pull accumulators in this closure stay continuous. Nothing here needs to know
    // which tab is active: collapsing broadcasts to all of them, and revealing is persisted for the active
    // tab by the effect above.
  }, [setCollapsedPersisted]);

  return { collapsed, setCollapsed: setCollapsedPersisted };
}

/** `fallback` is used only when this tab has never recorded a choice — see the inheritance note above. */
function readCollapsed(tab, fallback) {
  try {
    const raw = sessionStorage.getItem(`${HEADER_COLLAPSED_SESSION_PREFIX}${tab}`);
    if (raw !== null) {
      return raw === "1";
    }
  } catch {
    // sessionStorage unavailable — fall through to the inherited value.
  }
  return fallback;
}

function writeCollapsed(tab, collapsed) {
  try {
    sessionStorage.setItem(`${HEADER_COLLAPSED_SESSION_PREFIX}${tab}`, collapsed ? "1" : "0");
  } catch {
    // sessionStorage unavailable — keep the in-memory value.
  }
}

/**
 * The broadcast half of "collapse is global, reveal is local": mark every tab collapsed.
 *
 * Writes every key under the prefix rather than taking a list of tabs, which it can do because a tab is
 * recorded from the first commit that shows it (see the persist effect). A tab that has never been opened
 * has no stored value and inherits the current one when it first is, so it lands collapsed anyway — the two
 * routes agree, and this hook stays ignorant of how many tabs exist.
 *
 * Keys are collected before writing: mutating sessionStorage while walking it by index is not something to
 * rely on holding its ordering.
 */
function collapseEveryTab() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(HEADER_COLLAPSED_SESSION_PREFIX)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      sessionStorage.setItem(key, "1");
    }
  } catch {
    // sessionStorage unavailable — the in-memory value still collapses the active tab.
  }
}
