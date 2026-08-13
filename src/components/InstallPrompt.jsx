import { useCallback, useEffect, useRef } from "react";

import { Download, Share, SquarePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useCloseInstallBanner, useInstallBannerOpen, useInstallPrompt, useOpenInstallBanner } from "@/hooks/useInstallPrompt";

import { INSTALL_DISMISS_DAYS, INSTALL_DISMISSED_AT_KEY, LAYER, SITE_COPY } from "@/constants";
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
 * The iOS "Share → Add to Home Screen" instruction line, shared by both surfaces. Instructions only: the
 * value sentence comes from the shared branch above it.
 *
 * The two glyphs are the point, since iOS labels neither control with text. HARDCODES NO COLOUR — it renders
 * on both a dark and a light ground, so `emphasisClass` is the one knob, and BOTH GLYPHS take it as well as
 * the `<b>`: they are what the reader must find in the iOS UI.
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
 * The floating, dismissible install banner, pinned to the bottom of the viewport. Mounted from App.jsx since
 * it is `fixed` and offerable on any route.
 *
 * `4.25rem` is AppBottomNav's 3.5rem plus a 0.75rem gap, with the bar's own `env(safe-area-inset-bottom)` so
 * the offset tracks its painted height; the Toaster repeats this arithmetic with its own figure. `z-[100]`
 * matches the Toaster and dialogs — a toast overlapping this is correct, since a toast answers something the
 * user just did and this is unprompted.
 */
function InstallPrompt() {
  const { installed, canInstall, iosHint, install } = useInstallPrompt("banner");
  // Open/closed lives in the shared store, because the header pill opens this too — see useInstallPrompt.
  const open = useInstallBannerOpen();
  const openBanner = useOpenInstallBanner();
  const closeBanner = useCloseInstallBanner();

  // Gated on: not installed, not in cooldown, some install path exists. Auto-open once per mount, tracked by
  // a ref rather than reading `open` — otherwise dismissing re-opens it immediately and the X does nothing.
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
      // A different event name rather than `install_banner_shown` with a `method`, because on iOS this is
      // documentation, not an offer: there is no Install button, so nothing can convert. Naming it apart
      // stops the two being summed, since a shared name split only by a param relies on every future reader
      // remembering to segment, and one unsegmented chart would report iOS as a wall of refusals.
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
    // Not tracked on iOS: the X is the banner's only control there, so it fires as readily for someone
    // tidying away finished steps as for a decline — unreadable as a dismissal rate. `app_open` covers those.
    if (!iosHint) {
      track("install_banner_dismissed", { method: "native", source: "banner" });
    }
  }, [iosHint, closeBanner]);

  const onInstall = useCallback(async () => {
    // The CLICK, not the outcome (`install_os_accepted`/`_declined` report that), so the funnel reads
    // install_banner_shown → _clicked → install_os_accepted → install_completed. Fired BEFORE `await`: the
    // native prompt hands control to the browser, and an event queued after it is at the tab's mercy.
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

  /* Spacing tuned at the text/button seam: `gap-3` left a dead band before the Install button since the gap
     is paid twice on the way there. `gap-2.5` closes it; `pr-2.5` trims only the button's side of the inset. */
  return (
    <section
      className={cn(
        "install-enter fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] mx-auto flex w-[min(34rem,calc(100vw-1.5rem))] items-center gap-2.5 rounded-2xl border border-slate-700 bg-slate-900 p-3 pr-2.5 shadow-2xl print:hidden",
        LAYER.modal,
      )}
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
        /* WHITE ON DARK, AND THE LOUDEST THING ON THIS CARD — on `slate-900`, `variant="default"`'s near-black
           fill would be the lowest-contrast element rather than the highest. The header pill is deliberately
           quieter; do not "unify" them. Hover lifts to a faint slate since nothing is brighter than white, and
           `ring-offset-slate-900` stops the default white offset drawing a band around the focus ring. */
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
 * The persistent install path, as a labelled pill in the app header's right corner. No dismiss and no
 * cooldown, unlike the banner: this stays available to someone who closed that and forgot it existed.
 *
 * Renders NOTHING when there is no install path, which is what makes it safe in the header and why the
 * header's `min-h-14` is a floor rather than a fixed height.
 *
 * Installs directly where a native prompt exists and opens the banner where it does not (iOS Safari, which
 * has only the manual Share gesture). Routing every platform through the banner cost Android users an extra
 * tap and a card that asked them to decide twice.
 *
 * `outline` rather than the banner's solid fill — permanent chrome should not be the loudest thing in the
 * bar. It keeps its label: a bare tray-and-arrow glyph reads as "download a file" on iOS.
 */
function InstallPill() {
  const { installed, canInstall, iosHint, install } = useInstallPrompt("header_pill");
  // The banner is the same offer, louder and self-explanatory. While it is up this yields, and on iOS tapping
  // this is what opens it — see useInstallPrompt for why the two coordinate through a store rather than props.
  const bannerOpen = useInstallBannerOpen();
  const openBanner = useOpenInstallBanner();

  // No impression event for the pill, deliberately: it is the CLICK that is tracked, below. An earlier
  // impression event was not comparable with the banner's (which logs once per mount) because this fired on
  // every page load and again whenever the banner was dismissed. The pill is permanent chrome, so "was it on
  // screen" is nearly a constant; "did anyone press it" is the question worth asking.

  // HIDDEN WHILE THE BANNER IS UP, so the same offer is not made twice at once. Last of the three
  // conditions because it is the only transient one: the other two are facts about the browser that hold
  // for the whole session, whereas this comes and goes as the banner is opened and dismissed.
  if (installed || (!canInstall && !iosHint) || bannerOpen) {
    return null;
  }

  /* `top-3` MATCHES THE BRAND MARK OPPOSITE so the two corners share a centre line; both offsets resolve
     against the header stack's own `p-3`. No wrapper div: the iOS popover it used to anchor is gone. */
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      shape="pill"
      // `gap-1` over the base `gap-2`, matching the Theory toolbar's pills at 14px. Explicit
      // `border-slate-300` + white fill, since `outline`'s default border is too faint on the header's tint.
      className="absolute top-3 right-3 z-10 gap-1 border-slate-300 bg-white text-slate-900 hover:bg-slate-50 print:hidden"
      // `canInstall` is a capability test, not a platform test — a Chrome that never fired
      // `beforeinstallprompt` falls to the banner too. `method` splits `native` (fires the OS prompt) from
      // `ios` (opens the banner, install unobservable after) so they are not averaged into one conversion rate.
      onClick={() => {
        track("install_banner_clicked", { method: canInstall ? "native" : "ios", source: "header_pill" });
        if (canInstall) {
          install();
        } else {
          openBanner();
        }
      }}
      // NOT `aria-expanded` — the popover it used to toggle is gone, and neither branch is a disclosure now.
      // THE ARIA LABEL DIFFERS WITH THE BRANCH, since a screen reader user has no other cue which tap this is;
      // the visible word stays "Install" either way.
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
