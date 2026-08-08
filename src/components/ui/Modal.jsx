import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";

import { useScrollLock } from "@/hooks/useScrollLock";

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
 * THE BASE EVERY DIALOG IS BUILT ON: the machinery (portal, scrim, Escape-to-close, initial focus,
 * body-scroll lock, dialog aria) plus the panel chrome those dialogs share (radius, border, white,
 * shadow). It renders NO header, NO footer and NO width — those are a design decision, and the two
 * designs that make it live one level up as {@link SimpleModal} and {@link FullModal}.
 *
 * PICK A SIBLING, NOT THIS, at a call site. This is the thing they are made of:
 *
 *   Modal ── SimpleModal   short question, icon-disc title, stacked buttons  (ConfirmDialog,
 *         │                SaveCollisionDialog, BackupReminderDialog, AdminUnlockPrompt)
 *         └─ FullModal     wide, bordered header + close ✕, scrolling body   (ChangelogModal)
 *
 * IT EXISTS BECAUSE HAND-BUILT COPIES DRIFT, and that has now happened twice. First among four
 * dialogs, whose scrim, `z-[100]`, panel radius, padding and title type were duplicated verbatim —
 * which is how one ended up without `aria-describedby` and another without an icon. Then again with
 * ChangelogModal, which needed a wider scrolling panel, could not get it from a shell hardcoded to
 * `max-w-sm` with an icon title, and so re-implemented the portal, scrim, Escape and aria from
 * scratch. That second copy is why a body-scroll-lock bug had to be fixed in two files.
 *
 * The split is drawn where it is BECAUSE THE MACHINERY IS WHAT WAS ACTUALLY SHARED. The two panels
 * genuinely differ (a decision box vs a document), and bending one into the other would have meant
 * `size`/`maxHeight`/`hideActions` props that exist for a single caller while every dialog carries
 * them. Behaviour is common; layout is not; so only behaviour lives here.
 *
 * Props:
 *   - open           — render nothing when false.
 *   - onClose        — Escape and backdrop handler.
 *   - closeLabel     — accessible name for the backdrop button (default "Close").
 *   - dismissOnBackdrop — clicking the scrim calls onClose (default true). Off for dialogs whose
 *                     question is expensive to re-summon (see AdminUnlockPrompt).
 *   - role           — "alertdialog" (default) or "dialog". Forms with inputs want "dialog"; an
 *                     alertdialog is for an urgent message with limited interaction.
 *   - as             — panel element, e.g. "form" (default "div"). Extra props (onSubmit…) spread onto it.
 *   - portal         — portal to <body> (default true). Off when the dialog already renders at the
 *                     top of the tree and so has no ancestor stacking context to escape.
 *   - initialFocusRef — focused on open. Defaults to the panel, so focus at least enters the dialog.
 *   - titleId / descriptionId — ids for aria-labelledby / aria-describedby.
 *   - panelClassName — width, max-height and inner layout. This is the seam the two designs use.
 *   - children       — the whole panel content (header, body, footer — all of it).
 */
function Modal({
  open,
  onClose,
  closeLabel = "Close",
  dismissOnBackdrop = true,
  role = "alertdialog",
  as: Panel = "div",
  portal = true,
  initialFocusRef = null,
  titleId,
  descriptionId,
  panelClassName,
  children,
  ...panelProps
}) {
  const panelRef = useRef(null);

  // The scroll lock is its own hook because hiding the scrollbar shifts the page unless the width it
  // freed is handed back — see useScrollLock.
  useScrollLock(open);

  // Escape, bound to the document rather than the panel so it works before focus has landed anywhere
  // inside. `onCloseRef` keeps this from re-subscribing when the caller passes a fresh arrow each render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onCloseRef.current?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /**
   * Initial focus, DELIBERATELY KEYED ON `open` ALONE.
   *
   * This used to share the effect above, whose deps included `onClose` and `initialFocusRef`. Callers
   * routinely pass an inline arrow for `onClose` (`() => setDismissed(true)`), which is a new identity on
   * every render — so ANY state change in the caller re-ran the effect and re-fired `.focus()`. In
   * AdminUnlockPrompt that meant every keystroke pulled focus out of the password field and onto the
   * panel, since typing calls `setPassword` and the panel is the fallback target. Focus-on-open must
   * happen exactly once per opening, so `open` is the only thing it can depend on.
   *
   * `initialFocusRef` is read through a ref for the same reason: a ref object is usually stable, but it
   * is the caller's to create and nothing guarantees it.
   */
  const initialFocusRefRef = useRef(initialFocusRef);
  initialFocusRefRef.current = initialFocusRef;
  useEffect(() => {
    if (!open) {
      return;
    }
    // Prefer the caller's element (a cancel button, a text field); fall back to the panel so focus is
    // inside the dialog either way and Escape/Tab behave.
    (initialFocusRefRef.current?.current ?? panelRef.current)?.focus?.();
  }, [open]);

  if (!open) {
    return null;
  }

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:hidden"
      // A real <dialog> would need showModal() and a ref+effect to open it, to get semantics these
      // three attributes already provide for a component that is conditionally rendered anyway.
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

      {/* Panel chrome only — radius, border, surface, shadow, and the focus target. Width, height and
          the arrangement inside come from `panelClassName` and `children`, i.e. from the design that
          wrapped this. */}
      <Panel
        ref={panelRef}
        // -1 so the panel can take focus as the fallback target without joining the tab order.
        tabIndex={-1}
        className={cn("relative flex w-full flex-col rounded-2xl border border-slate-200 bg-white shadow-xl focus:outline-none", panelClassName)}
        {...panelProps}
      >
        {children}
      </Panel>
    </div>
  );

  return portal ? createPortal(overlay, document.body) : overlay;
}

