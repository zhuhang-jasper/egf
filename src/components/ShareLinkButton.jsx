import { useEffect, useRef, useState } from "react";

import { Tooltip } from "@/components/ui/Tooltip";

import { cn } from "@/utils";
import { buildTheoryShareUrl } from "@/utils/theory-url";

const COPIED_RESET_MS = 1500;

function LinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0 text-green-600"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Copy-link button for theory deep-links. Writes the share URL to the clipboard and swaps the link
 * icon to a green check for {@link COPIED_RESET_MS}ms.
 *
 * - Icon-only (no `label`): a styled tooltip (not native `title`, so it appears immediately on
 *   hover/focus) reads "Copy link" → "Copied".
 * - Labeled (`label` set): renders the visible text alongside the icon, and the text swaps to
 *   "Copied" on click — no tooltip, since the wording is already visible.
 */
export function ShareLinkButton({ section, pillar = null, label = null, ariaLabel, className }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleShare = async () => {
    const url = buildTheoryShareUrl(section, pillar);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link:", url);
    }
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  };

  const labeled = label !== null;
  const variantClass = labeled
    ? "gap-1.5 px-2.5 py-1 text-xs text-slate-500 hover:bg-black/[0.08] hover:text-slate-700"
    : "p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:text-slate-800";

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={handleShare}
      className={cn("group relative inline-flex cursor-pointer items-center rounded-md transition-colors", variantClass, className)}
    >
      {copied ? <CheckIcon /> : <LinkIcon />}
      {labeled ? <span>{copied ? "Copied" : label}</span> : <Tooltip text={copied ? "Copied" : "Copy link"} />}
    </button>
  );
}
