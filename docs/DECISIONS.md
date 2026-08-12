# Decisions

Long-form reasoning for decisions that are hard to re-derive from the code. Each heading here is the target
of a `see docs/DECISIONS.md#anchor` pointer left at the relevant source line.

**What belongs here:** a constraint that is not visible from the code, an approach that was tried and failed,
or a value whose derivation would otherwise be guesswork. **What does not:** a description of what the code
does, or a record of every change made. Git holds the history; this holds the reasoning that git makes
expensive to find.

When a decision is reversed, rewrite its entry rather than appending to it. An entry describes the world as
it is now, plus the dead ends worth not repeating.

---

## Layout and scrolling

### tab-switch-scrollbar-jump

The fixed bottom nav jumped vertically by ~15px for one frame on every tab switch. `position: fixed` was not
the problem: the viewport it is fixed to is what moved.

A horizontal scrollbar appeared for a single frame, and a horizontal scrollbar shrinks the **visual**
viewport. `window.innerHeight` stays put while `visualViewport.height` drops by the scrollbar's height, and
`bottom: 0` resolves against the visual viewport, so the bar followed it down and back. Traced frame by frame
at a 376px viewport: `innerHeight` 707 throughout, `visualViewport.height` 707 → 692 → 707, bar gap 0 → 15 → 0.

There were three separate sources of that one-frame overflow, and all three are guarded now:

1. **A pair of invisible tooltips.** `scrollWidth` 419 vs `clientWidth` 376, with the chart's "Chart display
   settings" and the profile menu's "Manage profiles" tooltips the only boxes past the edge. They are
   `opacity-0`, so they are still laid out, and the runtime clamp they carried was computed against a
   `hidden` (zero-width) panel while their tab was inactive. Fixed by deleting the clamp: Tooltip is now
   positioned by Floating UI with `strategy: "fixed"`, so it cannot contribute to the document's scroll
   extent at all.
2. **The outgoing tab panel's own measure.** On the frame a switch commits, the outgoing panel can still be
   laid out at the wider measure (Theory's 900 vs the tool's 550). Guarded by `overflow-x-clip` plus
   `max-w-full` on the inactive panel. Both halves are load-bearing: `overflow-x: clip` contains what is
   _inside_ a box and cannot clip the box itself, and the panel's own border-box is what overflows.
3. **The tab entrance animation.** It starts at a horizontal offset, which on a full-width panel is overflow
   by construction. Contained by putting the transform on an **inner wrapper** (a clip never crops the box it
   is declared on) and by clipping the panel for the duration of the entrance.

**Do not** reach for `transform-gpu` or a `dvh` calc on the nav. A fixed element cannot opt out of the visual
viewport, so neither addresses a shrinking one; `transform-gpu` only makes the symptom cheaper to repaint
while leaving it wrong, at the cost of a containing block for descendants and blurry text on some platforms.

Related: the clip is keyed off `active`, not `active || leaving`. Widening it to spare a leaving panel's
overhang reintroduces the bug, because a leaving panel is still laid out at its own measure.

### bottom-nav-height-reservation

The nav's height is reserved with padding alone (`pb-[calc(3.5rem+env(safe-area-inset-bottom))]` on `main`),
deliberately **not** paired with a matching `min-h-[calc(100dvh - …)]`.

That calc is what made the fixed nav jump upward for a frame on every tab switch. `dvh` resolves against the
viewport and is re-resolved when the layout viewport changes, which a tab switch does (the two tabs' measures
differ enough to add or drop the vertical scrollbar). For the frame in which that is being recomputed,
`main`'s height and the nav's `bottom: 0` anchor disagree, and the bar paints high before settling.

Bare `min-h-dvh` is safe and is what `html`/`body`/`#root` already use. The hazard is specifically doing
**arithmetic** on a viewport unit in the same box whose height the fixed element's anchor is compared against.

The cost of padding alone is that the shortest possible page is the bar's height taller than the viewport, so
a very short tab can scroll by ~56px. That is far cheaper than a visible jump on every switch.

### scroll-anchoring

Scroll anchoring is Chrome/Firefox keeping visible content still when the document changes height **above**
the viewport: the browser picks an anchor node and silently adjusts `scrollY` to hold it in place. Normally
invaluable, and the reason a collapsing pillar above the reader does not throw them somewhere random.

It is ruinous when the app is doing the compensating. A per-frame scroll loop and the anchor are two
controllers writing one value from the same layout pass: our frame sets a new target, the anchor corrects it
back toward its node, the next frame measures the corrected position and aims again. The result is a visible
shake for as long as the document keeps changing height and, since the anchor gets the last word after the
final frame, a resting position that is not the one we asked for.

