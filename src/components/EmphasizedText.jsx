import { Fragment } from "react";

/** Renders copy containing **bold** markers as emphasized spans — mirrors the PDF's in-cell bolding. */
export function EmphasizedText({ text, boldClassName = "font-semibold text-slate-800" }) {
  return String(text ?? "")
    .split("**")
    .map((part, index) =>
      index % 2 === 1 ? (
        <strong key={index} className={boldClassName}>
          {part}
        </strong>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );
}
