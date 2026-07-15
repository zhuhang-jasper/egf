import { Fragment } from "react";

/**
 * Renders copy containing **bold** markers as emphasized spans — mirrors the PDF's in-cell bolding.
 * With `plain`, the marked spans render as ordinary inline text (no fill, no weight). The Theory
 * page passes `plain` throughout so the `**…**` markers never highlight (the "What's New" toggle
 * that once controlled this has been removed).
 */
export function EmphasizedText({ text, boldClassName = "font-semibold text-slate-800", plain = false }) {
  return String(text ?? "")
    .split("**")
    .map((part, index) =>
      index % 2 === 1 && !plain ? (
        <strong key={index} className={boldClassName}>
          {part}
        </strong>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );
}
