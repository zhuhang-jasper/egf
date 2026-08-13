import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";

import { useScrollLock } from "@/hooks/useScrollLock";

import { LAYER } from "@/constants";
import { cn } from "@/utils";

/**
 * The confirm button of a high-risk dialog: red outline and red text, never a filled red block — fill means
 * "the way forward" in this app, so a filled Delete all would read as a recommendation. Shared so the
 * high-risk dialogs cannot drift; pair it with `destructive` on ConfirmDialog rather than using it directly.
 */
const DESTRUCTIVE_CONFIRM_CLASS = "justify-center border-red-500/50 text-red-600 hover:bg-red-50 hover:text-red-700";

/**
 * A bare exclamation mark for the high-risk dialogs, hand-rolled because every lucide alert icon wraps the
 * mark in a shape and this already sits on a black disc. Exactly CircleAlert's two strokes without its
 * `circle`, on lucide's grid. Stroke 3.5 rather than 2 to fill the disc; endpoints stay inset at 6→18 because
 * a round cap already projects the visible ink to ~4.2→19.8.
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
 * The machinery every dialog is built on (portal, scrim, Escape, initial focus, scroll lock, aria) plus the
 * shared panel chrome. It renders no header, footer or width: those are the two designs one level up.
 *
 * PICK A SIBLING, NOT THIS, at a call site:
 *
 *   Modal ── SimpleModal   short question, icon-disc title, stacked buttons  (ConfirmDialog,
 *         │                SaveCollisionDialog, BackupReminderDialog, AdminUnlockPrompt)
 *         └─ FullModal     wide, bordered header + close ✕, scrolling body   (ChangelogModal)
 *
 * The split is at the machinery because that is what is actually shared: merging the panels would mean
 * `size`/`maxHeight`/`hideActions` props that serve one caller while every dialog carries them.
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
   * Initial focus, deliberately keyed on `open` alone. Callers routinely pass an inline arrow for
   * `onClose`, so including it in the deps meant any caller state change re-fired `.focus()` — which pulled
   * focus out of AdminUnlockPrompt's password field on every keystroke. Focus-on-open must happen exactly
   * once per opening. `initialFocusRef` is read through a ref for the same reason: nothing guarantees the
   * caller's ref object is stable.
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
      className={cn("fixed inset-0 flex items-center justify-center p-4 print:hidden", LAYER.modal)}
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
 * It does NOT decide which buttons: actions differ in count, order, label and emphasis, and a prop general
 * enough for all of it reads worse than the JSX it replaces. `actions` takes finished <Button>s.
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
        {/* The icon disc is monochrome for every dialog on purpose: colour would rank one dialog above
            another, and the copy is what carries urgency.

            Two disc sizes, chosen by `compactIcon` rather than by the caller, so a third cannot appear
            later. The bare exclamation fills its box edge to edge and needs the smaller disc; lucide's own
            detailed glyphs have built-in margin and go illegible if shrunk to match. In both the glyph runs
            close to the disc edge, so it reads as an outline around the icon rather than a filled circle. */}
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
 * The scroll is why this cannot be {@link SimpleModal} at a bigger width. Three things must agree: a bounded
 * height, `overflow-hidden` on the panel to clip the rounded corners, and `min-h-0` on the body — without the
 * last, a flex child's `min-height: auto` pushes past max-height and scrolls the PAGE instead.
 *
 * `role="dialog"` by default rather than "alertdialog", since this is browsable content.
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
