import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/utils";

/**
 * The confirm button of a high-risk dialog: red outline and red text on the panel's white, never a
 * filled red block. Destructive is the one action a filled button must not advertise — fill is what the
 * app uses to mean "this is the way forward" (see the near-black `default` on Got it / Unlock), and
 * pointing that at Delete all would recommend it. Outline keeps it clearly available and clearly not
 * encouraged, while red carries the consequence.
 *
 * SHARED SO THE HIGH-RISK DIALOGS CANNOT DRIFT: these exact classes were pasted in ConfirmDialog and
 * SaveCollisionDialog, which is how two dialogs for the same category of decision end up subtly unlike
 * each other. Pair it with `destructive` on ConfirmDialog rather than reaching for it directly.
 */
const DESTRUCTIVE_CONFIRM_CLASS = "justify-center border-red-500/50 text-red-600 hover:bg-red-50 hover:text-red-700";

/**
 * A bare exclamation mark, for the high-risk dialogs.
 *
 * HAND-ROLLED BECAUSE LUCIDE HAS NO BARE ONE. Every alert icon it ships (CircleAlert, TriangleAlert,
 * OctagonAlert…) wraps the mark in an enclosing shape, and the icon here already sits on a black disc —
 * so CircleAlert draws a ring inside a ring, and TriangleAlert crams a triangle into a circle. The disc
 * IS the enclosure; this supplies only what goes inside it. These are exactly CircleAlert's two strokes
 * with its `circle` dropped, on lucide's 24px grid with its cap and join style, so it sits with the real
 * lucide icons the other dialogs use.
 *
 * Much heavier than lucide's own proportions (stroke 3.5 rather than 2) because without the enclosure
 * it has the whole disc to fill: at lucide's weight the mark reads as a thin speck in a black circle.
 *
 * THE MARK IS INSET (6→18) RATHER THAN RUN TO THE EDGES, which looks backwards next to the "fill the
 * disc" sizing above but is what pays for the weight. A round cap projects half the stroke width past
 * its endpoint, so at stroke 3.5 the drawn mark already overhangs its endpoints by ~1.75 each way —
 * the visible ink runs roughly 4.2→19.8 of 24, which is edge to edge once the glyph box itself is
 * scaled up close to the disc. Extending the endpoints too would push the caps under the disc's rim.
 */
function ExclamationMark(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <line x1="12" x2="12" y1="6" y2="13.5" />
      <line x1="12" x2="12.01" y1="18" y2="18" />
    </svg>
  );
}

/**
 * The app's one modal shell: scrim, centred panel, Escape-to-close, body-scroll lock, and the
 * icon-in-a-circle title row. Every dialog in the app is built on it (ConfirmDialog,
 * SaveCollisionDialog, BackupReminderDialog, AdminUnlockPrompt).
 *
 * IT EXISTS BECAUSE FOUR HAND-BUILT COPIES DRIFTED. The scrim, `z-[100]`, `max-w-sm` panel, radius,
 * padding and title/body type were duplicated verbatim in each file, so every visual tweak had to be
 * made four times and a missed one showed up as a dialog that was subtly the odd one out — which is
 * exactly how one of them ended up without `aria-describedby` and another without an icon.
 *
 * WHAT IT DOES NOT DECIDE: which buttons. Each dialog's actions differ in count, order, label, emphasis
 * and destructiveness, and a prop general enough to express all of that would be harder to read at each
 * call site than the two lines of JSX it replaced. So `actions` takes finished <Button>s and only owns
 * where they sit; the caller owns what they are.
 *
 * Props:
 *   - open           — render nothing when false.
 *   - title          — heading text (required; it is what labels the dialog).
 *   - icon           — optional lucide component, drawn white on a black disc beside the title.
 *   - compactIcon    — smaller disc, for a glyph that already fills its box (the high-risk dialogs'
 *                      bare exclamation). Default false suits lucide's own icons.
 *   - onClose        — Escape and backdrop handler. Also what `dismissOnBackdrop` calls.
 *   - closeLabel     — accessible name for the backdrop button (default "Close").
 *   - dismissOnBackdrop — clicking the scrim calls onClose (default true). Off for dialogs whose
 *                     question is expensive to re-summon (see AdminUnlockPrompt).
 *   - role           — "alertdialog" (default) or "dialog". Forms with inputs want "dialog"; an
 *                     alertdialog is for an urgent message with limited interaction.
 *   - as             — panel element, e.g. "form" (default "div"). Extra props (onSubmit…) spread onto it.
 *   - portal         — portal to <body> (default true). Off when the dialog already renders at the
 *                     top of the tree and so has no ancestor stacking context to escape.
 *   - initialFocusRef — focused on open. Defaults to the panel, so focus at least enters the dialog.
 *   - titleId / descriptionId — ids for aria-labelledby / aria-describedby. Children must put
 *                     `descriptionId` on their body copy for it to be announced.
 *   - actions        — the footer buttons, stacked. Rendered as a sibling of the copy (see below).
 *   - children       — body copy, grouped with the title.
 */
