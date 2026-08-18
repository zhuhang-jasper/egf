import { FileText, Radar, Wrench } from "lucide-react";

import { AdminLockBadge } from "@/components/AdminLockBadge";
import { UnseenDot } from "@/components/UnseenDot";

import { FE_UI, FRAMEWORK_VERSION, IS_ADMIN, LAYER } from "@/constants";
import { TOOL_TEXT } from "@/styles/control-typography";
import { cn } from "@/utils";

/** Gated in two places: here and HomePage's VALID_TABS. Keep them in step. */
const NAV_ITEMS = [
  { id: "tool", label: "Tool", icon: Radar },
  { id: "theory", label: "Theory", icon: FileText, version: `v${FRAMEWORK_VERSION}` },
  ...(IS_ADMIN ? [{ id: "admin", label: "Admin", icon: Wrench, adminOnly: true }] : []),
];

/**
 * Primary navigation, fixed to the bottom of the viewport at every width.
 * See docs/DECISIONS.md#navigation-moved-to-a-bottom-bar.
 *
 * Two things break silently if touched:
 *   - The safe-area padding resolves to 0 unless index.html keeps BOTH `viewport-fit=cover` and
 *     `apple-mobile-web-app-capable`.
 *   - `bg-page-surface` must stay opaque, and the active fill, hover and unseen dot are all read against it.
 *     Same token as the sticky header, and it must stay identical to it: both are chrome sitting above the
 *     tinted page (`--color-page-base`), at opposite ends of the same screen.
 */
export function AppBottomNav({ activeTab, onTabChange, theoryHasUnseenUpdates = false }) {
  return (
    /* The shadow is `shadow-sm` negated in Y (Tailwind has no upward-casting utility) and is the page's only
       bottom boundary, so it replaces a `border-t` rather than joining one.

       Do NOT add `transform-gpu` or a `dvh` calc to fix a tab-switch jump: a fixed element cannot opt out of
       the visual viewport. See docs/DECISIONS.md#bottom-nav-visual-viewport-jump. */
    <nav
      id="app-bottom-nav"
      aria-label="Primary"
      // The gutter must move the right EDGE, not add padding: padding would inset the row while the
      // background kept painting to the viewport edge. See docs/DECISIONS.md#scroll-lock-gutter.
      className={cn(
        "fixed left-0 right-[var(--scroll-lock-gutter)] bottom-0 bg-page-surface shadow-[0_-1px_3px_0_rgb(51_65_92_/_0.12),0_-1px_2px_1px_rgb(51_65_92_/_0.10)] pb-[env(safe-area-inset-bottom)] print:hidden",
        LAYER.chrome,
      )}
    >
      {/* No horizontal padding: it would inset every item, so the active indicator could not reach the row's
          outer edge. Breathing room belongs inside each button. The MAX width bound is per ITEM, not here.
          `minWidth` matches `main`'s own floor — this bar is `fixed`, so without it the bar kept shrinking
          past where the page stopped, sliding out of alignment once the page started scrolling horizontally.
          On the row, not `<nav>`, so the background/shadow still reach the viewport edge below that width. */}
      <div className="mx-auto flex w-full items-stretch justify-center" style={{ minWidth: FE_UI.page.minWidthPx }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon, version, adminOnly }) => {
          const selected = activeTab === id;
          // Opening the tab does not clear it: it stays lit until every changed section has been scrolled to.
          const showUnseenDot = id === "theory" && theoryHasUnseenUpdates;
          return (
            /* `min-h-14` is repeated as `3.5rem` in HomePage's `main` padding and in the Toaster's offset.
               All three move together. */
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "group relative flex min-h-14 flex-1 xs:max-w-[150px] cursor-pointer select-none flex-col items-center justify-center gap-1 font-semibold",
                TOOL_TEXT.label,

                // On every item, coloured on only one, so the borders abut into one band. The transparent half
                // is load-bearing: without it the active item is 3px taller and the row shifts on every switch.
                // See docs/DECISIONS.md#bottom-nav-item-geometry.
                "border-t-[3px]",

                "transition-colors",

                // Three gaps must hold at once against the bar's tint, and none of these values can move alone.
                // `slate-300` for active has been tried and rejected twice. The icon below takes `text-black`
                // with these as one mark. See docs/DECISIONS.md#bottom-nav-colour-system before retuning.
                selected ? "border-black bg-slate-200 text-black" : "border-transparent text-slate-400 hover:bg-slate-200/50",
              )}
            >
              {/* Badges anchor to this span, not the button, so they sit on the glyph rather than the segment.
                  Their offsets are measured against `size-6`; re-judge them if it changes.

                  Sized `size-6` and made a block-level flex box rather than left inline: as an inline span its
                  box came off the text baseline and inherited the button's fractional width from `flex-1`, so
                  the badges' containing block started mid-device-pixel and the lock rasterized 1px off,
                  flipping direction on resize. A fixed 24px box gives them a whole-pixel origin to sit on. */}
              <span className="relative flex size-6 shrink-0 items-center justify-center">
                <Icon className={cn("size-6 shrink-0", selected ? "text-black" : "text-slate-400")} aria-hidden />
                {showUnseenDot ? (
                  // No ring: it needs both a width and a colour, and every past colour became a halo on the
                  // next bar change. See docs/DECISIONS.md#bottom-nav-colour-system.
                  <UnseenDot label="New framework updates" className={cn("absolute top-0 -right-2 size-2")} />
                ) : null}
                {/* Asymmetric on purpose: the wrench's mass is at the top right, so clearing it costs more
                    horizontally. It shares the dot's corner, safe only while no tab carries both. */}
                {adminOnly ? <AdminLockBadge className="-top-1 -right-4" /> : null}
              </span>
              <span className="flex items-baseline leading-none">
                {label}
                {/* Inherits size, weight and colour: "Theory v4.1" is one phrase, and a pinned value drifted
                    darker than its own label once. The `ml-1` is the only reason this is a separate span. */}
                {version ? <span className="ml-1 leading-none">{version}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
