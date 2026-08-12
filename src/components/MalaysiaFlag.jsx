import { Tooltip } from "@/components/ui/Tooltip";

import { cn } from "@/utils";

/**
 * The Malaysian flag as inline SVG, for the author byline. Artwork from flag-icons (MIT).
 *
 * Inline rather than the 🇲🇾 emoji, which renders as "MY" on Windows and as nothing on some Android builds,
 * and rather than flag-icons itself, whose CSS `background-image` approach the poster export can drop.
 */
export function MalaysiaFlag({ className, withTooltip = false }) {
  const flag = (
    <svg
      viewBox="0 0 640 480"
      role={withTooltip ? undefined : "img"}
      aria-label={withTooltip ? undefined : "Malaysia"}
      aria-hidden={withTooltip || undefined}
      className={cn(
        "h-[0.86em] w-[1.15em] shrink-0 outline-1 -outline-offset-1 outline-slate-900/20",
        // `block` when wrapped, so the flag doesn't sit on the wrapper's text baseline and drop twice.
        // Centred on the CAP band (midpoint ~0.36em), not `align-middle`, which uses the lower x-height midpoint.
        withTooltip ? "block" : "inline-block align-[-0.07em]",
        className,
      )}
    >
      <path fill="#C00" d="M0 0h640v480H0z" />
      <path fill="#fff" d="M0 34.3h640v34.3H0z" />
      <path fill="#fff" d="M0 102.9h640V137H0z" />
      <path fill="#fff" d="M0 171.4h640v34.3H0z" />
      <path fill="#fff" d="M0 240h640v34.3H0z" />
      <path fill="#fff" d="M0 308.6h640v34.3H0z" />
      <path fill="#fff" d="M0 377.1h640v34.3H0z" />
      <path fill="#fff" d="M0 445.7h640V480H0z" />
      <path fill="#006" d="M0 .5h320v274.3H0z" />
      <path
        fill="#FC0"
        d="m207.5 73.8 6 40.7 23-34-12.4 39.2 35.5-20.8-28.1 30 41-3.2-38.3 14.8 38.3 14.8-41-3.2 28.1 30-35.5-20.8 12.3 39.3-23-34.1-6 40.7-5.9-40.7-23 34 12.4-39.2-35.5 20.8 28-30-41 3.2 38.4-14.8-38.3-14.8 41 3.2-28.1-30 35.5 20.8-12.4-39.3 23 34.1zm-33.3 1.7a71 71 0 0 0-100 65 71 71 0 0 0 100 65 80 80 0 0 1-83.2 6.2 80 80 0 0 1-43.4-71.2 80 80 0 0 1 126.6-65"
      />
    </svg>
  );

  if (!withTooltip) {
    return flag;
  }
  // Tooltip resolves its trigger from its own parent, so the flag needs a wrapper to be hovered on its own.
  return (
    <span role="img" aria-label="Malaysia" className="group relative inline-block align-[-0.07em] leading-none">
      {flag}
      <Tooltip text="Malaysia" />
    </span>
  );
}