/**
 * THE DECISION DIALOG: a narrow panel, an icon-in-a-circle title row, body copy, and buttons stacked at
 * the bottom. Every dialog that asks a short question is this one (ConfirmDialog, SaveCollisionDialog,
 * BackupReminderDialog, AdminUnlockPrompt).
 *
 * This is the shape {@link Modal} used to be before the machinery was pulled out beneath it; the props
 * below are unchanged, so its call sites did not move.
 *
 * WHAT IT DOES NOT DECIDE: which buttons. Each dialog's actions differ in count, order, label, emphasis
 * and destructiveness, and a prop general enough to express all of that would be harder to read at each
 * call site than the two lines of JSX it replaced. So `actions` takes finished <Button>s and only owns
 * where they sit; the caller owns what they are.
 *
 * Props: everything {@link Modal} takes, plus
 *   - title          — heading text (required; it is what labels the dialog).
 *   - icon           — optional lucide component, drawn white on a black disc beside the title.
 *   - compactIcon    — smaller disc, for a glyph that already fills its box (the high-risk dialogs'
 *                      bare exclamation). Default false suits lucide's own icons.
 *   - actions        — the footer buttons, stacked. Rendered as a sibling of the copy (see below).
 *   - children       — body copy, grouped with the title. Put `descriptionId` on it to have it announced.
 */
function SimpleModal({ title, icon: Icon = null, compactIcon = false, titleId, actions = null, children, ...modalProps }) {
  return (
    <Modal titleId={titleId} panelClassName="max-w-sm gap-4 p-5" {...modalProps}>
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
            <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-slate-900 text-white", compactIcon ? "size-6" : "size-8")}>
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
    </Modal>
  );
}

/**
 * THE DOCUMENT DIALOG: a wider panel with a bordered header, a close ✕, and a body that SCROLLS INSIDE
 * the panel rather than growing it. For content that is read rather than answered (ChangelogModal).
 *
 * THE SCROLL IS THE WHOLE POINT, and it is why this cannot be {@link SimpleModal} with a bigger width.
 * Three things have to agree for a panel to scroll internally: a bounded height (`max-h-[85vh]`),
 * `overflow-hidden` on the panel so the rounded corners clip the moving content, and `min-h-0` on the
 * body so it is allowed to shrink below its content — a flex child defaults to `min-height: auto` and
 * would otherwise refuse to, pushing the panel past its max-height and scrolling the PAGE instead.
 * The header and footer stay put because only the middle is the scroll port.
 *
 * `role="dialog"` by default, not SimpleModal's "alertdialog": this is browsable content, and an
 * alertdialog tells a screen reader to expect an urgent message with limited interaction.
 *
 * Props: everything {@link Modal} takes, plus
 *   - title       — heading text, rendered in the header row and labelling the dialog.
 *   - closeLabel  — accessible name for BOTH the ✕ and the backdrop (default "Close").
 *   - footer      — optional content below the scroll port, pinned. Omitted entirely when absent, so
 *                   there is no empty bordered strip on a dialog that does not need one.
 *   - children    — the scrolling body.
 */
function FullModal({ title, titleId, closeLabel = "Close", footer = null, initialFocusRef = null, children, ...modalProps }) {
  const closeButtonRef = useRef(null);
  return (
    <Modal
      role="dialog"
      titleId={titleId}
      closeLabel={closeLabel}
      // Land focus on the ✕ rather than the panel: it is the one control a read-only dialog always has,
      // so keyboard users start on the way out. A caller with something better still wins.
      initialFocusRef={initialFocusRef ?? closeButtonRef}
      // `overflow-hidden` so the scrolling body cannot paint over the panel's rounded corners.
      panelClassName="max-w-lg max-h-[85vh] overflow-hidden"
      {...modalProps}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
        <h2 id={titleId} className="text-base font-bold text-slate-900">
          {title}
        </h2>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={modalProps.onClose}
          aria-label={closeLabel}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <X className="size-4.5" aria-hidden />
        </button>
      </header>

      {/* `min-h-0` is load-bearing — see the note above. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

      {footer ? <div className="shrink-0 border-t border-slate-200 px-5 py-3.5">{footer}</div> : null}
    </Modal>
  );
}

export { DESTRUCTIVE_CONFIRM_CLASS, ExclamationMark, FullModal, Modal, SimpleModal };
