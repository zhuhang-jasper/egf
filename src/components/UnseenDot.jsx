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
 */
export function UnseenDot({ className, label = "New updates" }) {
  // A CSS-drawn dot has no `src`, so the lint rule's suggested <img> doesn't apply here.
  // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
  return <span role="img" aria-label={label} className={cn("shrink-0 rounded-full bg-[#FF3B30]", className)} />;
}