This is why the expand **glide** must suspend it and the collapse **pin** merely benefits: the pin writes the
same value every frame, so a fight with the anchor converges invisibly (though it can hold `drift` off zero
and defeat the pin's early release). The glide writes a moving value, so the contention _is_ the animation.

Scoped to `documentElement` (the scrolling element, where anchor selection happens) and restored to whatever
was there before, so it composes with any future stylesheet rule instead of clobbering it.

### matrix-expand-glide

Expanding a matrix pillar while another collapses above it cannot use `behavior: "smooth"`.

A native smooth scroll picks its own duration (~400-500ms in Chrome, and it restarts its easing from scratch
on every re-aim), so it necessarily finishes **after** the 300ms panel animation. That made the expand read as
two events: the new levels animated in at the reader's current offset, a flash of content in the wrong place,
and only then did the page travel to meet them. Waiting for the animation before scrolling at all, which the
original code did, guarantees that ordering.

Running the scroll on the **same clock** as the animation collapses the two into one movement: the card
arrives under the sticky bar exactly as its levels finish opening.

The destination cannot be captured once at click time, because the collapse above is still shortening the
document and the card's final resting place is not yet knowable. What **is** fixed at click time is the
distance the card must travel relative to the sticky inset, so that is what gets eased. Each frame drives the
card's top to its scheduled place on that trajectory, in viewport coordinates; layout shifts need no separate
handling, since a shift changes `rect.top` and the same correction absorbs it.

An earlier version closed a fixed **fraction** of the remaining distance per frame. Against a static target
that eases nicely, but the pillar collapsing above moves the target by ~110px per frame early in the
animation, far faster than a 15%-per-frame filter can track. The error accumulated for the whole 300ms and
was discharged in one jump when the loop ended: the "shake" at the end, which landed somewhere inside the
matrix if layout had not settled by then. An explicit trajectory has no lag to accumulate.

Two details that look incidental and are not:

- **Wall clock, not a frame count.** A CSS transition is paced by elapsed time. Counting frames and assuming
  16.7ms each desynchronises the moment frames drop, and expanding a pillar _below_ the open one is the worst
  case (a full-height collapse and expand in one layout pass).
- **Whole pixels with a 1px dead zone.** Scroll position is quantised and fractional on HiDPI, so a sub-pixel
  destination is snapped to something else and reads back as fresh error next frame: a correction that can
  never succeed, applied forever.

### matrix-collapse-pin

`holdElementInPlace` defends an already-correct position while the document shrinks underneath it. Collapsing
a matrix pillar from the strip at its foot removes several screens of content from **above** the viewport, so
the browser clamps `scrollY` to the shrinking `scrollHeight` and the page appears to lurch upward on its own.

**Where it holds is wherever the element already is, floored at the sticky inset.** Pinning it _to_ the inset
unconditionally was wrong in a way that only shows once the reader has scrolled: with a pillar open but
scrolled up so the card sits mid-viewport, collapsing it hauled the card to the top of the page. The card was
already in view, so the correct amount of scrolling is none.

The floor is what keeps the original case working, and is why this cannot simply preserve the current
position: the close control sits at the **foot** of an expanded matrix, so it is normally clicked with the
card's top several screens above the viewport. Holding it there would strand the reader among the pillars
that follow. Clamping to the inset means "as close to where you were as is still visible", which collapses to
the old behaviour in that case and to no movement at all in the new one.

`behavior: "auto"` is essential, not an optimisation: a smooth scroll owns the scroll position for its own
duration and eases toward a snapshot of the target, so issuing one per frame against a live layout fights
itself and lands late.

### scroll-lock-gutter

Locking body scroll with `overflow: hidden` hands the scrollbar's ~15px back to the layout, so the app column
widens, its centred content slides, and the fixed bottom nav's centred items slide by a different amount
again. The width has to be given back, and **which elements get it** is the whole problem. Three narrower
attempts each failed instructively:

- **`padding-right` on `body`.** `body` carries the app's surround tint, and a background on `body` propagates
  to the canvas when `html` has none, as here. The reserved strip paints that tint across the full viewport,
  _outside_ the modal's `fixed inset-0` scrim, reading as a bar down the right edge. This was obvious when the
  tint was black; it is the same bug at `slate-100`, just quieter, so do not read the softer colour as licence
  to revisit it.
- **`margin-right` on `body`.** Identical, for the same reason: what shows in the gap is the propagated canvas
  background, which nothing done to `body`'s own box can avoid.
- **`margin-right` on `#root` alone.** No stray strip, but it insets only the in-flow column, so AppBottomNav
  (fixed, and therefore laid out against the viewport) stayed full-width while the page pulled in beneath it.

So the compensation is published as a CSS variable and consumers are decided by one question: **does this
belong to the page, or to the viewport?** The page (`#root`, AppBottomNav) takes the gutter; the viewport
(toasts, install prompt, modal scrim) does not. `position: fixed` is **not** the test, since all of those are
fixed.

`scrollbar-gutter: stable` would reserve the space in CSS alone, but permanently shrinks the content box while
fixed elements keep the full viewport: the same misalignment as the third attempt, standing rather than
transient.

---

## Navigation and chrome

### navigation-moved-to-a-bottom-bar

Navigation was a segmented control in the header's 32px row, sharing that row with the brand lockup and a
collapse caret. Three jobs in one row, and at the app's 350px floor the three did not fit.

Everything the old arrangement did to cope was a symptom: the tablist shrank to content width, slid between
centred and flush-right depending on the header's state, reserved the caret's corner with `pr-11`, and the
wordmark beside it needed hand-measured breakpoints (470px, re-measured twice) to know when to abbreviate.
Moving navigation out of the row deleted all of it.

It also stops the tab count from being a layout constraint. In the header, a third tab meant re-measuring the
wordmark's breakpoint; in a full-width bar the items share the width, so tabs can be added without touching
anything else.

**A bottom bar rather than a second header row,** because it is reachable: on a phone it sits under the thumb,
whereas a second row at the top is the furthest point from it. `fixed` rather than `sticky` — sticky would
need a scroll container to stick within and would scroll away with the document at the end of a short page,
which for the app's only navigation is not acceptable.

**At every width, not mobile-only.** Keeping the segmented control in the header for wide screens would mean
maintaining two navigation surfaces and keeping every piece of geometry this change exists to delete.

The iOS safe-area padding has a dependency that silently resolves to 0 if either half is missing.
`index.html` must keep **both** `viewport-fit=cover` on the viewport meta (otherwise the page is laid out
inside the safe area already and there is no inset to report) and `apple-mobile-web-app-capable` (iOS reports
0 for every inset while browser chrome is present, because Safari's own bottom bar is what clears the home
indicator). The second was missing, which meant the padding did nothing on iOS no matter how the app was
launched. It also only takes effect for home-screen icons created _after_ it shipped, since iOS bakes the
launch mode into the shortcut when it is added.

### bottom-nav-visual-viewport-jump

See [tab-switch-scrollbar-jump](#tab-switch-scrollbar-jump), which is the same bug from the nav's side.

### bottom-nav-colour-system

Four values in the bar are read **against** its `bg-slate-100` tint, so none of them can be changed alone.

**Three gaps have to hold at once**, which is what makes the fills fiddly to retune:

- active vs bar — or the selected tab is invisible
- hover vs bar — or hovering does nothing
- active vs hover — or hovering an inactive tab looks selected

**The active fill stays light at `slate-200`, one step off the bar.** `slate-300` has been tried and rejected
**twice**: it buys the hover a full rung to sit on, but the active tab then reads as a _pressed button_ rather
than a passive "you are here" marker, which is the wrong idea about what the mark is for. Do not reach for it
a third time. The active state does not carry the signal alone — it also gets a black top border and black
text, so the light fill is the third of three cues.

That puts active adjacent to the bar, so **the hover between them is half a rung by arithmetic, not by
choice.** `slate-100` and `slate-200` are consecutive with no named colour in the gap, so the middleground has
to be a fraction of a step. `slate-200/50` states that as what it is: the **active fill at half strength**, so
hover is literally halfway to selected and stays halfway if active is ever retuned. An arbitrary hex
(`rgb(234 239 245)`, the same colour) would be a third constant to keep in step by hand.

The gaps are genuinely faint, and that is the ceiling rather than an oversight. Bar to active is only 1.125
contrast to begin with, so splitting it lands ~1.055 each side. Hover is transient and **pointer-only** — it
does not exist on touch, where this bar mostly lives — so it is the right state to spend the subtlest signal
on, while the selected state persists and must stay unambiguous. There is no arrangement that makes both
bold: widening the hover means darkening active, which is the trade refused above.

**The rule is not "never alpha", it is "never alpha of the background you sit on".** The hover this replaced
was `slate-100/70`, the bar's own colour at 70%, which composites to `slate-100` exactly: contrast 1.000, a
literal no-op. It was correct while the bar was white and died silently when the bar took the tint. Alpha of a
_different_ rung cannot collapse into the background, and is self-maintaining in the direction that matters —
it tracks the state it interpolates toward, not the surface it has to differ from.

**The active mark is true `black`, not `slate-900`.** Everything else in the app's greys is on the slate ramp,
and `slate-900` (#0f172a) carries that ramp's blue cast, so against `slate-100` the active tab was the darkest
thing in a family rather than a mark set apart from it. Black has no cast, so it reads as ink on the chrome.
Border, text and icon take it **together**, because a black rule over slate-900 words shows up as two slightly
different darks stacked, which is more visible than either value being wrong.

**The inactive label and its icon share a rung** (`slate-400`). The label was one rung darker once, on the
argument that the icon was decoration and should sit back from it. That read as a mismatch rather than a
hierarchy: at 11px semibold over a 24px glyph the two are one unit, and a rung of the slate ramp is not a
fixed amount of visual weight — 24px of 2px strokes outweighs 11px semibold text, so the "receding" glyph
looked _darker_ than its label. The inactive segment is therefore one colour in every state, with no
`group-hover` anywhere in the button: hover is carried by the segment's **background** alone, since one signal
is enough for a transient, pointer-only state.

**The unseen dot has no ring, and neither does the admin badge.** The dot carried `ring-2` in the segment's
background colour so the band read as a gap separating it from the icon strokes beneath. Nothing tied that
colour to the background it was copied from, and every value (`ring-white`, then `ring-slate-50`, then
`ring-slate-200`) was correct for exactly one bar colour and showed as a halo after the next change. Both
marks sit clear of the glyph's strokes, so they read on their own. If a ring ever comes back it needs **both**
a width and a colour: `ring-2` alone falls through to Tailwind's `--color-ring` mid grey and draws exactly
that halo.

### bottom-nav-item-geometry

**The width cap is per ITEM, not on the row.** It was `max-w-[360px]` on the container, which fixed the whole
row's width — so every tab added made all the tabs narrower (two at 180px, three at 120px, four at 90px) until
they were too small to read. Capping each item makes the row's natural width `n × cap`, so the bar **grows**
with the tab count and stays centred, and adding a tab never shrinks the ones already there. `justify-center`
is what makes that usable once the items stop growing.

Items are uncapped below `xs` (470px), where `flex-1` alone runs and they split the viewport. A cap would bind
on any phone wider than 360px and leave bare tint down each side, which is the opposite of what is wanted at
the width where the bar is thumb-driven. The three-tab case is why the cap cannot be much lower: at the app's
350px floor, three uncapped tabs are ~117px each and already tight for "Theory v4.1".

**The 3px top border is on every item and coloured on only one.** Each button owns the 3px directly above
itself and the buttons are adjacent, so the borders abut into one unbroken band across the row: dark over the
active segment, invisible over the rest. The transparent border on inactive items is load-bearing, not filler
— a border on the active item alone would make it 3px taller, so icons and labels would sit off each other
and the whole row would shift by 3px on every tab change.

Drawn by a border rather than an absolutely-positioned child, which is what it was first: a child had to be
pulled to `-top-px` to reach the bar's edge and still fought the row's padding for its last few pixels. A
border _is_ the top edge. 3px is an arbitrary value because Tailwind's border scale jumps 2 → 4 with nothing
between, and 4px read as a slab rather than a marker at this bar's weight.

**`min-h-14` (56px) matches the header** so the two pinned bars are the same weight of chrome top and bottom.
It was 48px, already above the 44px touch-target floor, so this is a symmetry change rather than an
accessibility one. The painted bar is 59px because the 3px border sits outside the `min-height`; the header is
57px for the same reason. Matching the **content rows** rather than the outer edges is deliberate, since the
borders are boundary marks rather than part of the bar.

**The type ladder is `11 → sm:12 → md:13`** — the app's ladder one rung up, stepping at the same two
breakpoints every other scaling site uses. Keep the `sm` rung: it was missing once (`11 → md:13`, a single 2px
jump), so between 640 and 768 the page's captions grew and these labels did not, and the nav visibly fell
behind its surroundings before over-correcting in one jump. One rung up from the caption ladder because 10px
is too small for the labels on the app's only navigation, read at a glance and mostly on a phone.

**Badges anchor to the icon's span, not the button.** The span is exactly the glyph's box, so the offsets are
read against the glyph; anchored to the button they would sit at the corner of a 56px full-width segment and
read as decorating the bar rather than the tab. The admin badge's offsets are asymmetric on purpose and
should not be evened up: lucide's icons do not fill their box evenly, and the wrench's mass is its top-right
head, so clearing it costs far more horizontally than vertically. Every offset here is measured against
`size-6` and does not survive it changing.

### footer-has-no-chrome

The footer inherits `main`'s white and carries no background and no border. It went black → `bg-slate-100` →
nothing, and each step corrected the one before.

Black read as the page's own base while the footer was the last thing on screen. It stopped being last when
AppBottomNav arrived fixed directly beneath it, and a black strip meeting a light bar looked like two
unrelated pieces of chrome stacked by accident. The fix at the time was to give it the tint the header and nav
carry, so all three read as one surface framing the white content.

That over-corrected. The nav **already** separates itself from white content with an upward shadow, which is
the whole reason it has no `border-t`, so the tint bought a second copy of a boundary the nav owns; and the
`border-t` the tint needed to stay crisp put a hairline 56px above the nav's shadow. Two separators that close
together is the same objection that removed the footer's `border-b` earlier. Dropping both leaves one bottom
boundary: the nav's shadow cast onto white, which is the case it was designed for.

The objection was never the particular colour, so a different tint does not reopen it. The page wrapper
outside `main` still carries `bg-slate-100`, because it shows down both sides once the viewport is wider than
the content measure, and it must match `body` so an over-pull does not open a gap above the header.

### brand-lockup-has-no-breakpoints

This used to be the fiddliest geometry in the app. The lockup shared its row with a centred segmented control,
so what it could show depended on a sum of that control's width, the caret's inset and the row's padding
(`12 + ((100vw - 24) - 248) / 2` at one point), and the answer was two hand-measured thresholds (hidden below
510px, abbreviated below 700px, later 470px) that went stale whenever any term moved. Adding a third tab would
have moved a term.

Moving navigation to the viewport bottom removed every term. The row now holds the mark and one 32px control,
so the space available is `100vw - 12 - 32 - 12` minus the lockup's own `12 + 32 + 8` — about `100vw - 108`.
The words run ~145px, so it fits from ~253px, comfortably below the app's 350px floor. There is no width the
app supports at which the full lockup does not fit, so there is nothing to switch on.

**Keep it that way.** If something is added back to this row, put it on its own line or at the bottom rather
than reintroducing a measured threshold: that is the trade this change was made to escape.

### fixed-element-offsets-agree-by-construction

Three places reserve or clear AppBottomNav's height, and none of them measures it: `main`'s
`pb-[calc(3.5rem+env(safe-area-inset-bottom))]` in HomePage, the Toaster's
`bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`, and ScrollTopFab's `bottom-[calc(4.25rem+…)]`.

Each repeats the bar's own height expression rather than reading its rect, so the four agree by
construction. `3.5rem` is the bar's `min-h-14`; the `env()` term is its own
`pb-[env(safe-area-inset-bottom)]`, which is what makes the reservation track the real painted height on a
notched iPhone rather than assuming zero. **Adding the inset again on top of a measured height would double
it.**

The Toaster's `4.5rem` and the FAB's `4.25rem` are that `3.5rem` plus their own gap, summed into one
literal because `bottom` takes a single length. So the row height is not visible as its own term at either
site: **when the bar's row height changes, each number moves by the same delta rather than to the new row
height.** Measuring the element instead would need a resize observer for a value that is static;
`getPopoverViewportBounds` measures because popovers clamp to a live rect, which these do not.

The z-order between them is deliberate. Toasts are `z-[100]` and win over the `z-40` bar, because transient
feedback hidden behind the navigation is the worse failure; the FAB is `z-30` and loses to the install
banner, because during that rare overlap the banner should not be punched through.

---

## Charts and type

### chart-frame-fit-memo

Both tab panels stay mounted and toggle with `hidden`, so every tab switch takes each chart's frame from a
real width to 0 and back, and a ResizeObserver reports **both** transitions. Without the memo, each switch
re-ran the full converge loop for all nine charts on the page, roughly 8 Chart.js renders apiece. That is
the flash on the frame a switch commits.

The fit is a pure function of frame width (label set, font size, label padding and layout padding are all
derived from it), so an unchanged width can reuse the height that width converged to last time and spend a
single `chart.resize()` instead.

**The observer callback defers to a rAF, and that is correctness rather than throttling.** The fit mutates
the frame's height, which is the very box the observer watches, so running it synchronously inside the
callback forms an observe→resize→observe loop. The browser then drops the "undelivered" follow-up
notifications, and if the dropped pass was a transient collapse (a momentary 0-width mid drag-resize) the
chart is left at ~0 height and never recovers: the chart disappears. The hop also collapses the several
notifications one drag frame can deliver into a single fit.

There is deliberately **no `window.resize` listener**. A width-flexible frame already gets a notification
whenever the window resize changes its width, and everything the fit derives comes from the chart's own
width rather than the viewport's, so a listener could only duplicate a pass already scheduled.

**Resuming from background force-refits, and it is a repaint rather than a re-fit.** Mobile browsers discard
canvas backing stores under memory pressure, which empties the canvas while leaving its dimensions intact —
so the memo still looks valid, no geometry check can detect it, and nothing schedules another pass because
no width ever changed. The chart is simply gone until something redraws it. Forcing clears the memo, which
sends the fit down its full `refreshChart` path and repaints. It listens to `pageshow` as well as
`visibilitychange` because iOS does not reliably deliver the latter on restore from a frozen state, and
defers to a rAF because the frame may not be laid out at event time.

Note that a plain `chart.resize()` is enough everywhere else, and deliberately so: `resizeDelay` is unset,
so Chart.js's `_doResize` is `debounce(update, 0)`, which calls through **synchronously**. Any real size
change therefore re-fits the scales (and re-runs `applyRadarCenterFit`) inside the `resize()` call. The
`retinaScale` early-return above it only triggers when the new device pixel dimensions equal the old, i.e.
when there is no geometry to re-derive — so wrapping `resize()` in a follow-up `update()` buys nothing and
costs a second full render per pass.

### career-radar-emoji-breakpoint

The six columned radars swap between emoji-only spokes and full text pillar names on a **media query**, not
on their own canvas width.

They previously compared each chart's width against a px threshold, and the six frames are not the same
width: a career-track card's chart runs 176→263px across the columned range, while a foundational cell's
runs 170→257px because it carries the divided grid's extra `px-2` plus the panel's `p-2`. The two groups
therefore crossed the threshold about 20 viewport px apart — around 772px the track cards went to text while
the foundation row was still emoji — and scrollbar width shifted both.

Keying on the page's width makes it one fact, evaluated once, and it also keeps the label set independent of
`chart.width` and therefore stable across the frame-fit's resize passes.

The bounds are written out as numbers because `matchMedia` takes a string and the theme is `@theme inline`,
which substitutes values into the generated utilities rather than emitting `--breakpoint-*` on `:root`, so
there is nothing to read Tailwind's scale from at runtime:

- **640** is Tailwind's `sm` and **must stay in step with `sm:grid-cols-3`**. Below it the cards stack and
  every chart is full-width (286–591px), which fits text comfortably, so emoji never reaches mobile.
- **820** is the one value tuned to a device rather than a breakpoint: the iPad Air's portrait width, the
  narrowest screen that should read full pillar names. The query caps at 819 so text starts exactly at 820,
  where the columns are ~230–236px. Dropping it to 640 means text everywhere, at the cost of nine pillar
  names at the 8px floor around a 170px chart.

### chart-type-scale

The chart title, the track badge and the cluster legend are three fixed ratios of one number — the radar's
axis-label size — rather than independent values. Anything that should move with the chart belongs on
`getChartPointLabelSizePx`, not on a private ramp.

Expressed as ratios on purpose: the title sits directly above the canvas and beside the badge, both of which
scale with chart width, so a fixed px size or a Tailwind `text-*` step would drift out of proportion at every
width but the one it was picked at. The theory tab's framework title runs off the same number, so the two are
equal at every width by construction rather than by agreement. Theory previously carried its own Tailwind
ladder, which stepped for reasons unrelated to the chart it sat above: the tool panel caps at 550, so the
chart reaches full size around a 550px viewport while `sm:` does not fire until 640.

**There is no `minPx` and no `maxPx`, and adding either back does nothing.**

- The floor is structural: the label is already clamped to `chartFonts.pointLabelMinPx` (12) before the
  multiplier, so the title cannot go below `12 × 1.4 = 16.8`. An explicit `minPx: 14` sat here once and was
  dead code under the product.
- The ceiling is the canvas width: `page.chartMaxWidthPx` holds the canvas at 526, so the title tops out at
  ~21.3. A `maxPx: 22` was kept for a while on the argument that it guarded the shared theory title; raising
  it to 30 produced identical output at every width.

To change the largest the titles get, move `page.chartMaxWidthPx` or the multiplier. A font clamp cannot.

Leading is not configured in JS at all. A `lineHeightMultiplier: 1.25` used to mirror Tailwind's
`leading-tight` so the title row could reserve the right height, and a ratio duplicated in two languages is a
ratio that eventually disagrees. The row now floors itself at `1.25em` against its own font size, which is the
same computation the class does, done once, by the browser. That `em` floor is also what holds the row's
height when the title is hidden and only the badge is left, since the font size sits on the **row**, not the
`<h2>`.

The row is sized by the title and the badge follows it. The dependency used to run the other way, which meant
a wrapped title took its leading from a pill's padding — at narrow widths, exactly `leading-none`. Wrapping is
rare but not impossible: `MAX_PROFILE_NAME_LENGTH` is a character budget, and capitals are far wider than
lowercase, so an all-caps name at the limit can still take two lines.

### share-gates-are-deliberately-asymmetric

The two share buttons probe the Web Share API differently, and the asymmetry is the point rather than an
oversight.

- **The chart share** (`CAN_SHARE_FILES` in ChartSection) probes with a dummy `File`, because `canShare`
  gates on the files payload specifically. This share exists to send the user's chart, so a share sheet
  that cannot carry the image cannot do the job and the button should not appear at all.
- **The theory share** (`CAN_SHARE_LINK` in TheoryContent) asks only for `navigator.share`. Its payload is
  a LINK with the poster attached as a bonus, so it still works, degraded, without file support.
  `shareTheoryLink` runs the file probe itself and drops to a text-only share.

Same API, different payload, different gate. Applying the strict probe to the theory share would hide the
button from browsers that can still deliver the thing being shared.

The fallbacks differ for the same reason. The chart share falls back to a clipboard copy or a download,
because its image is generated on the spot and would be lost if not captured somewhere. The theory share
just shares text, because its image is a static asset the user can reach any time. The theory fetch is
deliberately non-fatal.

### print-foundation-grid-width

`printFoundationGridWidthPx` must approximate the **printed** content width, because a Chart.js radar's
geometry (radius, axis-label font size, label padding) is derived from the width it fitted at and then baked
into the drawn bitmap. Print CSS can rescale that bitmap but cannot re-derive it.

A row laid out at the phone's ~320px card width printed three ~100px radars with their pillar names clipped
("Archi", "unication"), while the track cards directly below it looked right for the only reason that matters:
they are in normal flow, so they were laid out at the full card width all along.

762 is that width on A4 portrait, the narrower of the two common papers and so the safe target:

```
794  A4 portrait page width
-24  tab-panel px-3 (12 each side)
-24  card p-3 (12 each side)
────
746  card content width
+16  this grid carries -mx-2, so it is 16px WIDER than the content box it sits in
────
762
```

That last term is the one that matters: getting it wrong is a silent 5px-per-column error, which is why the
whole sum is written out. It works out to ~222px per chart against ~219px for the three track cards below
(their column is `(746 − 16 of gap) / 3`, less each card's `p-3`). The two rows are meant to read as the same
size, and that arithmetic is what keeps them there.

Letter is 816px and lands ~22px wider, which the bitmap rescale absorbs without visible loss. The theory
panel's own 900px cap never binds, since paper is narrower than that.

---

## Copy

### changelog-rank-sentinels

`changelogRank` returns a version's **position** in the `CHANGELOG` array, where 0 is newest, so a smaller
rank means newer. Indexed rather than parsed as a number, which cannot misorder "4.10" against "4.2" and
makes the array the one source of truth.

**Rank is a position, never a distance.** "Two versions behind" is simply a larger index; there is no
staleness threshold anywhere, and nothing is measured in major/minor steps.

The two out-of-range results are **sentinels meaning "absent from the array"**, not measurements:

- **`Infinity`** — unknown and not ahead of the newest entry, so it cannot be placed on the scale. It reads
  as older than every real entry, raising a dot on every changed section. This is the long-absent user: a
  v2.9 stamp lands here because v2.9 is _commented out of the array_, not because 2.9 is numerically far
  from 4.2. Uncomment that entry and the same stamp gets a finite rank.
- **`-1`** — numerically ahead of the newest entry, so it reads as newer than everything and raises no dots.
  This is the rollback case: someone who read a section at v4.2 keeps that stamp after v4.2 is reverted, and
  treating them as ancient would light every dot with no way to clear them.

Only the `-1` branch parses version numbers, and only as an off-the-end test. There is no numeric bound at
the old end, because anything unplaceable already defaults to `Infinity`. A malformed or hand-edited value
therefore lands on `Infinity`, and showing dots is the safe failure: the cost is a re-read rather than
silently swallowed updates.

**Consequence: the array's length is the horizon.** Pruning old entries shifts users still sitting at those
versions from a finite rank to `Infinity`. Harmless while both show every dot, but it would start to matter
if anything ever read the rank as a count of versions behind.

### docs-grey-ladder

The Theory tab's text colours are five rungs, one stop apart, and every piece of text on the page takes its
colour from `DOC_TEXT` / `DOC_SECTION` and nothing else. The table lives in
[doc-typography.js](../src/styles/doc-typography.js).

**Two things decide a rung:** whether the text is on the page or inside a card, then what job it does there.
The page's own voice is darker; a card is a quieter object sitting on it, so its contents step back. Both are
answerable at a glance from the JSX, which is the point — the ladder only holds if picking a rung never
requires an opinion. A title is a title on either surface, so only prose steps back inside a card.

**No new rungs, and no shades between them.** At 12-14px a half-step is invisible as a system and reads as
drift, and every gap that gets filled makes the remaining distinctions harder to see. Text that needs to
outrank its neighbours has size and weight available; use those.

**Retune by moving a rung here, never by overriding a colour at the call site.** A one-off shade is exactly
how the previous drift started: this replaced four greys (800 / 600 / 500 / 400) that had spread across the
same job, so a track card's summary and a level card's description were rendered two shades apart, the
Section IV subsection lead-ins came out lighter than the section intro directly above them, and the
skill-tier card sat a step below every other card.

### the-name-has-no-article

The framework's name carries **no article and no possessive**: not "The 9-Pillar…", not "Jasper's 9-Pillar…".

The opening word of a title is its most valuable position, and neither earns it. The possessive cost more
than prominence: a self-applied one reads as one person's take rather than a model others can cite, and the
eponymous frameworks this was modelled on (the Barrett Model, Bloom's Taxonomy) had that possessive
_conferred_ by the people citing them, never claimed up front.

Dropping "The" is also what leaves **one** canonical string instead of two differing only by the article. The
`<h1>` and `og:site_name` had already drifted apart on exactly that, and there is now nothing to keep in sync.

The article survives inside real sentences (`tagline`, `detail`, the share templates), where it is grammar
rather than naming. Attribution is not lost, only separated from the name: it appears as a suffix in the long
form, and on-page via `byline`, `<meta name="author">` and the og:description.

---

## Admin gating

### admin-gating-is-not-a-security-boundary

`/poster` and `/social` are gated in App.jsx, not just hidden behind the Admin tab. Gating the affordance
and not the destination protects nothing: `IS_ADMIN` hid the link while the routes rendered for whoever
typed the path.

**This is still a client-side check.** The app is a static bundle on GitHub Pages, so both pages' code ships
to every visitor either way, and the unlock flag can be written by hand in devtools. What the gate buys is
that the paths do not work for someone who merely knows or guesses them, which is the actual exposure.
Making these pages truly unavailable means **not shipping them**: a build-time flag plus dynamic imports so
Rollup drops the chunks, not a stricter runtime test.

The same reasoning caps the password in `constants/features.js`. It is a plain literal in the bundle, so it
stops a colleague handed the URL and nobody determined. Anything that genuinely needs protecting needs a
server, not a longer string.

**Two ordering constraints follow, and both are easy to break:**

1. `features.js` is evaluated on the import path, **before React mounts**, because `IS_ADMIN` must be final
   by the time HomePage's `VALID_TABS` and AppBottomNav's items are built from it at their own module-eval.
   Nothing there may block. It used to call `window.prompt`, which in any context that suppresses modal
   dialogs (VS Code's Simple Browser, a sandboxed iframe without `allow-modals`, some in-app webviews) was
   never shown and never dismissed, so the app never finished booting: a blank white page. The question is
   now ordinary UI rendered after mount by AdminUnlockPrompt, which has no such failure mode.
2. App.jsx rewrites a gated URL back to the tool root, but **not while a password is outstanding**.
   `unlockAdmin` applies an unlock by reloading, so keeping the path is what lets `/poster?admin=1` come
   back as the poster. Rewriting first would land a correct password on the tool, having silently discarded
   where the visitor was going.

### body-background-propagates-to-the-canvas

`body`'s background propagates to the canvas when `html` has none, which is the case here. That makes it
what an over-pull past either end of the document reveals, so it must agree with whatever stage is on
screen: the app's `bg-slate-100` surround on the tool, black on the export canvases.

The `data-export-canvas` flag is stamped on `documentElement` rather than `body` precisely because `html`
staying unpainted is the precondition for the propagation, so the flag goes on the element that must remain
unpainted and the paint stays in CSS. It is set at module scope rather than in an effect because the route
is read once at module-eval and never changes; an effect would paint the wrong colour for the first frame,
which on an export page is the frame being looked at.

This is the same property that rules out compensating the scroll lock on `body` — see
[scroll-lock-gutter](#scroll-lock-gutter).

---

## Tabs

### tab-panel-prefit

A `display: none` panel has no width, so a chart inside it cannot measure its frame and cannot converge. That
is why the first switch to Theory used to fit all eight of its radars at once, and flash.

`prefit` lays the panel out for real, so every frame has its true width and every fit converges and memoises,
while `h-0 overflow-hidden` clips it to nothing and contributes no document height, and `inert` keeps focus
and pointers out. It is invisible and costs no layout above it, yet the charts inside come out fitted.

The three phases run `deferred` (first render, active panel only) → `prefit` (on the next idle callback) →
`mounted` (back to `hidden`, charts already fitted). The point of the middle phase is that the width a chart
pre-fits at is the width it is shown at, so the switch is a memo hit: one `chart.resize()` per chart instead
of eight converge loops at once.

This is also why each panel carries its **own** measure rather than both taking the active tab's. A hidden
panel then lays out at the width it will actually be shown at.

### tab-scroll-memory-uses-plain-scrolly

`useTabScrollMemory` stores a plain `window.scrollY`, which is **only safe because the header is sticky**.
Worth spelling out, because it was not always true and the trap is easy to walk back into.

While the header sat in document flow at position 0, its height was part of every scroll coordinate on the
page. The header state is one boolean shared by both tabs and can be toggled while a tab is inactive, so
expanding it inserted ~120px of document above every position in both tabs at once, and a raw `scrollY`
recorded before the toggle named different content afterwards. Scroll Tool to the bottom, switch to Theory,
expand the header there, come back, and Tool restored to its old number, now 120px short of the bottom. That
was worked around by storing `scrollY - anchor`, measured from the tab bar.

A sticky header occupies viewport space rather than document space above the scroll position, so its height
is no longer part of any scroll coordinate and a toggle cannot move a sleeping tab's numbers at all. The
cause is gone rather than corrected for, which is why the plain unit is correct again. **Reintroducing a
document-flow header means reintroducing an anchor-relative offset.**

### tab-transition-duration

160ms, with the exit at 60% of it.

Short on purpose. This fires on every navigation between two tabs the user moves between constantly, and a
transition long enough to notice as an animation is long enough to be in the way by the tenth time. It should
convey which direction you moved, not be watched.

It was 220ms, which read as a **delay** rather than as motion. The duration was only half of why — the
entrance also used to start fully transparent, which withheld a page that was already laid out — but at 220ms
the tail of the settle was still perceptible as waiting for a page that was demonstrably already there.

**Do not raise this to make the slide more visible.** If the motion needs more presence, the distance in the
keyframes is the knob; time is the part the user feels as lag.

One constant drives both the CSS animation and the timer that keeps the outgoing panel mounted. A shorter
timer cuts the exit off mid-flight; a longer one leaves the panel sitting on a finished frame.

The transition is **one-sided**: the arriving tab slides and fades in, the departing one is not animated at
all, just hidden. It started as a cross-fade and that **ghosted** — two semi-transparent copies of the app
overlaid, the old tab's headings legible through the new one's. Cross-fading two opaque full-page layouts
always does; no pair of intermediate opacities shows only one of them. Do not reintroduce an exit animation
to "balance" the entrance.
