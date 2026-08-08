import { useCallback, useEffect, useRef } from "react";

import { Download, Share, SquarePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useCloseInstallBanner, useInstallBannerOpen, useInstallPrompt, useOpenInstallBanner } from "@/hooks/useInstallPrompt";

import { INSTALL_DISMISS_DAYS, INSTALL_DISMISSED_AT_KEY, SITE_COPY } from "@/constants";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";

/** True while the banner is still inside its post-dismissal cooldown. Storage failures (private mode,
 *  disabled cookies) read as "not dismissed": the banner is dismissible either way, so the worst case
 *  is being asked again rather than a surface that cannot be closed. */
function dismissedRecently() {
  try {
    const timestamp = Number(localStorage.getItem(INSTALL_DISMISSED_AT_KEY));
    if (!timestamp) {
      return false;
    }
    return Date.now() - timestamp < INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * The iOS "Share → Add to Home Screen" instruction line, shared by both surfaces.
 *
 * IT IS ONLY THE INSTRUCTIONS NOW, not a whole message. It used to open with "It is just this page, nothing
 * to download", which made the iOS banner say something completely different from every other platform's.
 * The value sentence is now shared by both branches and this follows it, so the two read as one message with
 * a platform-specific tail rather than as two unrelated blurbs.
 *
 * THE TWO GLYPHS ARE THE POINT. iOS labels neither control with text, so naming them in prose ("tap the
 * share button") asks the reader to map a name onto an unlabelled icon; showing the icon inline IS the
 * instruction. `aria-label` on the Share glyph gives that mapping to a screen reader, where the icon conveys
 * nothing; the second glyph sits beside its own text label, so it is `aria-hidden` rather than announced
 * twice.
 *
 * IT HARDCODES NO COLOUR, and that is required rather than tidy: this renders on BOTH a dark ground (the
 * banner, `bg-slate-900`) and a light one (the header pill's popover, `bg-white`). It used to fix the
 * emphasis at `text-slate-900`, which was right on white and near-invisible on the dark card.
 *
 * `emphasisClass` IS THE ONE KNOB each surface passes: the colour its emphasis should take, brighter than the
 * body text around it. BOTH GLYPHS TAKE IT TOO, not just the `<b>` — they are the things the reader has to
 * go and find in the iOS UI, so they need to be at least as prominent as the words. The Share icon was
 * inheriting the muted body colour and reading as a grey smudge mid-sentence.
 */
function IosHintText({ emphasisClass }) {
  return (
    <>
      Tap <Share size={14} strokeWidth={2.5} className={cn("inline-block align-[-2px]", emphasisClass)} aria-label="the Share button" /> then{" "}
      <b className={cn("font-semibold", emphasisClass)}>
        Add to Home Screen <SquarePlus size={14} strokeWidth={2.5} className="inline-block align-[-2px]" aria-hidden="true" />
      </b>
      .
    </>
  );
}

/**
 * The floating, dismissible install banner, pinned to the bottom of the viewport.
 *
 * MOUNTED FROM App.jsx, alongside AdminUnlockPrompt and for the same reason: it is `fixed`, so its
 * position comes from the viewport rather than from any tab's flow, and it should be offerable on
 * whichever route or tab the visitor happens to be on.
 *
 * IT SITS ABOVE THE BOTTOM NAV RATHER THAN OVER IT, which is the same arithmetic the Toaster does —
 * see components/ui/Toaster.jsx. The nav is `fixed` at `bottom: 0` and `z-40` (see AppBottomNav), so
 * anchoring to the viewport's bottom edge would put this on top of the app's primary navigation.
 *
 * `4.25rem` is the bar's own 3.5rem (the height HomePage reserves with `pb-[calc(3.5rem+…)]`) plus a
 * 0.75rem gap, and `env(safe-area-inset-bottom)` is the same term the bar itself carries — so the
 * offset tracks the bar's real painted height on a notched iPhone instead of assuming zero. Written as
 * one figure rather than a three-term calc to match the Toaster's `4.5rem`; if the bar's height ever
 * changes, all three of these move together.
 *
 * `z-[100]` matches the Toaster and the dialogs: it must clear the `z-40` chrome and the `z-50`
 * popovers. A toast appearing while this is up will overlap it, which is correct — a toast is a
 * response to something the user just did, and this is an unprompted offer.
 */
function InstallPrompt() {
  const { installed, canInstall, iosHint, install } = useInstallPrompt("banner");
  // Open/closed lives in the shared store, because the header pill opens this too — see useInstallPrompt.
  const open = useInstallBannerOpen();
  const openBanner = useOpenInstallBanner();
  const closeBanner = useCloseInstallBanner();

  // THE UNPROMPTED APPEARANCE, which is separate from the pill's deliberate one. Gated on the full ladder:
  // not already installed, not inside the dismissal cooldown, and there is some install path to offer. On
  // Chrome the last condition arrives with `beforeinstallprompt`, a beat after mount; on iOS Safari it is
  // true immediately, since there is no event to wait for; on a desktop browser with neither it never
  // becomes true and this stays shut, which is the intended outcome rather than a missing case.
  //
  // AUTO-OPEN ONCE PER MOUNT, tracked by a ref rather than by reading `open`. Without it, dismissing would
  // set `open` false, this effect would re-run and immediately re-open the banner — the X would do nothing.
  // The cooldown write makes `dismissedRecently()` true so a later re-run bails anyway, but that relies on
  // localStorage being writable, and in private mode it is not.
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    if (autoOpenedRef.current || installed || dismissedRecently()) {
      return;
    }
    if (canInstall) {
      autoOpenedRef.current = true;
      openBanner();
      track("install_banner_shown", { method: "native", source: "banner" });
    } else if (iosHint) {
      autoOpenedRef.current = true;
      openBanner();
      // A DIFFERENT EVENT NAME, NOT `install_banner_shown` WITH A `method`, because on iOS this banner is
      // not an offer — it is documentation. There is no Install button to accept (see the `canInstall`
      // guard on it), so nothing here can convert and no accept/decline pair exists to compare.
      //
      // Naming it apart is what stops the two being summed by accident: `install_banner_shown` now means
      // "an install offer with a working accept path was presented", which is true on Android and desktop
      // and false here. A shared name separated only by a param relies on every future reader remembering
      // to segment, and one unsegmented chart would quietly report iOS as a wall of refusals.
      track("install_instructions_shown", { source: "banner" });
    }
  }, [installed, canInstall, iosHint, openBanner]);

  const dismiss = useCallback(() => {
    closeBanner();
    try {
      localStorage.setItem(INSTALL_DISMISSED_AT_KEY, String(Date.now()));
    } catch {
      // Storage unavailable (private mode). The banner still closes for this session; it just will
      // not remember, so it may be offered again on the next load.
    }
    // NOT TRACKED ON iOS, deliberately, which is why this is guarded rather than carrying a `method`.
    //
    // On native the X is a real decline: an Install button sits beside it, so closing is a choice made
    // against a visible alternative, and this is the other branch of `install_banner_clicked`.
    //
    // On iOS the X is the ONLY control on the banner, so it fires on virtually every impression and is
    // very nearly a duplicate of `install_instructions_shown`. It is also ambiguous in the wrong
    // direction: it is pressed just as readily by someone tidying away steps they have already followed
    // as by someone refusing. An event that is both near-constant and unreadable is worse than absent,
    // because it invites a dismissal rate to be computed from it.
    //
    // Nothing on this banner can observe an iOS install anyway — Safari fires neither
    // `beforeinstallprompt` nor `appinstalled` (see useInstallPrompt). Installed iOS users are counted
    // instead by `app_open` reporting `display_mode: "ios-standalone"`, read on its own as a user count
    // rather than joined back to this banner.
    if (!iosHint) {
      track("install_banner_dismissed", { method: "native", source: "banner" });
    }
  }, [iosHint, closeBanner]);

  const onInstall = useCallback(async () => {
    // The CLICK, not the outcome — `install_os_accepted` / `install_os_declined` already report what the
    // browser's sheet returned. Fired here so the banner's two buttons can be compared directly against
    // each other (this vs `install_banner_dismissed` on the X), and so the drop-off between pressing
    // Install and completing the OS dialog is visible as its own step:
    // install_banner_shown → install_banner_clicked → install_os_accepted → install_completed.
    //
    // Before `await`, because the native prompt hands control to the browser and an event queued after it
    // is at the mercy of whatever the user does to the tab while the sheet is up.
    track("install_banner_clicked", { method: "native", source: "banner" });
    const outcome = await install();
    // Only close on acceptance. A user who cancels the native sheet has not asked to stop being
    // offered, and `appinstalled` will hide this anyway if they change their mind and use the
    // browser's own menu instead.
    if (outcome === "accepted") {
      closeBanner();
    }
  }, [install, closeBanner]);

  // `installed` STILL GATES THE RENDER even though the store owns open/closed, and it is not redundant: the
  // app can be installed WHILE this is on screen (via the browser's own menu, or by accepting a prompt the
  // pill opened), and `appinstalled` flips `installed` without anything calling `closeBanner`. Step one of
  // the ladder — installed means no install UI, ever.
  if (!open || installed) {
    return null;
  }

  /* THE ROW'S HORIZONTAL SPACING IS TUNED AT THE TEXT/BUTTON SEAM, which is where the visible gap was.
     The gap is paid TWICE on the way to the Install button (once after the icon tile, once before the
     button) on top of the `p-3` inset, so at `gap-3` the body text stopped well short of the button with
     a dead band between them. `gap-2.5` keeps the icon tile off the heading while letting the text run
     up to the button, and `pr-2.5` trims only the button's side of the inset — the pill carries its own
     `px-5`, so it still reads as inset from the banner edge without a full 12px outside it. The other
     three sides keep `p-3`. */
  return (
    <section
      className="install-enter fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[100] mx-auto flex w-[min(34rem,calc(100vw-1.5rem))] items-center gap-2.5 rounded-2xl border border-slate-700 bg-slate-900 p-3 pr-2.5 shadow-2xl print:hidden"
      aria-label="Install this app"
    >
      {/* THE APP'S OWN ICON, NOT A DOWNLOAD GLYPH, and the glyph was actively working against the copy.
          A tray-and-arrow is the idiom browsers use for downloading a FILE, so pairing it with a
          sentence that promises there is nothing to download asked the reader to disbelieve the icon.

          The favicon is the most literal preview available of what installing does: it is the exact
          image the OS puts on the home screen. Nothing to misread — it is not a metaphor for the
          action, it is the outcome.

          Same treatment as the header's brand mark (see AppShellHeader's AppShellBrandMark): intrinsic
          96px so it stays sharp on retina, displayed small, `rounded-xl` to match this banner's corners
          rather than the mark's own. `BASE_URL` because Pages serves from /egf/.

          `alt=""` + `aria-hidden`: the heading beside it already names the app, so announcing the icon
          would be a second reading of the same thing. */}
      <img src={`${import.meta.env.BASE_URL}favicon-96x96.png`} alt="" aria-hidden width={96} height={96} className="size-10 flex-none rounded-xl" />

      {/* NOTHING RESERVES THE X's CORNER, and nothing needs to. There was a `float-right` spacer here for
          exactly that, on the assumption that the heading would otherwise run under the dismiss button —
          but the X is positioned against the SECTION, not this column, and the Install pill sits between
          the two occupying ~80px of that edge. The X is over the PILL, never over this text. The spacer was
          reserving width against a control that was not there, which is width the heading pays for at every
          size and wraps sooner for.

          IF THE PILL EVER GOES AWAY (an iOS-only banner has no Install button — see below), the X does come
          to rest above this column's right edge. It is still clear of the heading's single short line at any
          width the banner has, so this stays unreserved rather than carrying a spacer for the narrower of
          two cases. Revisit if the heading ever grows long enough to wrap. */}
      <div className="min-w-0 flex-1 mb-0.5">
        {/* `mb-1` OWNS THE TITLE/BODY GAP, and the body carries no `mt-*` to stack on top of it. It was
            `mt-0.5` on the body — 2px, which at these two sizes read as one crowded block rather than a
            heading with copy under it. */}
        {/* `text-md` IS NOT A TAILWIND CLASS and is deliberately left in place. The scale steps `text-sm` →
            `text-base`, so this matches no rule, emits no `font-size`, and the heading inherits from its
            ancestors — none of which set a size either, so it resolves to the browser default (16px). That is
            the size wanted here, and it is a hair larger than the `text-sm` this replaced.

            KEPT RATHER THAN SWAPPED FOR `text-base`, which would be the explicit way to say the same thing.
            Noted so the next reader does not "fix" a typo and change the rendering, and so it is on record that
            the size is INHERITED rather than declared — if an ancestor ever sets a font-size, this heading will
            follow it instead of holding 16px. */}
        <p className="mb-1 text-[15px] font-bold text-white">Add to your home screen</p>
        {/* `slate-300` FOR THE BODY, NOT `slate-600` INVERTED TO `slate-400`. On a dark ground the eye needs
            less contrast reduction than on a light one to read text as secondary, so the naive mirror of the
            light palette lands too dim — 300 is muted against the white heading while staying comfortably
            readable at 12px. */}
        {/* ONE MESSAGE WITH A PLATFORM-SPECIFIC TAIL, not two unrelated blurbs. The value sentence is the
            same everywhere — it is the reason to install, which does not depend on how you install — and only
            what FOLLOWS it differs: iOS gets the manual Share gesture because it has no button to offer, and
            everyone else gets the reassurance that dismissing costs them nothing, because they do.

            THE NON-iOS TAIL NAMES THE HEADER, and it is the third wording this clause has had. It said "later
            in browser settings", which stopped being the nearest truth once the header grew its own Install
            pill; then "You can always install it later", which was safe from going stale but so vague it
            reassured without informing — "always" and "later" tell a reader nothing they can act on.
            "Not now? The Install button stays in the header" does both jobs at once: dismissing is not final,
            AND here is where to go.

            IT WILL GO STALE IF THE PILL MOVES, and that is accepted rather than overlooked. That control has
            already moved once this cycle (a card at the end of the tool tab, then the header), so this is a
            real risk and not a hypothetical one. The trade was made knowingly: a sentence that says where beats
            a sentence that says nothing, and if the pill moves again this line moves with it. If you are here
            because you just relocated it, this is the copy to fix. */}
        {/* NO MEASURED WRAP RULE HERE, unlike the Theory tagline's (see useFitsOneLine). That one breaks its
            second sentence onto a new line only IF the first happens to fit on one, which needs a probe measured
            after layout — and inside this flex row the probe kept reporting a different width than the visible
            text received, so the sentence wrapped while the tail was still being pushed to its own line. Not
            worth the machinery for two short sentences in a dismissible banner. The break below is a FIXED
            per-platform choice instead, which needs no measurement at all.

            `leading-normal` (1.5) over `leading-snug`: at three lines on a narrow phone the tighter setting
            packed them close enough to read as a block rather than as lines. */}
        <p className="text-xs leading-normal text-slate-300">
          Add <b className="font-semibold text-white">{SITE_COPY.shortName}</b> for one-tap, full-screen access.
          {/* THE iOS HINT ALWAYS STARTS A NEW LINE; the non-iOS tail never does. Not a measured decision — a
              fixed one per platform, which is what makes it a `block` class rather than the probe this used to
              carry. The two tails are different KINDS of text: the iOS one is an instruction to go and perform
              a gesture, so it wants to be found as its own step, while "You can always install it later" is a
              closing clause of the sentence before it and reads correctly running on.

              The `block` supplies its own line break, so the space that separates the inline tail from the
              sentence belongs to the inline branch alone — hence the explicit `{" "}` there and none before the
              ternary. A plain leading space in the string would not survive: JSX trims whitespace at the start
              of a line. */}
          {iosHint ? (
            <span className="block">
              <IosHintText emphasisClass="text-white" />
            </span>
          ) : (
            <> Not now? The Install button stays in the header.</>
          )}
        </p>
      </div>

      {/* No button on iOS: there is no prompt to fire, so the hint text above is the whole offer.

          `px-5` OVER THE `sm` SIZE'S `px-2.5`, and `mt-1` to drop it off the X's line. The two controls
          are stacked on the same right edge — X pinned in the corner, this centred in the row beneath it —
          and at the default padding the pill was narrow enough to read as squeezed into the space the X
          left over rather than as the banner's primary action. A wider pill is unambiguously a button, and
          the extra top margin puts daylight between the two so they read as two controls rather than one
          crowded column.

          `mt-1` NOT `self-end` OR A BIGGER GAP: the row is `items-center`, so this stays vertically
          centred against the text column and the nudge is small enough not to look misaligned. Pushing it
          to the bottom edge instead would leave a gap above that grows with every extra line the text
          wraps to. */}
      {canInstall ? (
        /* WHITE ON DARK, AND THE LOUDEST THING ON THIS CARD, which is the opposite weight the header pill
           carries. "Primary" means maximum contrast against whatever is behind it, so on this `slate-900`
           surface that is a solid white fill — `variant="default"` (`bg-primary`, i.e. near-black) would be
           the LOWEST-contrast element in the banner rather than the highest, hence the override.

           The header pill is deliberately quieter (`outline`, see InstallPill): it is permanent chrome that
           only has to be findable, whereas this appears in response to a moment and is the whole point of the
           card it sits on. Same offer, two jobs, two weights — do not "unify" them.

           Hover lifts to a faint slate, since there is nowhere brighter to go from white.

           `ring-offset-slate-900` matches the card behind it. The base offset colour is the page background
           (white), which on this dark card would draw a white band around the focus ring. */
        <Button
          type="button"
          variant="default"
          shape="pill"
          className="mt-1 flex-none bg-white px-5 text-slate-900 ring-offset-slate-900 hover:bg-slate-100"
          onClick={onInstall}
        >
          Install
        </Button>
      ) : null}

      {/* PINNED TO THE TOP-RIGHT CORNER RATHER THAN SITTING IN THE ROW, which is what stops the banner
          growing tall on a narrow phone. In the row it was a third flex item competing for the same
          width as the text and the Install button, so the text column lost ~28px plus a gap and wrapped
          to four lines; out of the flow it costs the text column nothing at all.

          POSITIONED AGAINST THE SECTION, NOT THE TEXT COLUMN, which is the detail that makes that true:
          this lands over the Install pill's top edge, not over the heading, so no space has to be reserved
          for it anywhere. See the note above the text column.

          It also reads better where it is: a close affordance belongs at the edge of the thing it closes.

          IT IS STILL STACKED ABOVE THE INSTALL BUTTON, THOUGH, which an earlier version of this note
          claimed it was not. Pinning it to the corner took it out of the row but left it on the same right
          edge, directly over the pill — so instead of two adjacent targets side by side there were two
          adjacent targets one above the other, which is the same problem rotated. The separation is bought
          below instead: `top-0.5 right-0.5` pushes this as far into the corner as the radius allows, and
          the pill carries `mt-1` and `px-5` to sit lower and read as wider. See its note.

          `size-7` NOT the `size="icon"` variant's 8: the tap target shrinks, but this sits in a corner
          with nothing around it to mis-hit, and the smaller square is what fits inside the `p-3` inset
          without crowding the heading's cap height. */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        shape="pill"
        // `slate-500` resting, WHITE on hover — inverted for the dark card. The `ghost` variant's
        // `hover:bg-accent` is a light tint that would flash pale behind the glyph here, so the hover is
        // carried by the icon colour alone and the fill is pinned transparent.
        className="absolute top-0.5 right-0.5 size-7 text-slate-400 hover:bg-transparent hover:text-white"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
      >
        <X size={16} strokeWidth={2.5} aria-hidden="true" />
      </Button>
    </section>
  );
}

/**
 * The persistent install path, as a labelled pill in the app header's right corner (see AppShellHeader).
 *
 * IT REPLACED A CARD AT THE END OF THE TOOL TAB, which was the wrong place twice over: the tool page is
 * where you build a profile, so an "install the app" card sat in the middle of unrelated work, and being
 * in a tab's scrolling content meant it only existed if you scrolled to the bottom of that one tab. The
 * header is pinned on every tab at every scroll depth, so this is reachable from anywhere without
 * costing any tab's content a slot.
 *
 * NO DISMISS AND NO COOLDOWN, unlike the banner: this is the surface that stays available. Someone who
 * closed the banner (or closed it fourteen days ago and has forgotten it existed) still has a way in.
 *
 * RENDERS NOTHING WHEN THERE IS NO INSTALL PATH — an installed app, or a desktop browser that never
 * fired `beforeinstallprompt` and is not iOS Safari. That is what makes it safe to put in the header: on
 * a Mac in Firefox the corner is simply empty rather than showing a control that cannot work. It is also
 * why the header's `min-h-14` is a floor rather than a fixed height (see AppShellHeaderStack).
 *
 * IT INSTALLS DIRECTLY WHERE IT CAN, AND OPENS THE BANNER WHERE IT CANNOT — which is a platform split, not
 * an inconsistency. The button says "Install", so on Chrome/Edge/Android it fires the native prompt on the
 * first tap and nothing comes between the label and the thing it promises.
 *
 * ON iOS SAFARI IT OPENS THE BANNER, because there is no prompt to fire: Safari never fires
 * `beforeinstallprompt`, and the only install is the manual Share → Add to Home Screen gesture. Those
 * instructions have to be shown somewhere, and the banner is already that surface.
 *
 * THIS REVERSES AN EARLIER "ALWAYS OPEN THE BANNER" PASS, which routed every platform through the card so
 * the pill would behave identically everywhere. The reasoning was consistency; the cost was that on Android
 * a button labelled Install opened a card that also said Install, and asked the user to decide twice. Nobody
 * compares the two platforms side by side, so that consistency bought nothing real — whereas the extra tap
 * was paid by every Android user, every time. A label should do what it says wherever it can.
 *
 * `outline` RATHER THAN THE BLACK `default` FILL, which it briefly had. Black is the app's primary and it did
 * fix a real problem — the `slate-200` treatment inherited from the scroll-top button that used to hold this
 * slot was subtle enough against the header's `slate-100` tint to be missed entirely — but it overshot. A
 * permanent fixture of the chrome should not be the loudest thing in the bar on every screen of every tab; a
 * solid black pill parked beside the brand lockup reads as an advertisement rather than as an available action.
 *
 * THE BANNER'S OWN INSTALL BUTTON KEEPS THE SOLID FILL, and the asymmetry is the point. That one appears in
 * response to a moment and is the primary action of the surface it sits on, so it should dominate its card.
 * This one is always there and is a way IN to that surface, so it only has to be findable. Same offer, two
 * different jobs, two weights.
 *
 * IT KEEPS ITS LABEL. A bare download glyph would be the one control in the app whose meaning has to be
 * guessed, and on iOS the tray-and-arrow specifically reads as "download a file" — the exact misreading the
 * banner's tile drops the glyph to avoid. Toning the pill down is a job for the FILL, not for the word.
 */
function InstallPill() {
  const { installed, canInstall, iosHint, install } = useInstallPrompt("header_pill");
  // The banner is the same offer, louder and self-explanatory. While it is up this yields, and on iOS tapping
  // this is what opens it — see useInstallPrompt for why the two coordinate through a store rather than props.
  const bannerOpen = useInstallBannerOpen();
  const openBanner = useOpenInstallBanner();

  // NO IMPRESSION EVENT FOR THE PILL, deliberately — it is the CLICK that is tracked, below.
  //
  // There used to be an `install_banner_shown` { source: "header_pill" } effect here, and its counts were
  // not comparable with the banner's. The banner logs one impression per mount (guarded by
  // `autoOpenedRef`), whereas this fired on every page load AND again each time the banner was dismissed
  // and the pill reappeared. Since /poster and /social are full page loads rather than SPA routes, simply
  // moving around the app re-fired it. The pill is permanent chrome on every tab at every scroll depth, so
  // "was it on screen" is very nearly a constant anyway and was never the question worth asking of it.
  // "Did anyone press it" is, and that is one unambiguous event per deliberate tap.

  // HIDDEN WHILE THE BANNER IS UP, so the same offer is not made twice at once. Last of the three
  // conditions because it is the only transient one: the other two are facts about the browser that hold
  // for the whole session, whereas this comes and goes as the banner is opened and dismissed.
  if (installed || (!canInstall && !iosHint) || bannerOpen) {
    return null;
  }

  /* `top-3` MATCHES THE BRAND MARK OPPOSITE so the two corners share one centre line, and `right-3`
     takes the true corner — both inherited from the scroll-top button that used to hold this slot, and
     both resolving against the header stack's own `p-3` (absolute offsets measure from the padding box).

     NO WRAPPER DIV ANY MORE. There was one, `relative` with a `data-install-pill` hook, to anchor the iOS
     popover and to let an outside-tap handler tell "inside the pill or its panel" from "outside". With the
     popover gone — the banner is the explanatory surface now — there is nothing to anchor and nothing to
     dismiss, so the button takes the corner directly. */
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      shape="pill"
      // `gap-1` over the base's `gap-2`, matching the Theory toolbar's icon-plus-label pills — at 14px the
      // wider default gap reads as a glyph floating away from its word rather than labelling it.
      //
      // `border-slate-300` OVER THE VARIANT'S `border-input`, and an explicit white fill: `outline` is drawn
      // for the app's white content area, where `bg-background` IS the page. Here it sits on the header's
      // `slate-100`, so the default border is too faint to read as an edge and the fill has to be stated to
      // separate the pill from the bar at all. Same values the scroll-top button used against this tint.
      className="absolute top-3 right-3 z-10 gap-1 border-slate-300 bg-white text-slate-900 hover:bg-slate-50 print:hidden"
      // INSTALL DIRECTLY WHERE THERE IS A PROMPT TO FIRE, otherwise open the banner and let its instructions
      // do the work. `canInstall` is the capability test, not the platform — a Chrome that never fired
      // `beforeinstallprompt` falls to the banner too, which is the right fallback rather than a dead tap.
      // `method` records WHICH BRANCH the tap took, because they are two different outcomes wearing one
      // label: `native` fires the OS prompt (so it can go on to `install_os_accepted`), while `ios` only opens
      // the banner and the install still depends on a manual Share-sheet gesture we cannot observe. Without
      // it the two would be averaged into a single meaningless conversion rate.
      onClick={() => {
        track("install_banner_clicked", { method: canInstall ? "native" : "ios", source: "header_pill" });
        if (canInstall) {
          install();
        } else {
          openBanner();
        }
      }}
      // NOT `aria-expanded`. It was a disclosure while it toggled its own inline popover; that popover is gone,
      // and neither branch is a disclosure now — one installs, the other opens a surface elsewhere in the
      // document.
      //
      // THE LABEL DIFFERS WITH THE BRANCH, because the two taps do different things and a screen reader user
      // gets no other cue which one they are on. The visible word stays "Install" either way: on iOS it is the
      // name of the job, and the banner it opens explains the gesture immediately.
      aria-label={canInstall ? "Install this app" : "How to install this app"}
    >
      {/* A DOWNLOAD GLYPH, NOT THE FAVICON, which is the distinction that matters in this slot. The
            favicon was here and earned nothing: the header's brand mark shows the SAME image a couple of
            hundred pixels to the left, so the pill was repeating the app's own icon back to it in the row
            where width is scarcest. A glyph is not a repeat of anything — it says what the button DOES,
            which is the job an icon has next to a one-word label.

            THE "IS IT A FILE DOWNLOAD?" OBJECTION DOES NOT BITE HERE, though it is why the banner's 40px
            tile shows the favicon instead. There the glyph sat in a large tile directly above a sentence
            promising there was nothing to download, so it contradicted the copy at the size that draws the
            eye first. At 14px beside the word "Install", the label disambiguates it and the tray-and-arrow
            is simply the conventional install mark.

            `size-3.5` matches the Theory toolbar's pills (Print, Share, Changelog), which are the app's
            other icon-plus-label buttons at this size. */}
      <Download className="size-3.5 shrink-0" aria-hidden />
      Install
    </Button>
  );
}

export { InstallPill, InstallPrompt };
