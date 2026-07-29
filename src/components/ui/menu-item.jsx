import { cn } from "@/utils";

/**
 * A row inside a dropdown `role="menu"` panel (see ProfileActionsMenu, TitleToolbar's save menu).
 *
 * Not built on `Button`: a menu row is full-width and left-aligned with its own padding, so it would
 * have to override most of the button base (`justify-center`, the `h-8` sizing, `rounded-md`, and a
 * variant background) rather than reuse it.
 *
 * `divided` draws the separator between stacked rows — pass it on every row but the first.
 * `destructive` switches the hover tint for a delete action. `disabled` works natively.
 */
export function MenuItem({ icon: Icon, children, className, divided = false, destructive = false, ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      // select-none: menu rows are click targets, so a double-click shouldn't select the label.
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-left text-xs text-foreground",
        destructive ? "hover:bg-destructive/10" : "hover:bg-muted/60",
        divided && "border-t border-border",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
      {children}
    </button>
  );
}