function Modal({
  open,
  title,
  icon: Icon = null,
  compactIcon = false,
  onClose,
  closeLabel = "Close",
  dismissOnBackdrop = true,
  role = "alertdialog",
  as: Panel = "div",
  portal = true,
  initialFocusRef = null,
  titleId,
  descriptionId,
  actions = null,
  children,
  ...panelProps
}) {
  const panelRef = useRef(null);

  // Escape + scroll lock + initial focus, all scoped to while the dialog is open. Escape is bound to
  // the document rather than the panel so it works before focus has landed anywhere inside.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Prefer the caller's element (a cancel button, a text field); fall back to the panel so focus is
    // inside the dialog either way and Escape/Tab behave.
    (initialFocusRef?.current ?? panelRef.current)?.focus?.();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) {
    return null;
  }

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:hidden"
      // A real <dialog> would need showModal() and a ref+effect to open it, to get semantics these
      // three attributes already provide for a component that is conditionally rendered anyway.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      {/* Backdrop. A <button> only when it does something — otherwise a plain div, so assistive tech
          is not offered a control that ignores the click. */}
      {dismissOnBackdrop ? (
        <button type="button" aria-label={closeLabel} onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/50" />
      ) : (
        <div className="absolute inset-0 bg-slate-900/50" />
      )}

      <Panel
        ref={panelRef}
        // -1 so the panel can take focus as the fallback target without joining the tab order.
        tabIndex={-1}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl focus:outline-none"
        {...panelProps}
      >
        <div className="flex flex-col gap-1.5">
          {/* Title row. The icon disc is monochrome for every dialog on purpose: colour here would rank
              one dialog above another, and the copy is what carries urgency.

              TWO DISC SIZES, CHOSEN BY `compactIcon` RATHER THAN BY THE CALLER. The high-risk dialogs draw
              a bare exclamation that fills its box edge to edge, so a large disc around it reads as a
              heavy black blob; the informational ones (GlobeX, Lock) are detailed lucide glyphs with
              built-in margin, and shrinking them to match made the detail illegible. Same reason, two
              answers. Tying it to the glyph's own weight keeps a third size from appearing later.

              THE GLYPH RUNS CLOSE TO THE DISC EDGE in both (4.5-in-6, 5-in-8), leaving a thin ring of black
              rather than a badge with a small mark adrift in it — the disc is meant to read as an outline
              around the icon, not as a filled circle that happens to contain one. */}
          <div className="flex items-center gap-2">
            {Icon ? (
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full bg-slate-900 text-white",
                  compactIcon ? "size-6" : "size-8",
                )}
              >
                <Icon className={compactIcon ? "size-4.5" : "size-5"} aria-hidden />
              </span>
            ) : null}
            <h2 id={titleId} className="text-base font-bold text-slate-900">
              {title}
            </h2>
          </div>
          {/* Body copy sits in the header block, at the tighter `gap-1.5`, so title and prose read as one
              unit. `actions` is a SIBLING of that block rather than more children, which is what keeps the
              wider `gap-4` between the copy and the buttons — the single visual break in the panel. */}
          {children}
        </div>

        {actions ? <div className="flex flex-col gap-2">{actions}</div> : null}
      </Panel>
    </div>
  );

  return portal ? createPortal(overlay, document.body) : overlay;
}

export { DESTRUCTIVE_CONFIRM_CLASS, ExclamationMark, Modal };
