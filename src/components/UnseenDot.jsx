import { cn } from "@/utils";

/**
 * The "unseen updates" dot — iOS notification-badge red (systemRed, #FF3B30).
 *
 * Shared by the Theory tab label (aggregate: any section unread) and each Theory section heading
 * (that section unread), so the two always read as the same indicator. Purely decorative on its own;
 * the meaning comes from `label`, which is exposed to assistive tech.
 *
 * Deliberately NOT `role="status"`: that marks a live region, which would make a screen reader
 * announce every dot as it mounts and again as it clears on scroll. The dot is a passive marker on
 * the heading, so a labelled `img`-role span states it once when the heading is reached.
 *
 * `print:hidden`: the dot tracks what THIS reader has not scrolled past yet, held in session state.
 * That is true of a browsing session, not of the document — on paper it is a red dot with nothing to
 * explain it, and it would still be there long after the reader had caught up.
 */
export function UnseenDot({ className, label = "New updates" }) {
  // `role="img"` on a CSS-drawn dot: there is no `src`, so a real <img> is not an option — the shape is
  // the background, and the role is what gives `aria-label` something to name.
  return <span role="img" aria-label={label} className={cn("shrink-0 rounded-full bg-[#FF3B30] print:hidden", className)} />;
}
