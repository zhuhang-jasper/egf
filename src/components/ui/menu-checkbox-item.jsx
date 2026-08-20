import { AdminLockBadge } from "@/components/AdminLockBadge";

import { CONTROL_TEXT } from "@/styles/control-typography";
import { cn } from "@/utils";

/**
 * A persistent toggle row inside a menu panel — a real `<input type="checkbox">` in a `<label>`, so the menu
 * stays open and the state is the checkbox's own. Deliberately NOT {@link MenuItem}, which is `role="menuitem"`:
 * that row fires an action and closes.
 *
 * `adminOnly` badges the row. The caller passes it rather than this reading a FEATURE_* flag, since those decide
 * whether the row renders at all and a row gated by one flag but badged from another could disagree with itself.
 */
export function MenuCheckboxItem({ label, checked, onChange, adminOnly = false, className }) {
  return (
    // select-none: these rows get clicked repeatedly to flip a setting.
    <label className={cn("flex cursor-pointer select-none items-center gap-2.5 rounded-md px-3 py-1.5 hover:bg-muted/60", CONTROL_TEXT, className)}>
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 shrink-0 rounded border border-input accent-foreground"
      />
      {/* Badged inline rather than at a corner: a column of padlocks down a list of near-identical rows cannot be
          attributed to any of them. `static` switches AdminLockBadge out of its absolute default; `-translate-y-1`
          is tied to its disc size, so re-judge it if that changes. `label=""` because the row's own `aria-label`
          is already the checkbox's accessible name.

          Do NOT add a `display` class here — the badge centres itself with grid, and tailwind-merge treats any
          display utility as the same group, so an `inline-flex` would silently replace `inline-grid`. */}
      <span>
        {label}
        {adminOnly ? <AdminLockBadge label="" className="static ml-0.5 -translate-y-1 align-middle" /> : null}
      </span>
    </label>
  );
}
