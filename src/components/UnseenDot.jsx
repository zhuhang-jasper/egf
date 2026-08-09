import { cn } from "@/utils";

/**
 * The "unseen updates" dot, shared by the Theory tab label and each section heading so the two read as one
 * indicator. Meaning comes from `label`, exposed to assistive tech.
 *
 * Deliberately NOT `role="status"`, which is a live region and would announce every dot as it mounts and
 * again as it clears on scroll. `print:hidden` because it tracks this reader's session, not the document.
 */
export function UnseenDot({ className, label = "New updates" }) {
  // `role="img"` on a CSS-drawn dot: the shape is the background, so there is no `src` and no real <img>.
  return <span role="img" aria-label={label} className={cn("shrink-0 rounded-full bg-[#FF3B30] print:hidden", className)} />;
}
